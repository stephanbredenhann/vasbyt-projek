using System.Net;
using System.Net.Http.Json;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;

namespace Vasbyt.API.Tests;

/// The one rule the organisers were strict about: pay first, then add entrants, and never more
/// entrants than were paid for. If any of these three go green-to-red, the flow is broken.
public class PaymentGateTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public PaymentGateTests(VasbytFactory factory) => _factory = factory;

    private object Entrant(string first) => new
    {
        EventDistanceId = _factory.DistanceId,
        FirstName = first, LastName = "Toetser", Email = $"{first}@voorbeeld.co.za",
        Phone = "0821234567", DateOfBirth = "1990-04-12", Gender = "M", ShirtSize = "L",
        EmergencyName = "Ma", EmergencyPhone = "0827654321", MedicalNotes = (string?)null,
        Town = "Orania", Province = "Noord-Kaap", ClubName = (string?)null,
    };

    private async Task<(HttpClient client, Guid token)> NewOrder(int entrantCount)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/orders", new { EntrantCount = entrantCount });
        response.EnsureSuccessStatusCode();
        var order = await response.Content.ReadFromJsonAsync<OrderShape>();
        return (client, order!.Token);
    }

    [Fact]
    public async Task Adding_an_entrant_before_paying_is_refused()
    {
        var (client, token) = await NewOrder(2);

        var response = await client.PostAsJsonAsync($"/api/orders/{token}/entrants", Entrant("Anna"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Adding_more_entrants_than_were_paid_for_is_refused()
    {
        var (client, token) = await NewOrder(2);
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();

        foreach (var name in new[] { "Bea", "Carel" })
            (await client.PostAsJsonAsync($"/api/orders/{token}/entrants", Entrant(name)))
                .EnsureSuccessStatusCode();

        var third = await client.PostAsJsonAsync($"/api/orders/{token}/entrants", Entrant("Dirk"));

        Assert.Equal(HttpStatusCode.Conflict, third.StatusCode);
    }

    [Fact]
    public async Task Order_amount_is_the_flat_fee_times_the_number_of_places()
    {
        var (client, token) = await NewOrder(3);

        var order = await client.GetFromJsonAsync<OrderShape>($"/api/orders/{token}");

        Assert.Equal(Pricing.DefaultEntryFeeZar * 3, order!.AmountZar);
    }

    /// The fee is flat precisely so that payment can happen before anyone picks an event. Each
    /// person on one order may still choose a different one.
    [Fact]
    public async Task Entrants_on_one_order_may_each_pick_a_different_event()
    {
        var (client, token) = await NewOrder(2);
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();

        var first = Entrant("Elsa");
        var second = new
        {
            EventDistanceId = _factory.OtherDistanceId,
            FirstName = "Frans", LastName = "Toetser", Email = "frans@voorbeeld.co.za",
            Phone = "0821234567", DateOfBirth = "1985-01-09", Gender = "M", ShirtSize = "M",
            EmergencyName = "Pa", EmergencyPhone = "0827654321", MedicalNotes = (string?)null,
            Town = "Orania", Province = "Noord-Kaap", ClubName = (string?)null,
        };

        (await client.PostAsJsonAsync($"/api/orders/{token}/entrants", first)).EnsureSuccessStatusCode();
        var response = await client.PostAsJsonAsync($"/api/orders/{token}/entrants", second);
        response.EnsureSuccessStatusCode();

        var order = await response.Content.ReadFromJsonAsync<OrderShape>();
        var distances = order!.Entrants.Select(e => e.DistanceName).ToList();
        Assert.Equal(2, distances.Distinct().Count());
    }

    [Fact]
    public async Task An_entrant_without_an_event_is_refused()
    {
        var (client, token) = await NewOrder(1);
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync($"/api/orders/{token}/entrants", new
        {
            EventDistanceId = 0,
            FirstName = "Gerrit", LastName = "Toetser", Email = "g@voorbeeld.co.za",
            Phone = "0821234567", DateOfBirth = "1990-04-12", Gender = "M", ShirtSize = "L",
            EmergencyName = "Ma", EmergencyPhone = "0827654321", MedicalNotes = (string?)null,
            Town = "Orania", Province = "Noord-Kaap", ClubName = (string?)null,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private record OrderShape(Guid Token, int EntrantCount, decimal AmountZar, string Status,
        int EntrantsFilled, EntrantShape[] Entrants);

    private record EntrantShape(int Id, string FirstName, string DistanceName, string EventName);
}
