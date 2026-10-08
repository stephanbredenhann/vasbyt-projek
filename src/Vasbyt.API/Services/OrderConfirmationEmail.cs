using System.Globalization;
using System.Net;
using System.Text;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

public class OrderConfirmationEmail(ResendClient resend, IConfiguration cfg, ILogger<OrderConfirmationEmail> log)
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
        if (await resend.SendAsync(order.BuyerEmail, $"Vasbyt 2027: {order.Reference}", Body(order, link),
            idempotencyKey: $"vasbyt-{phase}/{order.PublicToken:D}", maxAttempts: 1)) return true;
        log.LogWarning("Order confirmation delivery failed for {Reference}", order.Reference);
        return false;
    }

    private static string Body(Order order, string link)
    {
        static string Encode(string? value) => WebUtility.HtmlEncode(value ?? "");
        var en = order.Language == "en";
        string T(string af, string english) => en ? english : af;
        static string Money(decimal value) => "R" + value.ToString("N2", CultureInfo.GetCultureInfo("en-ZA"));
        var html = new StringBuilder("<div style=\"font-family:Arial,sans-serif;color:#1d1e58;max-width:640px\"><h1>Orania Helpmekaar Vasbyt 2027</h1>");
        if (order.PaymentReference?.StartsWith("DEMO-", StringComparison.Ordinal) == true) html.Append("<p><strong>" + T("Demonstrasie. Geen werklike betaling is verwerk nie.", "Demonstration. No real payment was processed.") + "</strong></p>");
        html.Append($"<p>{T("Dankie", "Thank you")}, {Encode(order.BuyerFirstName)}. {T("Jou betaling is ontvang.", "Your payment was received.")}</p><p><strong>{Encode(order.Reference)}</strong></p><ul>");
        foreach (var line in order.Lines.OrderBy(l => l.Id))
            html.Append($"<li>{line.Quantity} × {Encode(line.Description)}: {Money(line.LineTotalZar)}</li>");
        html.Append($"</ul><p><strong>{T("Totaal", "Total")}: {Money(order.TotalZar)}</strong></p>");
        var entrants = order.Lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).ToArray();
        if (entrants.Any(e => !e.IsComplete))
            html.Append("<p>" + T("Vul nog die deelnemersvorms in om elke deelnemer se QR-pas te ontvang.", "Please complete the participant forms to receive each participant's QR pass.") + "</p>");
        else if (entrants.Length > 0)
        {
            html.Append($"<h2>{T("Jou deelnemers", "Your participants")}</h2><ul>");
            foreach (var entrant in entrants)
                html.Append($"<li>{Encode(entrant.FirstName)} {Encode(entrant.LastName)}: {Encode(entrant.EntryNumber)}</li>");
            html.Append("</ul><p>" + T("Laai elke deelnemer se QR-pas by die skakel hieronder af en wys dit by die registrasietent.", "Download each participant's QR pass from the link below and show it at the registration tent.") + "</p>");
        }
        var hasTickets = order.Lines.Any(l => l.Kind == OrderLineKind.Ticket);
        var hasProducts = order.Lines.Any(l => l.Kind == OrderLineKind.Product);
        if (hasProducts)
            html.Append("<p>" + T("Haal jou produkte by die Vasbyt-geleentheid af. Hou jou verwysingsnommer byderhand. 'n Geleentheidskaartjie is nie nodig vir afhaal nie.", "Collect your products at the Vasbyt event. Keep your reference number handy. An event ticket is not needed for collection.") + "</p>");
        if (!hasTickets && !hasProducts)
            html.Append("<p>" + T("Dankie vir jou donasie aan Orania Helpmekaar.", "Thank you for your donation to Orania Helpmekaar.") + "</p>");
        var action = hasTickets ? T("Bekyk jou opsomming, voltooi vorms en stoor QR-passe", "View your summary, complete forms and save QR passes")
            : hasProducts ? T("Bekyk jou bestelopsomming", "View your order summary") : T("Bekyk jou donasiekwitansie", "View your donation receipt");
        html.Append($"<p><a href=\"{Encode(link)}\">{action}</a></p><p>" + T("Hou hierdie private skakel en jou verwysingsnommer veilig.", "Keep this private link and your reference number safe.") + "</p></div>");
        return html.ToString();
    }
}
