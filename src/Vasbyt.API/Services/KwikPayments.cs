using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Kwik hosted checkout (https://docs.kwik.co.za/v2/money-in/checkout-link). Nothing Kwik sends us is
/// trusted: a redirect or webhook only prompts a server-side lookup of the transaction by our reference.
public class KwikPayments(HttpClient http, IConfiguration cfg, ILogger<KwikPayments> log)
{
    private const string Api = "https://api.kwik.co.za/2.0/";

    public bool Enabled => IsEnabled(cfg);
    public static bool IsEnabled(IConfiguration cfg) =>
        !string.IsNullOrWhiteSpace(cfg["Kwik:ApiKey"]) && !string.IsNullOrWhiteSpace(cfg["Kwik:ApiSecret"]) &&
        Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out _);

    /// The hosted checkout URL to send the buyer to, or null when Kwik refused.
    // ponytail: every click makes a fresh link, so a buyer could pay two tabs; the 30 minute expiry narrows it, refund the second by hand.
    public async Task<string?> CreateLinkAsync(Order order)
    {
        var root = new Uri(cfg["Public:BaseUrl"]!);
        string Url(string path) => new Uri(root, path).AbsoluteUri;
        var back = $"/registreer/betaal?bestelling={order.PublicToken:D}&kwik=";
        var body = new
        {
            type = "CHOOSE_WHAT_TO_PAY",
            item = new
            {
                title = $"Vasbyt {order.Reference}",
                description = string.Join(", ", order.Lines.OrderBy(l => l.Id).Select(l => $"{l.Quantity} x {l.Description}")),
                amount = Amount(order.TotalZar),
            },
            transaction_reference = order.Reference,
            customer = new
            {
                email = order.BuyerEmail,
                person_name = Clip(order.BuyerFirstName, 32),
                person_surname = Clip(order.BuyerLastName, 32),
            },
            notification = new { webhook_url = Url("/api/payments/kwik/webhook") },
            redirects = new { success_url = Url(back + "terug"), cancel_url = Url(back + "gekanselleer") },
            settings = new { expiry_time = 30 },
            metadata = new { order_token = order.PublicToken.ToString("D") },
        };
        try
        {
            using var response = await http.SendAsync(Request(HttpMethod.Post, "checkout/link", JsonContent.Create(body)));
            var json = await response.Content.ReadAsStringAsync();
            if (response.IsSuccessStatusCode &&
                JsonDocument.Parse(json).RootElement.TryGetProperty("result", out var result) &&
                result.TryGetProperty("link_url", out var link) && link.GetString() is { Length: > 0 } url)
                return url;
            log.LogWarning("Kwik checkout link for {Reference} failed: {Status} {Body}", order.Reference, response.StatusCode, json);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogWarning("Kwik checkout link for {Reference} unavailable: {Error}", order.Reference, e.GetType().Name);
        }
        return null;
    }

    /// Kwik's transaction id when our reference is PAID for the full amount, otherwise null.
    public async Task<string?> PaidTransactionAsync(Order order)
    {
        try
        {
            using var response = await http.SendAsync(Request(HttpMethod.Get, $"transactions/record/{Uri.EscapeDataString(order.Reference)}"));
            if (!response.IsSuccessStatusCode) return null;
            var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
            if (!root.TryGetProperty("transaction", out var t)) return null;
            return Str(t, "transaction_status") == "PAID" && Str(t, "transaction_reference") == order.Reference &&
                   t.TryGetProperty("amount", out var amount) && Decimal(amount) == order.TotalZar
                ? Str(t, "id") : null;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or FormatException)
        {
            log.LogWarning("Kwik lookup for {Reference} unavailable: {Error}", order.Reference, e.GetType().Name);
            return null;
        }
    }

    /// Finds the order token we put in metadata, whatever shape the webhook event wraps it in.
    public static Guid? WebhookOrderToken(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Object => e.EnumerateObject().Select(p =>
            p.Name == "order_token" && Guid.TryParse(p.Value.ToString(), out var g) ? g : WebhookOrderToken(p.Value))
            .FirstOrDefault(g => g is not null),
        JsonValueKind.Array => e.EnumerateArray().Select(WebhookOrderToken).FirstOrDefault(g => g is not null),
        _ => null,
    };

    private HttpRequestMessage Request(HttpMethod method, string path, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, Api + path) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{cfg["Kwik:ApiKey"]}:{cfg["Kwik:ApiSecret"]}")));
        return request;
    }

    private static string Amount(decimal zar) => zar.ToString("0.00", CultureInfo.InvariantCulture);
    private static string Clip(string s, int max) => s.Length <= max ? s : s[..max];
    private static string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) ? v.ToString() : null;
    private static decimal Decimal(JsonElement e) =>
        e.ValueKind == JsonValueKind.Number ? e.GetDecimal() : decimal.Parse(e.GetString()!, CultureInfo.InvariantCulture);
}
