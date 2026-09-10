using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

/// The rules the organisers were strict about: pay first, never more participant forms than tickets
/// paid for, and a form's route and tariff come off the paid line rather than off the browser. All
/// three live in OrderEndpoints.Gate. If any of these go green-to-red, the flow is broken.
public class PaymentGateTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public PaymentGateTests(VasbytFactory factory) => _factory = factory;

    [Fact]
    public async Task No_entrant_form_exists_before_the_order_is_paid()
    {
        var (client, order) = await NewOrder(("ligdraf", TariffKind.Student, 2));

        Assert.Empty(order.Entrants);

        var response = await client.PutAsJsonAsync($"/api/orders/{order.Token}/entrants/1", Form("Anna"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Exactly_as_many_forms_as_tickets_paid_for_and_no_more()
    {
        var (client, order) = await NewOrder(
            ("ligdraf", TariffKind.Student, 2), ("vastrap", TariffKind.Normal, 1));

        var paid = await Pay(client, order.Token);
        Assert.Equal(3, paid.Entrants.Length);

        // Paying twice must not conjure a fourth form: the quantity paid for is the only bound.
        var again = await Pay(client, order.Token);
        Assert.Equal(3, again.Entrants.Length);

        // And there is no endpoint that creates a fourth one directly.
        var strayId = paid.Entrants.Max(e => e.Id) + 1;
        var stray = await client.PutAsJsonAsync(
            $"/api/orders/{order.Token}/entrants/{strayId}", Form("Dirk"));
        Assert.Equal(HttpStatusCode.NotFound, stray.StatusCode);
    }

    [Fact]
    public async Task An_entrants_route_and_tariff_come_from_the_order_line_not_the_request()
    {
        // One cheap student Ligdraf ticket, then a form that tries to walk itself up to Vastrap.
        var (client, order) = await NewOrder(("ligdraf", TariffKind.Student, 1));
        var paid = await Pay(client, order.Token);
        var slot = paid.Entrants.Single();
        Assert.Equal("ligdraf", slot.RouteCode);
        Assert.Equal("Student", slot.TariffKind);

        var response = await client.PutAsJsonAsync($"/api/orders/{order.Token}/entrants/{slot.Id}",
            new
            {
                RouteCategoryId = _factory.RouteId("vastrap"),
                TariffKind = "Normal",
                FirstName = "Elsa", LastName = "Toetser", IdNumber = "9001015800085",
                Email = "elsa@voorbeeld.co.za", Phone = "0821234567", DateOfBirth = "1990-04-12",
                Gender = "V", ShirtSize = "M", StreetAddress = "Kerkstraat 1", Town = "Orania",
                Province = "Noord-Kaap", PostalCode = "8752",
                MedicalConditions = (string?)null, Medication = (string?)null,
                MedicalFund = (string?)null, MedicalFundNumber = (string?)null,
                EmergencyName = "Ma", EmergencyRelationship = "Moeder",
                EmergencyPhone = "0827654321", ClubName = (string?)null,
                AcceptTerms = true, GuardianConsentName = (string?)null, PhotoConsent = true,
            });
        response.EnsureSuccessStatusCode();

        var after = (await response.Content.ReadFromJsonAsync<OrderShape>())!.Entrants.Single();
        Assert.Equal("ligdraf", after.RouteCode);
        Assert.Equal("Student", after.TariffKind);
        Assert.True(after.IsComplete);
        Assert.NotNull(after.EntryNumber);
    }

    /// The tariff table out of the management report, resolved by the date the entry is made.
    [Fact]
    public async Task The_tariff_is_resolved_by_kind_and_date()
    {
        _factory.CreateClient(); // boots the host, which runs the seed
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();

        static DateTime Utc(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

        async Task<decimal> Amount(TariffKind kind, DateTime on) =>
            (await Pricing.RuleAsync(db, kind, on))!.AmountZar;

        Assert.Equal(440m, await Amount(TariffKind.Normal, Utc(2026, 11, 1)));
        Assert.Equal(560m, await Amount(TariffKind.Normal, Utc(2027, 3, 15)));
        Assert.Equal(690m, await Amount(TariffKind.Normal, Utc(2027, 4, 20)));
        Assert.Equal(165m, await Amount(TariffKind.Student, Utc(2026, 11, 1)));
        Assert.Equal(225m, await Amount(TariffKind.Student, Utc(2027, 4, 20)));

        // Once every window has closed there is no price, and nothing may be sold.
        Assert.Null(await Pricing.RuleAsync(db, TariffKind.Normal, Utc(2027, 6, 1)));
    }

    /// Spec 6.3: the server recalculates the total. Prices sent by the client are simply not read.
    [Fact]
    public async Task The_total_is_recalculated_on_the_server_and_never_taken_from_the_request()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toetser", Email = "koper@voorbeeld.co.za",
            Tickets = new[]
            {
                new { RouteCategoryId = _factory.RouteId("ligdraf"), TariffKind = "Student",
                    Quantity = 2, UnitPriceZar = 1m, LineTotalZar = 2m },
            },
            DonationZar = 50m,
            TotalZar = 1m,
        });
        response.EnsureSuccessStatusCode();
        var order = (await response.Content.ReadFromJsonAsync<OrderShape>())!;

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var ticket = (await Pricing.RuleAsync(db, TariffKind.Student, DateTime.UtcNow))!.AmountZar;

        Assert.Equal(ticket * 2 + 50m, order.TotalZar);
        Assert.Equal(ticket, order.Lines.Single(l => l.Kind == "Ticket").UnitPriceZar);
        Assert.Equal(50m, order.Lines.Single(l => l.Kind == "Donation").LineTotalZar);
        Assert.StartsWith("VB-2027-", order.Reference);
    }

    /// POPIA: the identity number and the four medical fields exist on exactly one projection, the
    /// admin one. No public or participant facing response may carry them, by construction.
    [Fact]
    public async Task No_participant_facing_response_carries_identity_or_medical_data()
    {
        var (client, order) = await NewOrder(("vasbyt", TariffKind.Normal, 1));
        var slot = (await Pay(client, order.Token)).Entrants.Single();

        (await client.PutAsJsonAsync($"/api/orders/{order.Token}/entrants/{slot.Id}",
            Form("Gerrit"))).EnsureSuccessStatusCode();

        foreach (var url in new[]
                 {
                     $"/api/orders/{order.Token}", "/api/registrations/by-province",
                     "/api/registrations/by-route", "/api/routes", "/api/tariffs",
                 })
        {
            var body = await client.GetStringAsync(url);
            Assert.DoesNotContain("idNumber", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(IdNumber, body);
            Assert.DoesNotContain("medic", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(Condition, body);
            Assert.DoesNotContain("Kerkstraat", body);
        }
    }

    private const string IdNumber = "8503125800086";
    private const string Condition = "Asma en hooikoors";

    private static object Form(string first) => new
    {
        FirstName = first, LastName = "Toetser", IdNumber,
        Email = $"{first}@voorbeeld.co.za".ToLowerInvariant(), Phone = "0821234567",
        DateOfBirth = "1985-03-12", Gender = "M", ShirtSize = "L",
        StreetAddress = "Kerkstraat 1", Town = "Orania", Province = "Noord-Kaap",
        PostalCode = "8752", MedicalConditions = Condition, Medication = "Antihistamien",
        MedicalFund = "Discovery", MedicalFundNumber = "123456",
        EmergencyName = "Ma", EmergencyRelationship = "Moeder", EmergencyPhone = "0827654321",
        ClubName = (string?)null, AcceptTerms = true, GuardianConsentName = (string?)null,
        PhotoConsent = true,
    };

    private async Task<(HttpClient client, OrderShape order)> NewOrder(
        params (string Code, TariffKind Kind, int Quantity)[] tickets)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toetser", Email = "koper@voorbeeld.co.za",
            Phone = "0820000000",
            Tickets = tickets.Select(t => new
            {
                RouteCategoryId = _factory.RouteId(t.Code),
                TariffKind = t.Kind.ToString(),
                t.Quantity,
            }),
        });
        response.EnsureSuccessStatusCode();
        return (client, (await response.Content.ReadFromJsonAsync<OrderShape>())!);
    }

    private static async Task<OrderShape> Pay(HttpClient client, Guid token)
    {
        var response = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<OrderShape>())!;
    }

    private record OrderShape(Guid Token, string Reference, string Status, decimal TotalZar,
        LineShape[] Lines, SlotShape[] Entrants);

    private record LineShape(int Id, string Kind, string Description, int Quantity,
        decimal UnitPriceZar, decimal LineTotalZar);

    private record SlotShape(int Id, string RouteCode, string TariffKind, string FirstName,
        bool IsComplete, string? EntryNumber);
}
