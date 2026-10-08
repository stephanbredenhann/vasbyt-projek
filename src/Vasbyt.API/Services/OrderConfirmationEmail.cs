using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

public class OrderConfirmationEmail(HttpClient http, IConfiguration cfg, ILogger<OrderConfirmationEmail> log)
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
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            var phase = order.Lines.SelectMany(l => l.Entrants).All(e => e.IsComplete) ? "registration" : "payment";
            request.Headers.Add("Idempotency-Key", $"vasbyt-{phase}/{order.PublicToken:D}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            request.Content = JsonContent.Create(new
            {
                from = cfg["Resend:From"] ?? "Vasbyt <geenantwoord@vasbyt.co.za>",
                to = new[] { order.BuyerEmail }, subject = $"Vasbyt 2027: {order.Reference}", html = Body(order, link),
            });
            using var response = await http.SendAsync(request);
            if (response.IsSuccessStatusCode) return true;
            log.LogWarning("Order confirmation delivery failed for {Reference}: {Status}", order.Reference, response.StatusCode);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning("Order confirmation delivery unavailable for {Reference}: {Error}", order.Reference, e.GetType().Name);
        }
        return false;
    }

    private static string Body(Order order, string link)
    {
        static string Encode(string? value) => WebUtility.HtmlEncode(value ?? "");
        static string Money(decimal value) => "R" + value.ToString("N2", CultureInfo.GetCultureInfo("en-ZA"));
        var html = new StringBuilder("<div style=\"font-family:Arial,sans-serif;color:#1d1e58;max-width:640px\"><h1>Orania Helpmekaar Vasbyt 2027</h1>");
        if (order.PaymentReference?.StartsWith("DEMO-", StringComparison.Ordinal) == true) html.Append("<p><strong>Demonstrasie. Geen werklike betaling is verwerk nie.</strong></p>");
        html.Append($"<p>Dankie, {Encode(order.BuyerFirstName)}. Jou betaling is ontvang.</p><p><strong>{Encode(order.Reference)}</strong></p>");
        html.Append($"<p>Betaal op {order.PaidUtc?.AddHours(2):yyyy-MM-dd HH:mm}, betalingsverwysing {Encode(order.PaymentReference)}</p><ul>");
        foreach (var line in order.Lines.OrderBy(l => l.Id))
            html.Append($"<li>{line.Quantity} × {Encode(line.Description)}: {Money(line.LineTotalZar)}</li>");
        html.Append($"</ul><p><strong>Totaal: {Money(order.TotalZar)}</strong></p>");
        var entrants = order.Lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).ToArray();
        if (entrants.Any(e => !e.IsComplete))
            html.Append("<p>Vul nog die deelnemersvorms in om elke deelnemer se QR-pas te ontvang.</p>");
        else if (entrants.Length > 0)
        {
            html.Append("<h2>Jou deelnemers</h2><ul>");
            foreach (var entrant in entrants)
                html.Append($"<li>{Encode(entrant.FirstName)} {Encode(entrant.LastName)}: {Encode(entrant.EntryNumber)}</li>");
            html.Append("</ul><p>Laai elke deelnemer se QR-pas by die skakel hieronder af en wys dit by die registrasietent.</p>");
        }
        html.Append($"<p><a href=\"{Encode(link)}\">Bekyk jou opsomming, voltooi vorms en stoor QR-passe</a></p><p>Hou hierdie private skakel en jou verwysingsnommer veilig.</p></div>");
        return html.ToString();
    }
}
