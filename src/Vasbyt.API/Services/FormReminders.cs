using System.Net;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Nudges buyers about unfinished participant forms, a day and a week after payment, never more.
public class FormReminders(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<FormReminders> log) : BackgroundService
{
    public static readonly TimeSpan[] After = [TimeSpan.FromDays(1), TimeSpan.FromDays(7)];

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await RunAsync(scope.ServiceProvider.GetRequiredService<VasbytDbContext>(),
                    scope.ServiceProvider.GetRequiredService<ResendClient>(), cfg, DateTime.UtcNow, stop);
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Form reminders failed"); }
        } while (await timer.WaitForNextTickAsync(stop));
    }

    /// Sends the reminders due at now. An order that is already a week overdue gets one email, not two.
    public static async Task<int> RunAsync(VasbytDbContext db, ResendClient resend, IConfiguration cfg, DateTime now,
        CancellationToken ct = default)
    {
        if (!OrderConfirmationEmail.IsEnabled(cfg)) return 0;
        var root = new Uri(cfg["Public:BaseUrl"]!);
        var first = now - After[0];
        var orders = await db.Orders.Include(o => o.Lines).ThenInclude(l => l.Entrants)
            .Where(o => o.Status == OrderStatus.Paid && o.FormRemindersSent < After.Length && o.PaidUtc <= first &&
                o.Lines.Any(l => l.Entrants.Any(e => !e.IsComplete)))
            .ToListAsync(ct);
        var sent = 0;
        foreach (var order in orders)
        {
            var due = After.Count(a => order.PaidUtc <= now - a);
            if (due <= order.FormRemindersSent) continue;
            var (subject, html, text) = Body(order, new Uri(root, $"/registreer/{order.PublicToken:D}/klaar").AbsoluteUri);
            if (!await resend.SendAsync(order.BuyerEmail, subject, html, text,
                    idempotencyKey: $"vasbyt-reminder/{order.PublicToken:D}/{due}", maxAttempts: 1)) continue;
            order.FormRemindersSent = due;
            await db.SaveChangesAsync(ct);
            sent++;
        }
        return sent;
    }

    public static (string Subject, string Html, string Text) Body(Order order, string link)
    {
        var en = order.Language == "en";
        string T(string af, string english) => en ? english : af;
        static string H(string v) => WebUtility.HtmlEncode(v);
        var open = order.Lines.SelectMany(l => l.Entrants).Count(e => !e.IsComplete);
        var subject = T($"Vasbyt 2027: {open} deelnemersvorm(s) nog oop", $"Vasbyt 2027: {open} participant form(s) still open");
        var body = T($"Jou betaling vir {order.Reference} is ontvang, maar {open} deelnemersvorm(s) is nog nie ingevul nie. Elke deelnemer kry eers 'n QR-pas wanneer sy vorm klaar is. Wat reeds ingetik is, is gestoor.",
            $"Your payment for {order.Reference} was received, but {open} participant form(s) are not filled in yet. Each participant gets a QR pass once their form is done. Anything already typed has been saved.");
        var action = T("Vul die vorms in", "Fill in the forms");
        var html = $"""
<!doctype html><html lang="{(en ? "en" : "af")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vasbyt</title></head>
<body style="margin:0;padding:16px;background:{PassEmail.Canvas};font-family:Arial,Helvetica,sans-serif;color:{PassEmail.Deep}">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:{PassEmail.Paper};border-radius:12px"><tr><td style="padding:24px">
<p style="margin:0;font-size:17px;font-weight:bold;color:{PassEmail.Indigo}">Orania Helpmekaar Vasbyt 2027</p>
<h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">{H(T("Hallo", "Hello"))} {H(order.BuyerFirstName)}</h1>
<p style="margin:12px 0 0;font-size:17px;line-height:1.5">{H(body)}</p>
<p style="margin:24px 0 0"><a href="{H(link)}" style="display:inline-block;padding:14px 24px;background:{PassEmail.Orange};color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;border-radius:8px">{H(action)}</a></p>
</td></tr></table></body></html>
""";
        return (subject, html, $"{body}\n{action}: {link}");
    }
}
