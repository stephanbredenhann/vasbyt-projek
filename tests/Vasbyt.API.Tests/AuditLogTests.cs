using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class AuditLogTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task An_admin_edit_records_who_and_the_old_and_new_values()
    {
        var admin = await factory.AdminClientAsync("oudit-produk@vasbyt.test");
        var created = await admin.PostAsJsonAsync("/api/admin/products", new
        {
            Name = "Pet", Description = "", ImageFileName = (string?)null, SortOrder = 1, IsActive = true,
        });
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        (await admin.PutAsJsonAsync($"/api/admin/products/{id}", new
        {
            Name = "Kakie pet", Description = "", ImageFileName = (string?)null, SortOrder = 1, IsActive = true,
        })).EnsureSuccessStatusCode();

        var row = await Latest(admin, $"products/{id}");
        Assert.Equal("oudit-produk@vasbyt.test", row.GetProperty("actorEmail").GetString());
        Assert.Equal("PUT", row.GetProperty("method").GetString());
        var change = Assert.Single(row.GetProperty("changes").EnumerateArray());
        Assert.Equal("Product", change.GetProperty("entity").GetString());
        Assert.Equal(id.ToString(), change.GetProperty("key").GetString());
        var name = change.GetProperty("fields").GetProperty("Name");
        Assert.Equal(["Pet", "Kakie pet"], name.EnumerateArray().Select(v => v.GetString()));
    }

    [Fact]
    public async Task Medical_fields_are_masked_and_entrant_reads_are_recorded()
    {
        var admin = await factory.AdminClientAsync("oudit-deelnemer@vasbyt.test");
        var buyer = factory.CreateClient();
        var order = await buyer.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Mia", LastName = "Medies", Email = "mia@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        });
        var token = (await order.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        (await buyer.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        var entrant = (await buyer.GetFromJsonAsync<JsonElement>($"/api/orders/{token}"))
            .GetProperty("entrants")[0].GetProperty("id").GetInt32();

        (await admin.PatchAsJsonAsync($"/api/admin/entrants/{entrant}", new
        {
            FirstName = "Mia", LastName = "Medies", Email = "mia@example.test", Phone = "0820000000",
            ShirtSize = "M", StreetAddress = "1 Straat", Town = "Orania", Province = "Noord-Kaap", PostalCode = "8752",
            ClubName = (string?)null, MedicalConditions = "Asma", Medication = "Pompie", MedicalFund = (string?)null,
            MedicalFundNumber = (string?)null, EmergencyName = "Ma", EmergencyRelationship = "Ma", EmergencyPhone = "0830000000",
        })).EnsureSuccessStatusCode();

        var row = await Latest(admin, $"entrants/{entrant}");
        var fields = row.GetProperty("changes")[0].GetProperty("fields");
        Assert.Equal("***", fields.GetProperty("MedicalConditions")[1].GetString());
        Assert.Equal("Medies", fields.GetProperty("LastName")[1].GetString());
        Assert.DoesNotContain("Asma", row.GetRawText());

        await admin.GetAsync("/api/admin/entrants?q=medies");
        Assert.Equal("GET", (await Latest(admin, "entrants?q=medies")).GetProperty("method").GetString());
    }

    [Fact]
    public async Task Public_requests_and_admin_list_reads_write_nothing_and_the_log_is_admin_only()
    {
        var admin = await factory.AdminClientAsync("oudit-stil@vasbyt.test");
        await admin.GetAsync("/api/admin/products");
        await factory.CreateClient().PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Gas", LastName = "Gas", Email = "gas@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        });
        var log = await admin.GetFromJsonAsync<JsonElement>("/api/admin/audit?q=oudit-stil");
        Assert.Equal(0, log.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/audit")).StatusCode);
    }

    static async Task<JsonElement> Latest(HttpClient admin, string path)
    {
        var log = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/audit?q={Uri.EscapeDataString(path)}");
        return log.GetProperty("items")[0];
    }
}

public class BackupTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task A_backup_is_made_listed_downloaded_and_pruned_to_fourteen()
    {
        var admin = await factory.AdminClientAsync("rugsteun@vasbyt.test");
        var root = factory.Services.GetRequiredService<Backups>().Root;
        Directory.CreateDirectory(root);
        for (var i = 0; i < Backups.Keep; i++) await File.WriteAllTextAsync(Path.Combine(root, $"vasbyt-20200101-0000{i:00}.dump"), "x");

        var made = await admin.PostAsync("/api/admin/backups", null);
        made.EnsureSuccessStatusCode();
        var name = (await made.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("name").GetString()!;

        var list = await admin.GetFromJsonAsync<JsonElement>("/api/admin/backups");
        Assert.Equal(Backups.Keep, list.GetArrayLength());
        Assert.Equal(name, list[0].GetProperty("name").GetString());
        Assert.False(File.Exists(Path.Combine(root, "vasbyt-20200101-000000.dump")));

        var bytes = await admin.GetByteArrayAsync($"/api/admin/backups/{name}");
        Assert.Equal("PGDMP", System.Text.Encoding.ASCII.GetString(bytes, 0, 5));
        Assert.Equal("GET", (await admin.GetFromJsonAsync<JsonElement>($"/api/admin/audit?q={name}"))
            .GetProperty("items")[0].GetProperty("method").GetString());

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/admin/backups/..%2Fappsettings.json")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/admin/backups/vasbyt-nope.dump")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync($"/api/admin/backups/{name}")).StatusCode);
    }

    [Theory]
    [InlineData("2026-10-15T00:10:00", null, true)]
    [InlineData("2026-10-15T00:10:00", "vasbyt-20261014-000500.dump", true)]
    [InlineData("2026-10-15T00:30:00", "vasbyt-20261015-000500.dump", false)]
    [InlineData("2026-10-15T01:10:00", "vasbyt-20261014-000500.dump", false)]
    public void Nightly_runs_once_in_the_two_am_sast_hour(string utc, string? newest, bool due) =>
        Assert.Equal(due, Backups.Due(DateTime.Parse(utc), newest));
}
