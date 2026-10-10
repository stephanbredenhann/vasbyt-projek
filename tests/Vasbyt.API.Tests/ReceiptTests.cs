using System.Net.Http.Json;
using System.Text.Json;

namespace Vasbyt.API.Tests;

public class ReceiptTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Receipt_carries_paid_time_only_once_paid()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "kwitansie@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        });
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();

        var pending = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.Equal(JsonValueKind.Null, pending.GetProperty("paidUtc").ValueKind);

        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        var paid = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.True(paid.GetProperty("paidUtc").GetDateTime() > DateTime.UtcNow.AddMinutes(-5));
    }
}
