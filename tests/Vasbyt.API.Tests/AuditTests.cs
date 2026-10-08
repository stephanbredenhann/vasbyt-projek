using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Vasbyt.API.Tests;

/// Regressions for the September 2026 audit of the order and QR subsystems.
public class AuditTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Demo_payment_is_refused_when_switched_off()
    {
        var closed = factory.WithWebHostBuilder(b => b.UseSetting("Payments:DemoEnabled", "false"));
        var client = closed.CreateClient();
        var token = await NewOrder(client, 1);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).StatusCode);
        var config = await client.GetFromJsonAsync<JsonElement>("/api/config");
        Assert.False(config.GetProperty("demoPayments").GetBoolean());
    }

    [Fact]
    public async Task Parallel_payments_create_one_form_per_ticket()
    {
        var client = factory.CreateClient();
        var token = await NewOrder(client, 3);
        var responses = await Task.WhenAll(Enumerable.Range(0, 6)
            .Select(_ => client.PostAsync($"/api/orders/{token}/pay-demo", null)));
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var order = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.Equal(3, order.GetProperty("entrants").GetArrayLength());
    }

    [Theory]
    [InlineData(21)]
    [InlineData(int.MaxValue)]
    public async Task Oversized_quantities_are_a_400_not_a_500(int quantity)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "koper@example.test",
            Tickets = new[]
            {
                new { RouteCategoryId = factory.RouteId("ligdraf"), TariffKind = "Normal", Quantity = quantity },
                new { RouteCategoryId = factory.RouteId("vastrap"), TariffKind = "Normal", Quantity = quantity },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Huge_donations_are_refused_and_cents_are_rounded()
    {
        var client = factory.CreateClient();
        var huge = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "koper@example.test", DonationZar = 5_000_000m,
        });
        Assert.Equal(HttpStatusCode.BadRequest, huge.StatusCode);

        var odd = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "koper@example.test", DonationZar = 12.345m,
        });
        odd.EnsureSuccessStatusCode();
        Assert.Equal(12.34m, (await odd.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("totalZar").GetDecimal());
    }

    [Fact]
    public async Task A_checked_in_form_can_no_longer_be_rewritten_and_check_in_can_be_undone()
    {
        var client = factory.CreateClient();
        var token = await NewOrder(client, 1);
        var paid = await (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).Content.ReadFromJsonAsync<JsonElement>();
        var id = paid.GetProperty("entrants")[0].GetProperty("id").GetInt32();
        (await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{id}", Form("Anna"))).EnsureSuccessStatusCode();

        var admin = await factory.AdminClientAsync("audit@example.test");
        var checkedIn = await (await admin.PostAsync($"/api/admin/entrants/{id}/check-in", null)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("audit@example.test", checkedIn.GetProperty("checkedInBy").GetString());

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{id}", Form("Mallory"))).StatusCode);

        var undone = await (await admin.DeleteAsync($"/api/admin/entrants/{id}/check-in")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, undone.GetProperty("checkedInUtc").ValueKind);
        (await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{id}", Form("Anna"))).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Scan_masks_all_but_the_last_four_id_digits()
    {
        var client = factory.CreateClient();
        var token = await NewOrder(client, 1);
        var paid = await (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).Content.ReadFromJsonAsync<JsonElement>();
        var id = paid.GetProperty("entrants")[0].GetProperty("id").GetInt32();
        var done = await (await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{id}", Form("Anna")))
            .Content.ReadFromJsonAsync<JsonElement>();
        var admin = await factory.AdminClientAsync("mask@example.test");
        var scan = await (await admin.PostAsJsonAsync("/api/admin/scan",
            new { Code = done.GetProperty("entrants")[0].GetProperty("entryNumber").GetString() })).Content.ReadFromJsonAsync<JsonElement>();
        var shown = scan.GetProperty("idNumber").GetString()!;
        Assert.EndsWith("0086", shown);
        Assert.DoesNotContain("85031258", shown);
    }

    [Fact]
    public async Task Each_route_day_serves_its_own_gpx()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/routes/vastrap/days/2/gpx");
        response.EnsureSuccessStatusCode();
        Assert.Contains("<trkpt", await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/routes/vastrap/days/9/gpx")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/routes/vasstap/days/1/gpx")).StatusCode);
    }

    private async Task<string> NewOrder(HttpClient client, int quantity)
    {
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "koper@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligdraf"), TariffKind = "Normal", Quantity = quantity } },
        });
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }

    private static object Form(string first) => new
    {
        FirstName = first, LastName = "Toets", IdNumber = "8503125800086",
        Email = "anna@example.test", Phone = "0821234567", DateOfBirth = "1985-03-12",
        Gender = "V", ShirtSize = "M", StreetAddress = "Dorpstraat 1", Town = "Orania",
        Province = "Noord-Kaap", PostalCode = "8752", EmergencyName = "Jan",
        EmergencyRelationship = "Man", EmergencyPhone = "0827654321", AcceptTerms = true, PhotoConsent = false,
    };
}
