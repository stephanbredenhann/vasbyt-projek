using System.Globalization;
using System.Net;
using System.Text;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

public class OrderConfirmationEmail(ResendClient resend, IConfiguration cfg, ILogger<OrderConfirmationEmail> log, AccountClaim? claim = null)
{
    public bool Enabled => IsEnabled(cfg);
    public static bool IsEnabled(IConfiguration cfg) => !cfg.GetValue<bool>("Demo:Enabled") &&
        !string.IsNullOrWhiteSpace(cfg["Resend:ApiKey"]) && Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out var root) && root.Scheme == "https";

    public async Task<bool> SendAsync(Order order)
    {
        var key = cfg["Resend:ApiKey"];
        if (cfg.GetValue<bool>("Demo:Enabled") || string.IsNullOrWhiteSpace(key) || order.Status != OrderStatus.Paid ||
            !Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out var root) || root.Scheme != "https") return false;
        var link = new Uri(root, $"/registreer/{order.PublicToken:D}/klaar").AbsoluteUri;
        var phase = order.Lines.SelectMany(l => l.Entrants).All(e => e.IsComplete) ? "registration" : "payment";
        var (html, text) = Body(order, link, order.UserId is null ? claim?.Link(root, order.BuyerEmail) : null);
        if (await resend.SendAsync(order.BuyerEmail, $"Vasbyt 2027: {order.Reference}", html, text,
            idempotencyKey: $"vasbyt-{phase}/{order.PublicToken:D}", maxAttempts: 1)) return true;
        log.LogWarning("Order confirmation delivery failed for {Reference}", order.Reference);
        return false;
    }

    /// accountLink is the "create your account" link, only for an order no account owns yet.
    public static (string Html, string Text) Body(Order order, string link, string? accountLink = null)
    {
        static string H(string? v) => WebUtility.HtmlEncode(v ?? "");
        var en = order.Language == "en";
        string T(string af, string english) => en ? english : af;
        static string Money(decimal v) => "R" + v.ToString("N2", CultureInfo.GetCultureInfo("en-ZA"));
        var lines = order.Lines.OrderBy(l => l.Id).ToArray();
        var entrants = lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).ToArray();
        var hasTickets = lines.Any(l => l.Kind == OrderLineKind.Ticket);
        var hasProducts = lines.Any(l => l.Kind == OrderLineKind.Product);
        var demo = order.PaymentReference?.StartsWith("DEMO-", StringComparison.Ordinal) == true;
        var local = order.PaidUtc?.AddHours(2);
        var paid = local is { } t ? $"{t.Day} {(en ? PassEmail.MonthsEn : PassEmail.MonthsAf)[t.Month - 1]} {t.Year}, {t:HH:mm}" : "";

        var next = new List<string>();
        if (entrants.Any(e => !e.IsComplete))
            next.Add(T("Vul die deelnemersvorms in. Elke deelnemer kry dan 'n eie QR-pas.", "Fill in the participant forms. Each participant then gets their own QR pass."));
        else if (entrants.Length > 0)
            next.Add(T("Stoor of druk elke deelnemer se QR-pas en wys dit by die registrasietent.", "Save or print each participant's QR pass and show it at the registration tent."));
        if (hasProducts)
            next.Add(T("Haal jou produkte by die Vasbyt-geleentheid af. Bring jou verwysingsnommer. 'n Inskrywing is nie nodig nie.", "Collect your products at the Vasbyt event. Bring your reference number. You do not need an entry."));
        var donationOnly = !hasTickets && !hasProducts;
        var thanks = T("Dankie vir jou donasie aan Orania Helpmekaar.", "Thank you for your donation to Orania Helpmekaar.");
        var action = hasTickets ? T("Bestuur jou bestelling en QR-passe", "View your order and QR passes")
            : hasProducts ? T("Sien jou bestelling", "View your order") : T("Sien jou kwitansie", "View your receipt");

        string Row(string label, string value, bool total = false) =>
            $"<tr><td style=\"padding:10px 0;border-top:1px solid {PassEmail.Rule};font-size:17px;color:{PassEmail.Deep}{(total ? ";font-weight:bold" : "")}\">{H(label)}</td>" +
            $"<td align=\"right\" style=\"padding:10px 0;border-top:1px solid {PassEmail.Rule};font-size:17px;color:{PassEmail.Deep};font-weight:bold;white-space:nowrap\">{H(value)}</td></tr>";
        var rows = string.Concat(lines.Select(l => Row($"{l.Quantity} × {l.Description}", Money(l.LineTotalZar))))
            + Row(T("Totaal", "Total"), Money(order.TotalZar), total: true);
        var people = entrants.Length > 0 && entrants.All(e => e.IsComplete)
            ? $"<h2 style=\"margin:24px 0 8px;font-size:20px;color:{PassEmail.Deep}\">{H(T("Jou deelnemers", "Your participants"))}</h2><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">"
              + string.Concat(entrants.Select(e => Row($"{e.FirstName} {e.LastName}", e.EntryNumber ?? ""))) + "</table>"
            : "";
        var steps = donationOnly ? "" :
            $"<h2 style=\"margin:24px 0 8px;font-size:20px\">{H(T("Wat om nou te doen", "What to do next"))}</h2>" +
            "<ol style=\"margin:0;padding-left:22px;font-size:17px;line-height:1.5\">" +
            string.Concat(next.Select(s => $"<li style=\"margin:0 0 8px\">{H(s)}</li>")) + "</ol>";

        var accountTitle = T("Bestuur jou inskrywings later", "Manage your entries later");
        var accountBody = T("Skep jou rekening met hierdie skakel om jou bestellings, vorms en QR-passe op een plek te hou. Het jy reeds 'n rekening? Die skakel voeg hierdie bestelling daarby.",
            "Create your account with this link to keep your orders, forms and QR passes in one place. Already have an account? The link adds this order to it.");
        var accountAction = T("Skep jou rekening", "Create your account");
        var account = accountLink is null ? "" :
            $"<h2 style=\"margin:24px 0 8px;font-size:20px\">{H(accountTitle)}</h2>" +
            $"<p style=\"margin:0;font-size:17px;line-height:1.5\">{H(accountBody)}</p>" +
            $"<p style=\"margin:12px 0 0\"><a href=\"{H(accountLink)}\" style=\"font-size:17px;font-weight:bold;color:{PassEmail.Indigo}\">{H(accountAction)}</a></p>";

        var html = $"""
<!doctype html><html lang="{(en ? "en" : "af")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Vasbyt 2027</title></head>
<body style="margin:0;padding:0;background:{PassEmail.Canvas};font-family:Arial,Helvetica,sans-serif;color:{PassEmail.Deep}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PassEmail.Canvas}"><tr><td align="center" style="padding:16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{PassEmail.Paper};border-radius:12px"><tr><td style="padding:24px">
<p style="margin:0;font-size:17px;font-weight:bold;color:{PassEmail.Indigo}">Orania Helpmekaar Vasbyt 2027</p>
{(demo ? $"<p style=\"margin:12px 0 0;font-size:17px;font-weight:bold\">{H(T("Demonstrasie. Geen werklike betaling is verwerk nie.", "Demonstration. No real payment was processed."))}</p>" : "")}
<h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">{H(T("Dankie", "Thank you"))}, {H(order.BuyerFirstName)}</h1>
<p style="margin:12px 0 0;font-size:17px;line-height:1.5">{H(T("Jou betaling is ontvang.", "Your payment was received."))}</p>
{(donationOnly ? $"<p style=\"margin:12px 0 0;font-size:17px;line-height:1.5\">{H(thanks)}</p>" : "")}
<p style="margin:20px 0 0;font-size:17px;color:{PassEmail.Muted}">{H(T("Verwysingsnommer", "Reference number"))}</p>
<p style="margin:4px 0 0;font-size:28px;font-weight:bold;letter-spacing:1px">{H(order.Reference)}</p>
<p style="margin:8px 0 0;font-size:17px">{H(T("Betaal op", "Paid on"))} {H(paid)}. {H(T("Betalingsverwysing", "Payment reference"))}: {H(order.PaymentReference)}</p>
{steps}
<p style="margin:24px 0 0"><a href="{H(link)}" style="display:inline-block;padding:14px 24px;background:{PassEmail.Orange};color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;border-radius:8px">{H(action)}</a></p>
<h2 style="margin:24px 0 8px;font-size:20px">{H(T("Wat jy gekoop het", "What you bought"))}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
{people}
{account}
<p style="margin:24px 0 0;font-size:16px;color:{PassEmail.Muted}">{H(T("Hou hierdie e-pos en jou verwysingsnommer veilig. Die knoppie is jou private skakel na die bestelling.", "Keep this email and your reference number safe. The button is your private link to the order."))}</p>
</td></tr></table></td></tr></table></body></html>
""";

        var text = new StringBuilder();
        text.AppendLine("Orania Helpmekaar Vasbyt 2027").AppendLine();
        if (demo) text.AppendLine(T("Demonstrasie. Geen werklike betaling is verwerk nie.", "Demonstration. No real payment was processed.")).AppendLine();
        text.AppendLine($"{T("Dankie", "Thank you")}, {order.BuyerFirstName}. {T("Jou betaling is ontvang.", "Your payment was received.")}");
        text.AppendLine($"{T("Verwysingsnommer", "Reference number")}: {order.Reference}");
        text.AppendLine($"{T("Betaal op", "Paid on")} {paid}").AppendLine();
        if (donationOnly) text.AppendLine(thanks);
        else
        {
            text.AppendLine(T("Wat om nou te doen:", "What to do next:"));
            for (var i = 0; i < next.Count; i++) text.AppendLine($"{i + 1}. {next[i]}");
        }
        text.AppendLine().AppendLine($"{action}: {link}").AppendLine();
        foreach (var l in lines) text.AppendLine($"{l.Quantity} x {l.Description}: {Money(l.LineTotalZar)}");
        text.AppendLine($"{T("Totaal", "Total")}: {Money(order.TotalZar)}");
        if (people.Length > 0)
            foreach (var e in entrants) text.AppendLine($"{e.FirstName} {e.LastName}: {e.EntryNumber}");
        if (accountLink is not null) text.AppendLine().AppendLine(accountTitle).AppendLine(accountBody).AppendLine($"{accountAction}: {accountLink}");
        return (html, text.ToString());
    }
}
