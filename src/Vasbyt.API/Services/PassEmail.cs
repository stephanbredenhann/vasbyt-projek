using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Fire-and-forget pass delivery on its own scope, so a slow or failing mail provider never touches the form submit.
// ponytail: in-process Task, a restart can drop a send; admin "resend pass" is the recovery path.
public class PassQueue(IServiceScopeFactory scopes, ILogger<PassQueue> log)
{
    public void Enqueue(int entrantId) => _ = Task.Run(async () =>
    {
        try
        {
            using var scope = scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<PassEmail>().SendAsync(entrantId, force: false);
        }
        catch (Exception e) { log.LogError(e, "Pass email for entrant {Id} failed", entrantId); }
    });
}

/// The QR pass email: to the entrant, plus copies to the buyer and the owner account when they differ.
public class PassEmail(VasbytDbContext db, ResendClient resend, IConfiguration cfg, ILogger<PassEmail> log)
{
    // Brand colours from styles/_tokens.scss.
    private const string Indigo = "#2c3991", Deep = "#1d1e58", Orange = "#c13f12", Canvas = "#faf7f2",
        Paper = "#ffffff", Rule = "#e6ded1", Muted = "#55514b";
    private static readonly string[] MonthsAf =
        ["Januarie", "Februarie", "Maart", "April", "Mei", "Junie", "Julie", "Augustus", "September", "Oktober", "November", "Desember"];
    private static readonly string[] MonthsEn =
        ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    /// Returns how many emails were accepted. Force skips idempotency so a resend really resends.
    public async Task<int> SendAsync(int entrantId, bool force, int maxAttempts = 3)
    {
        if (cfg.GetValue<bool>("Demo:Enabled")) return 0;
        var e = await db.Entrants.AsNoTracking().Include(x => x.RouteCategory)
            .Include(x => x.OrderLine!).ThenInclude(l => l.Order!).ThenInclude(o => o.User)
            .FirstOrDefaultAsync(x => x.Id == entrantId);
        var order = e?.OrderLine?.Order;
        if (e is null || order is null || !e.IsComplete || order.Status != OrderStatus.Paid) return 0;

        var sourceId = e.RouteCategory?.SharesRouteWithId ?? e.RouteCategoryId;
        var days = await db.RouteDays.Where(d => d.RouteCategoryId == sourceId).Select(d => d.DateLocal).ToListAsync();
        var png = QrPng.Generate(QrPng.Payload(e.QrToken));
        EmailAttachment[] attachments =
        [
            new("qr.png", png, "image/png", "vasbyt-qr"),
            new($"vasbyt-{e.EntryNumber}.png", png, "image/png"),
        ];
        var link = Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out var root)
            ? new Uri(root, $"/registreer/{order.PublicToken:D}/klaar").AbsoluteUri : null;

        // Only the buyer and the owner account may receive the order capability link.
        var owners = new[] { order.BuyerEmail, order.User?.Email }.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).ToList();
        bool IsOwner(string to) => owners.Any(o => string.Equals(o, to, StringComparison.OrdinalIgnoreCase));
        var recipients = new List<string>();
        if (!string.IsNullOrWhiteSpace(e.Email)) recipients.Add(e.Email.Trim());
        foreach (var o in owners)
            if (!recipients.Any(r => string.Equals(r, o, StringComparison.OrdinalIgnoreCase))) recipients.Add(o);

        var en = order.Language == "en";
        var sent = 0;
        foreach (var to in recipients)
        {
            var copy = !string.Equals(to, e.Email?.Trim(), StringComparison.OrdinalIgnoreCase);
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(to.ToLowerInvariant())))[..16];
            var key = force ? $"entrant-pass-{e.Id}-resend-{Guid.NewGuid():N}"
                : $"entrant-pass-{e.Id}-{(copy ? "copy" : "own")}-{hash}";
            var name = $"{e.FirstName} {e.LastName}".Trim();
            var subject = (en, copy) switch
            {
                (false, false) => $"Jou Vasbyt-pas: {name} ({e.EntryNumber})",
                (false, true) => $"Vasbyt-pas vir {name} ({e.EntryNumber})",
                (true, false) => $"Your Vasbyt pass: {name} ({e.EntryNumber})",
                (true, true) => $"Vasbyt pass for {name} ({e.EntryNumber})",
            };
            var (html, text) = Body(e, order, DateRange(days, en), IsOwner(to) ? link : null, copy, name, en);
            if (await resend.SendAsync(to, subject, html, text, key, attachments, maxAttempts)) sent++;
            else log.LogWarning("Pass email for entrant {Id} was not delivered to {To}", e.Id, ResendClient.Mask(to));
        }
        return sent;
    }

    private static string DateRange(List<DateOnly> days, bool en)
    {
        var months = en ? MonthsEn : MonthsAf;
        if (days.Count == 0) return en ? "29 April to 1 May 2027" : "29 April tot 1 Mei 2027";
        var a = days.Min(); var b = days.Max();
        return a == b ? $"{a.Day} {months[a.Month - 1]} {a.Year}"
            : $"{a.Day} {(a.Month == b.Month ? "" : months[a.Month - 1] + " ")}{(en ? "to" : "tot")} {b.Day} {months[b.Month - 1]} {b.Year}";
    }

    public static (string Html, string Text) Body(Entrant e, Order order, string dates, string? link, bool copy, string name, bool en)
    {
        static string H(string? v) => WebUtility.HtmlEncode(v ?? "");
        string T(string af, string english) => en ? english : af;
        var tariff = e.TariffKind == TariffKind.Student ? T("Student en skolier", "Student and scholar") : T("Normaal", "Normal");
        var route = e.RouteCategory?.Name ?? "";
        var intro = copy
            ? T($"Hierdie pas is vir {name}. Jy ontvang dit as die koper of rekeninghouer van die bestelling.", $"This pass is for {name}. You are receiving it as the buyer or account owner of the order.")
            : T($"Hallo {e.FirstName}, hier is jou Vasbyt-pas.", $"Hello {e.FirstName}, here is your Vasbyt pass.");
        var how = T("Wys hierdie QR-kode by die registrasietent. Hou dit op jou selfoon of druk dit uit, en draai die skerm se helderheid op.",
            "Show this QR code at the registration tent. Keep it on your phone or print it, and turn the screen brightness up.");
        var viewLabel = T("Bekyk die bestelling", "View the order");
        string Row(string label, string value) =>
            $"<tr><td style=\"padding:6px 0;color:{Muted};font-size:16px\">{H(label)}</td><td align=\"right\" style=\"padding:6px 0;color:{Deep};font-size:16px;font-weight:bold\">{H(value)}</td></tr>";
        var linkHtml = link is null ? "" :
            $"<p style=\"margin:20px 0 0;font-size:16px\"><a href=\"{H(link)}\" style=\"color:{Orange};font-weight:bold\">{viewLabel}</a></p>";
        var title = T("Jou Vasbyt-pas", "Your Vasbyt pass");
        var html = $"""
<!doctype html><html lang="{(en ? "en" : "af")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>{H(title)}</title></head>
<body style="margin:0;padding:0;background:{Canvas};font-family:Arial,Helvetica,sans-serif;color:{Deep}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{Canvas}"><tr><td align="center" style="padding:16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{Paper};border-radius:12px">
<tr><td style="padding:24px 24px 8px"><p style="margin:0;font-size:16px;font-weight:bold;color:{Indigo}">Orania Helpmekaar Vasbyt 2027</p>
<h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;color:{Deep}">{H(name)}</h1>
<p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:{Muted}">{H(intro)}</p></td></tr>
<tr><td align="center" style="padding:16px 24px"><img src="cid:vasbyt-qr" width="240" height="240" alt="QR" style="display:block;width:240px;max-width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:0 24px"><p style="margin:0;text-align:center;font-size:20px;font-weight:bold;color:{Indigo}">{H(e.EntryNumber)}</p></td></tr>
<tr><td style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid {Rule}">
{Row(T("Roete", "Route"), route)}{Row(T("Tarief", "Tariff"), tariff)}{Row(T("Datums", "Dates"), dates)}{Row(T("Bestelling", "Order"), order.Reference)}</table></td></tr>
<tr><td style="padding:16px 24px 24px"><p style="margin:0;font-size:16px;line-height:1.5">{H(how)}</p>{linkHtml}
<p style="margin:20px 0 0;font-size:16px;color:{Muted}">{H(T($"Die QR-kode is ook as aanhangsel (vasbyt-{e.EntryNumber}.png) aangeheg om te stoor.", $"The QR code is also attached (vasbyt-{e.EntryNumber}.png) so you can save it."))}</p></td></tr>
</table></td></tr></table></body></html>
""";
        var text = $"""
Orania Helpmekaar Vasbyt 2027

{name}
{intro}

{T("Inskrywingsnommer", "Entry number")}: {e.EntryNumber}
{T("Roete", "Route")}: {route}
{T("Tarief", "Tariff")}: {tariff}
{T("Datums", "Dates")}: {dates}
{T("Bestelling", "Order")}: {order.Reference}

{how}
{T($"Die QR-kode is as aanhangsel (vasbyt-{e.EntryNumber}.png) aangeheg.", $"The QR code is attached (vasbyt-{e.EntryNumber}.png).")}
{(link is null ? "" : T("Bekyk", "View") + ": " + link)}
""";
        return (html, text);
    }
}
