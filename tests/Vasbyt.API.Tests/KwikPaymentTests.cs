using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
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

        // A checkout link is refused when the order changed since the buyer reviewed it.
        var version = order.GetProperty("version").GetUInt32();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/orders/{token}/pay",
            new { Version = version + 1, ExpectedTotalZar = total })).StatusCode);

        var link = await (await client.PostAsJsonAsync($"/api/orders/{token}/pay",
            new { Version = version, ExpectedTotalZar = total })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("https://pay.kwik.example/chk", link.GetProperty("url").GetString());
        Assert.Equal("Basic a2V5OnNlY3JldA==", kwik.Authorization);
        using (var sent = JsonDocument.Parse(kwik.Body!))
        {
            Assert.Equal(reference, sent.RootElement.GetProperty("transaction_reference").GetString());
            Assert.Equal(total.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), sent.RootElement.GetProperty("item").GetProperty("amount").GetString());
            Assert.Equal($"https://vasbyt.example/bestel/{token}/betaal?kwik=terug",
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

    [Fact]
    public async Task A_started_payment_holds_its_stock_for_two_hours_only()
    {
        using var host = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.AddScoped(_ => new KwikPayments(new HttpClient(new KwikHandler()), new ConfigurationBuilder().AddInMemoryCollection(
                new Dictionary<string, string?> { ["Kwik:ApiKey"] = "key", ["Kwik:ApiSecret"] = "secret", ["Public:BaseUrl"] = "https://vasbyt.example" })
                .Build(), NullLogger<KwikPayments>.Instance))));
        using var client = host.CreateClient();
        int variantId;
        using (var scope = host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            var product = new Product { Name = "Hold", Variants = [new ProductVariant { Label = "One", PriceZar = 25m, Stock = 1, TrackStock = true }] };
            db.Products.Add(product);
            await db.SaveChangesAsync();
            variantId = product.Variants[0].Id;
        }
        async Task<JsonElement> NewOrder(string email) => await (await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Anna", LastName = "Hou", Email = email,
            Products = new[] { new { ProductVariantId = variantId, Quantity = 1 } },
        })).Content.ReadFromJsonAsync<JsonElement>();
        Task<HttpResponseMessage> Pay(JsonElement o) => client.PostAsJsonAsync($"/api/orders/{o.GetProperty("token")}/pay",
            new { Version = o.GetProperty("version").GetUInt32(), ExpectedTotalZar = o.GetProperty("totalZar").GetDecimal() });

        var first = await NewOrder("first@example.test");
        var second = await NewOrder("second@example.test");
        (await Pay(first)).EnsureSuccessStatusCode();

        // The first buyer's payment failed, but the last unit stays theirs while the hold runs.
        Assert.Equal(HttpStatusCode.Conflict, (await Pay(second)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders/quote",
            new { Products = new[] { new { ProductVariantId = variantId, Quantity = 1 } } })).StatusCode);

        // Retrying never extends the hold past two hours from the first attempt.
        var firstAgain = await (await client.GetAsync($"/api/orders/{first.GetProperty("token")}")).Content.ReadFromJsonAsync<JsonElement>();
        (await Pay(firstAgain)).EnsureSuccessStatusCode();
        using (var scope = host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            var held = db.Orders.Single(o => o.PublicToken == first.GetProperty("token").GetGuid());
            Assert.InRange(held.StockHeldUntilUtc!.Value - DateTime.UtcNow, TimeSpan.FromMinutes(119), TimeSpan.FromHours(2));
            held.StockHeldUntilUtc = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        }
        (await Pay(second)).EnsureSuccessStatusCode();
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
