using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Data;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class DraftAndReminderTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    private const string IdNumber = "8503125800086";

    [Fact]
    public async Task Draft_round_trips_encrypted_and_is_dropped_on_submit()
    {
        var client = factory.CreateClient();
        var (token, ids) = await PaidOrder(client, quantity: 1);
        var path = $"/api/orders/{token}/entrants/{ids[0]}/draft";

        Assert.Equal(HttpStatusCode.NoContent, (await client.GetAsync(path)).StatusCode);
        (await client.PutAsJsonAsync(path, new { firstName = "Elsa", idNumber = IdNumber })).EnsureSuccessStatusCode();
        using (var doc = JsonDocument.Parse(await client.GetStringAsync(path)))
            Assert.Equal(IdNumber, doc.RootElement.GetProperty("idNumber").GetString());
        Assert.DoesNotContain(IdNumber, await RawDraft(ids[0]));

        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync($"/api/orders/{Guid.NewGuid()}/entrants/{ids[0]}/draft", new { firstName = "X" })).StatusCode);

        (await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{ids[0]}", Form())).EnsureSuccessStatusCode();
        Assert.Null(await RawDraft(ids[0]));
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync(path, new { firstName = "Late" })).StatusCode);
    }

    [Fact]
    public async Task Reminders_go_out_a_day_and_a_week_after_payment_once_each_and_stop_when_forms_are_done()
    {
        var client = factory.CreateClient();
        var (late, _) = await PaidOrder(client, quantity: 1);
        var (fresh, _) = await PaidOrder(client, quantity: 1);
        var (done, doneIds) = await PaidOrder(client, quantity: 1);
        (await client.PutAsJsonAsync($"/api/orders/{done}/entrants/{doneIds[0]}", Form())).EnsureSuccessStatusCode();
        await PaidAgo(late, TimeSpan.FromDays(2));
        await PaidAgo(done, TimeSpan.FromDays(2));

        var mail = new OkHandler();
        Assert.Equal(1, await Run(mail));
        Assert.Equal(0, await Run(mail));

        // Overdue by more than a week with one reminder sent: exactly one more, never a burst.
        await PaidAgo(late, TimeSpan.FromDays(8));
        await PaidAgo(fresh, TimeSpan.FromDays(8));
        Assert.Equal(2, await Run(mail));
        Assert.Equal(0, await Run(mail));
        string[] expected = [$"vasbyt-reminder/{late}/1", $"vasbyt-reminder/{late}/2", $"vasbyt-reminder/{fresh}/2"];
        Assert.Equal(expected.Order(), mail.Keys.Order());
    }

    private async Task<int> Run(OkHandler handler)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["Resend:ApiKey"] = "key", ["Public:BaseUrl"] = "https://vasbyt.example" }).Build();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        return await FormReminders.RunAsync(db, new ResendClient(new HttpClient(handler), cfg, NullLogger<ResendClient>.Instance),
            cfg, DateTime.UtcNow);
    }

    private async Task PaidAgo(Guid token, TimeSpan ago)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var paid = DateTime.UtcNow - ago;
        await db.Orders.Where(o => o.PublicToken == token).ExecuteUpdateAsync(s => s.SetProperty(o => o.PaidUtc, paid));
    }

    private async Task<string?> RawDraft(int entrantId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        return await db.Entrants.Where(e => e.Id == entrantId).Select(e => e.Draft).SingleAsync();
    }

    private async Task<(Guid Token, int[] EntrantIds)> PaidOrder(HttpClient client, int quantity)
    {
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Buyer", LastName = "Test", Email = "draft@example.com",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligdraf"), TariffKind = "Student", Quantity = quantity } },
        });
        created.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var token = doc.RootElement.GetProperty("token").GetGuid();
        var paid = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        paid.EnsureSuccessStatusCode();
        using var paidDoc = JsonDocument.Parse(await paid.Content.ReadAsStringAsync());
        return (token, paidDoc.RootElement.GetProperty("entrants").EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToArray());
    }

    private static object Form() => new
    {
        FirstName = "Elsa", LastName = "Toetser", IdNumber, Email = "elsa@voorbeeld.co.za", Phone = "0821234567",
        DateOfBirth = "1985-03-12", Gender = "V", ShirtSize = "M", StreetAddress = "Kerkstraat 1", Town = "Orania",
        Province = "Noord-Kaap", PostalCode = "8752", MedicalConditions = (string?)null, Medication = (string?)null,
        MedicalFund = (string?)null, MedicalFundNumber = (string?)null, EmergencyName = "Ma",
        EmergencyRelationship = "Moeder", EmergencyPhone = "0827654321", ClubName = (string?)null,
        AcceptTerms = true, GuardianConsentName = (string?)null, PhotoConsent = false,
    };

    private sealed class OkHandler : HttpMessageHandler
    {
        public List<string> Keys { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Keys.Add(request.Headers.GetValues("Idempotency-Key").Single());
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"id\":\"x\"}") });
        }
    }
}
