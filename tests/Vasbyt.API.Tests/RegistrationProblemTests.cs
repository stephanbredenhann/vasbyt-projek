using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

public class RegistrationProblemTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Registration_problems_have_stable_public_codes()
    {
        var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/register", Registration("existing@example.com", "Vasbyt!2026"))).EnsureSuccessStatusCode();

        await AssertCode(client, Registration("existing@example.com", "Vasbyt!2026"), "registration.email_duplicate");
        await AssertCode(client, Registration("not-an-email", "Vasbyt!2026"), "registration.email_invalid");
        await AssertCode(client, Registration("weak@example.com", "weak"), "registration.password_requirements");
        await AssertCode(client, Registration("invite@example.com", "Vasbyt!2026", "bad-token"), "registration.invitation_invalid");
    }

    [Fact]
    public async Task Participant_validation_and_checked_in_problems_have_stable_codes()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Buyer", LastName = "Test", Email = "buyer@example.com", Phone = "1",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligdraf"), TariffKind = "Student", Quantity = 1 } },
        });
        created.EnsureSuccessStatusCode();
        using var orderDoc = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var token = orderDoc.RootElement.GetProperty("token").GetGuid();
        var paid = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        paid.EnsureSuccessStatusCode();
        using var paidDoc = JsonDocument.Parse(await paid.Content.ReadAsStringAsync());
        var entrantId = paidDoc.RootElement.GetProperty("entrants")[0].GetProperty("id").GetInt32();

        await AssertCode(client, $"/api/orders/{token}/entrants/{entrantId}", Entrant(""), "entrant.name_required", HttpStatusCode.BadRequest);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            var entrant = db.Entrants.Single(e => e.Id == entrantId);
            entrant.CheckedInUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        await AssertCode(client, $"/api/orders/{token}/entrants/{entrantId}", Entrant("Alex"), "entrant.checked_in", HttpStatusCode.Conflict);
    }

    private static object Registration(string email, string password, string? invite = null) =>
        new { Email = email, Password = password, FirstName = "A", LastName = "B", Invite = invite };

    private static object Entrant(string firstName) => new
    {
        FirstName = firstName, LastName = "Test", IdNumber = "8503125800086", Email = "a@example.com", Phone = "1",
        DateOfBirth = "1985-03-12", Gender = "M", ShirtSize = "L", StreetAddress = "1 Road", Town = "Orania",
        Province = "Northern Cape", PostalCode = "8752", MedicalConditions = (string?)null, Medication = (string?)null,
        MedicalFund = (string?)null, MedicalFundNumber = (string?)null, EmergencyName = "B", EmergencyRelationship = "Parent",
        EmergencyPhone = "2", ClubName = (string?)null, AcceptTerms = true, GuardianConsentName = (string?)null, PhotoConsent = true,
    };

    private static Task AssertCode(HttpClient client, object request, string expected) =>
        AssertCode(client, "/api/auth/register", request, expected);

    private static async Task AssertCode(HttpClient client, string path, object request, string expected, HttpStatusCode status = HttpStatusCode.BadRequest)
    {
        var response = path.Contains("/entrants/", StringComparison.Ordinal)
            ? await client.PutAsJsonAsync(path, request)
            : await client.PostAsJsonAsync(path, request);
        Assert.Equal(status, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(expected, doc.RootElement.GetProperty("code").GetString());
    }
}
