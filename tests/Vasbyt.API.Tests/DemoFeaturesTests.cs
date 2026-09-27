using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

public class DemoFeaturesTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Programme_is_public_and_has_three_ordered_days()
    {
        var response = await factory.CreateClient().GetAsync("/api/programme");
        response.EnsureSuccessStatusCode();
        var days = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, days.GetArrayLength());
        Assert.Equal(new[] { 1, 2, 3 }, days.EnumerateArray().Select(d => d.GetProperty("dayNumber").GetInt32()));
        Assert.All(days.EnumerateArray(), d => Assert.NotEmpty(d.GetProperty("entries").EnumerateArray()));
    }

    [Fact]
    public async Task Admin_can_save_bilingual_programme_and_public_reads_the_saved_version()
    {
        var admin = await factory.AdminClientAsync("programme@example.test");
        var body = Programme("Nuwe opening", "New opening");
        (await admin.PutAsJsonAsync("/api/admin/programme", body)).EnsureSuccessStatusCode();
        var saved = await factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/programme");
        Assert.Equal("Nuwe opening", saved[0].GetProperty("entries")[0].GetProperty("titleAf").GetString());
        Assert.Equal("New opening", saved[0].GetProperty("entries")[0].GetProperty("titleEn").GetString());
        Assert.Equal("2027-04-29", saved[0].GetProperty("dateLocal").GetString());
    }

    [Fact]
    public async Task Anonymous_cannot_change_programme()
    {
        var response = await factory.CreateClient().PutAsJsonAsync("/api/admin/programme", Programme("Opening", "Opening"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_programme_does_not_replace_published_content()
    {
        var admin = await factory.AdminClientAsync("programme-validation@example.test");
        var before = await admin.GetStringAsync("/api/programme");
        var response = await admin.PutAsJsonAsync("/api/admin/programme", Programme("", "Opening"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(before, await admin.GetStringAsync("/api/programme"));
    }

    [Fact]
    public async Task Duplicate_days_and_reverse_dates_are_rejected()
    {
        var admin = await factory.AdminClientAsync("programme-dates@example.test");
        var duplicate = new[] { Programme("A", "A")[0], Programme("B", "B")[0], Programme("C", "C")[2] };
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.PutAsJsonAsync("/api/admin/programme", duplicate)).StatusCode);
        var reverse = Programme("A", "A");
        reverse[1] = reverse[1] with { DateLocal = "2027-04-28" };
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.PutAsJsonAsync("/api/admin/programme", reverse)).StatusCode);
    }

    [Fact]
    public async Task Only_completed_paid_entrants_receive_unique_stable_private_QR_payloads()
    {
        var (client, token, slots) = await PaidOrder(2);
        Assert.All(slots.EnumerateArray(), e => Assert.Equal(JsonValueKind.Null, e.GetProperty("qrPayload").ValueKind));
        foreach (var e in slots.EnumerateArray())
            (await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{e.GetProperty("id").GetInt32()}", Form())).EnsureSuccessStatusCode();

        var order = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        var payloads = order.GetProperty("entrants").EnumerateArray().Select(e => e.GetProperty("qrPayload").GetString()!).ToArray();
        Assert.Equal(2, payloads.Distinct().Count());
        Assert.All(payloads, p =>
        {
            Assert.StartsWith("VASBYT:2027:", p);
            Assert.True(Guid.TryParse(p.Split(':')[2], out _));
            Assert.DoesNotContain("Anna", p);
            Assert.DoesNotContain(token, p);
        });
        var again = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.Equal(payloads, again.GetProperty("entrants").EnumerateArray().Select(e => e.GetProperty("qrPayload").GetString()));
    }

    [Fact]
    public async Task Only_admin_can_resolve_a_QR_pass_with_contact_emergency_and_medical_details()
    {
        var (_, _, entrant) = await CompletedEntrant();
        var code = entrant.GetProperty("qrPayload").GetString();
        var response = await factory.CreateClient().PostAsJsonAsync("/api/admin/scan", new { Code = code });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var admin = await factory.AdminClientAsync("scanner@example.test");
        var scan = await admin.PostAsJsonAsync("/api/admin/scan", new { Code = code });
        scan.EnsureSuccessStatusCode();
        var result = await scan.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Anna", result.GetProperty("firstName").GetString());
        Assert.Equal("anna@example.test", result.GetProperty("email").GetString());
        Assert.Equal("0821234567", result.GetProperty("phone").GetString());
        Assert.Equal("Jan", result.GetProperty("emergencyName").GetString());
        Assert.Equal("Asma", result.GetProperty("medicalConditions").GetString());
        Assert.Equal("Paid", result.GetProperty("orderStatus").GetString());
        Assert.Equal(1, result.GetProperty("orderLines").GetArrayLength());
    }

    [Fact]
    public async Task Admin_can_find_a_pass_by_its_printed_entry_number()
    {
        var (_, _, entrant) = await CompletedEntrant();
        var admin = await factory.AdminClientAsync("manual@example.test");
        var response = await admin.PostAsJsonAsync("/api/admin/scan", new { Code = entrant.GetProperty("entryNumber").GetString() });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(entrant.GetProperty("id").GetInt32(), result.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Unknown_and_unrelated_codes_are_rejected()
    {
        var admin = await factory.AdminClientAsync("unknown@example.test");
        foreach (var code in new[] { "https://example.test", "VASBYT:2027:broken", "VASBYT:2026:" + Guid.NewGuid(), "" })
            Assert.Equal(HttpStatusCode.BadRequest,
                (await admin.PostAsJsonAsync("/api/admin/scan", new { Code = code })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.PostAsJsonAsync("/api/admin/scan", new { Code = "VASBYT:2027:" + Guid.NewGuid() })).StatusCode);
    }

    [Fact]
    public async Task Check_in_is_explicit_authorised_and_preserves_the_first_timestamp()
    {
        var (_, _, entrant) = await CompletedEntrant();
        var id = entrant.GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().PostAsync($"/api/admin/entrants/{id}/check-in", null)).StatusCode);
        var admin = await factory.AdminClientAsync("checkin@example.test");
        var first = await admin.PostAsync($"/api/admin/entrants/{id}/check-in", null);
        first.EnsureSuccessStatusCode();
        var timestamp = (await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("checkedInUtc").GetString();
        Assert.NotNull(timestamp);
        var again = await admin.PostAsync($"/api/admin/entrants/{id}/check-in", null);
        again.EnsureSuccessStatusCode();
        Assert.Equal(timestamp, (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("checkedInUtc").GetString());
    }

    [Theory]
    [InlineData(OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Pending)]
    public async Task Passes_on_unpaid_or_cancelled_orders_cannot_be_used(OrderStatus status)
    {
        var (client, token, entrant) = await CompletedEntrant();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            var order = db.Orders.Single(o => o.PublicToken.ToString() == token);
            order.Status = status;
            await db.SaveChangesAsync();
        }
        var admin = await factory.AdminClientAsync("cancelled@example.test");
        Assert.Equal(HttpStatusCode.Conflict,
            (await admin.PostAsJsonAsync("/api/admin/scan", new { Code = entrant.GetProperty("qrPayload").GetString() })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await admin.PostAsync($"/api/admin/entrants/{entrant.GetProperty("id").GetInt32()}/check-in", null)).StatusCode);
        var read = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.Equal(JsonValueKind.Null, read.GetProperty("entrants")[0].GetProperty("qrPayload").ValueKind);
    }

    private async Task<(HttpClient Client, string Token, JsonElement Entrants)> PaidOrder(int quantity)
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "buyer@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligdraf"), TariffKind = "Student", Quantity = quantity } },
        });
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        var paid = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        paid.EnsureSuccessStatusCode();
        return (client, token, (await paid.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("entrants"));
    }

    private async Task<(HttpClient Client, string Token, JsonElement Entrant)> CompletedEntrant()
    {
        var (client, token, slots) = await PaidOrder(1);
        var id = slots[0].GetProperty("id").GetInt32();
        var completed = await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{id}", Form());
        completed.EnsureSuccessStatusCode();
        return (client, token, (await completed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("entrants")[0]);
    }

    private static object Form() => new
    {
        FirstName = "Anna", LastName = "Toets", IdNumber = "9001010000000",
        Email = "anna@example.test", Phone = "0821234567", DateOfBirth = "1990-01-01",
        Gender = "V", ShirtSize = "M", StreetAddress = "Dorpstraat 1", Town = "Orania",
        Province = "Noord-Kaap", PostalCode = "8752", MedicalConditions = "Asma",
        Medication = "Inhaleerder", MedicalFund = "Fonds", MedicalFundNumber = "1234",
        EmergencyName = "Jan", EmergencyRelationship = "Man", EmergencyPhone = "0827654321",
        AcceptTerms = true, PhotoConsent = true,
    };

    private record DayBody(int DayNumber, string DateLocal, string TitleAf, string TitleEn,
        string NoteAf, string NoteEn, EntryBody[] Entries);
    private record EntryBody(string TimeLocal, string TitleAf, string TitleEn, string DetailAf, string DetailEn);
    private static DayBody[] Programme(string titleAf, string titleEn) => Enumerable.Range(1, 3)
        .Select(n => new DayBody(n, new DateOnly(2027, 4, 29).AddDays(n - 1).ToString("yyyy-MM-dd"),
            $"Dag {n}", $"Day {n}", "", "", [new("06:30:00", titleAf, titleEn, "By die tent", "At the tent")]))
        .ToArray();
}
