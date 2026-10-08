using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class KwikPaymentTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Redirect_return_and_webhook_only_mark_paid_when_Kwik_confirms_the_full_amount()
    {
        var kwik = new KwikHandler();
        using var host = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.AddScoped(_ => new KwikPayments(new HttpClient(kwik), new ConfigurationBuilder().AddInMemoryCollection(
                new Dictionary<string, string?> { ["Kwik:ApiKey"] = "key", ["Kwik:ApiSecret"] = "secret", ["Public:BaseUrl"] = "https://vasbyt.example" })
                .Build(), NullLogger<KwikPayments>.Instance))));
        using var client = host.CreateClient();
        var order = await (await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Anna", LastName = "Kwik", Email = "kwik@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        })).Content.ReadFromJsonAsync<JsonElement>();
        var token = order.GetProperty("token").GetString();
        var reference = order.GetProperty("reference").GetString()!;
        var total = order.GetProperty("totalZar").GetDecimal();

        var link = await (await client.PostAsync($"/api/orders/{token}/pay", null)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("https://pay.kwik.example/chk", link.GetProperty("url").GetString());
        Assert.Equal("Basic a2V5OnNlY3JldA==", kwik.Authorization);
        using (var sent = JsonDocument.Parse(kwik.Body!))
        {
            Assert.Equal(reference, sent.RootElement.GetProperty("transaction_reference").GetString());
            Assert.Equal(total.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), sent.RootElement.GetProperty("item").GetProperty("amount").GetString());
            Assert.Equal($"https://vasbyt.example/registreer/betaal?bestelling={token}&kwik=terug",
                sent.RootElement.GetProperty("redirects").GetProperty("success_url").GetString());
        }

        // Paid for less than the order total: stays Pending.
        kwik.Transaction = new { id = "tra_short", transaction_status = "PAID", transaction_reference = reference, amount = total - 1 };
        Assert.Equal("Pending", await Status(await client.PostAsync($"/api/orders/{token}/pay/verify", null)));

        // A webhook naming the order prompts a lookup; Kwik now confirms the full amount.
        kwik.Transaction = new { id = "tra_ok", transaction_status = "PAID", transaction_reference = reference, amount = total };
        (await client.PostAsJsonAsync("/api/payments/kwik/webhook", new
        {
            @event = "checkout.completed", data = new[] { new { checkout = new { metadata = new { order_token = token } } } },
        })).EnsureSuccessStatusCode();
        var paid = await (await client.GetAsync($"/api/orders/{token}")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Paid", paid.GetProperty("status").GetString());
        Assert.Equal(1, paid.GetProperty("entrants").GetArrayLength());

        // Returning after the webhook is harmless and creates no extra forms.
        var again = await (await client.PostAsync($"/api/orders/{token}/pay/verify", null)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, again.GetProperty("entrants").GetArrayLength());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/orders/{token}/pay", null)).StatusCode);
    }

    private static async Task<string?> Status(HttpResponseMessage r) =>
        (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString();

    private class KwikHandler : HttpMessageHandler
    {
        public object? Transaction { get; set; }
        public string? Body { get; private set; }
        public string? Authorization { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Authorization = request.Headers.Authorization?.ToString();
            if (request.Method == HttpMethod.Post)
            {
                Body = await request.Content!.ReadAsStringAsync(cancellationToken);
                return new(HttpStatusCode.OK) { Content = JsonContent.Create(new { status = true, result = new { link_url = "https://pay.kwik.example/chk" } }) };
            }
            return Transaction is null
                ? new(HttpStatusCode.NotFound)
                : new(HttpStatusCode.OK) { Content = JsonContent.Create(new { status = true, transaction = Transaction }) };
        }
    }
}
