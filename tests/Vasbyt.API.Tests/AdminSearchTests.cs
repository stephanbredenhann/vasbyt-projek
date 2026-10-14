using System.Net.Http.Json;
using System.Text.Json;

namespace Vasbyt.API.Tests;

public class AdminSearchTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Orders_search_ignores_case_and_filters_by_status()
    {
        var admin = await factory.AdminClientAsync("search-orders@example.com");
        var buyer = factory.CreateClient();
        var paidToken = await Order(buyer, "Zelda", "Zuma-Soek", 2);
        (await buyer.PostAsync($"/api/orders/{paidToken}/pay-demo", null)).EnsureSuccessStatusCode();
        await Order(buyer, "Zelda", "Zuma-Soek", 1);

        var both = await admin.GetFromJsonAsync<JsonElement>("/api/admin/orders?q=zuma-soek");
        Assert.Equal(2, both.GetProperty("total").GetInt32());

        var paid = await admin.GetFromJsonAsync<JsonElement>("/api/admin/orders?q=ZUMA-SOEK&status=Paid");
        var row = Assert.Single(paid.GetProperty("items").EnumerateArray());
        Assert.Equal(2, row.GetProperty("formsOutstanding").GetInt32());

        var reference = row.GetProperty("reference").GetString()!.ToLowerInvariant();
        var byRef = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/orders?q={reference}");
        Assert.Equal(1, byRef.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Entrants_filter_by_route_on_the_server_and_match_order_reference()
    {
        var admin = await factory.AdminClientAsync("search-entrants@example.com");
        var buyer = factory.CreateClient();
        var token = await Order(buyer, "Rina", "Roete", 1, "ligtrap");
        var paid = await (await buyer.PostAsync($"/api/orders/{token}/pay-demo", null)).Content.ReadFromJsonAsync<JsonElement>();
        var reference = paid.GetProperty("reference").GetString()!;

        var hit = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/entrants?q={reference.ToLowerInvariant()}&routeCode=ligtrap");
        Assert.Equal(1, hit.GetProperty("total").GetInt32());

        var miss = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/entrants?q={reference}&routeCode=ligdraf");
        Assert.Equal(0, miss.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Packing_list_is_an_admin_only_pdf()
    {
        var admin = await factory.AdminClientAsync("packing-list@example.com");
        var buyer = factory.CreateClient();
        var token = await Order(buyer, "Pieter", "Pak", 2);
        (await buyer.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();

        var pdf = await admin.GetAsync("/api/admin/packing-list.pdf");
        pdf.EnsureSuccessStatusCode();
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(await pdf.Content.ReadAsByteArrayAsync(), 0, 4));
        if (Environment.GetEnvironmentVariable("PACKING_LIST_OUT") is { } path)
            await File.WriteAllBytesAsync(path, await pdf.Content.ReadAsByteArrayAsync());

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/admin/packing-list.pdf")).StatusCode);
    }

    private async Task<string> Order(HttpClient client, string first, string last, int quantity, string route = "ligtrap")
    {
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = first, LastName = last, Email = "soek@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId(route), TariffKind = "Normal", Quantity = quantity } },
        });
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }
}
