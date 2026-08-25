using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;

namespace Vasbyt.API.Tests;

/// The stats endpoint aggregates money. SQLite cannot translate a decimal SUM and Postgres can, so
/// this endpoint is the one place a provider difference can pass review and 500 in production —
/// hence a test that actually runs it rather than only checking the numbers add up.
public class AdminStatsTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public AdminStatsTests(VasbytFactory factory) => _factory = factory;

    [Fact]
    public async Task Stats_are_computed_over_paid_orders_only()
    {
        var client = await SignedInAsAdmin();

        var paid = await client.PostAsJsonAsync("/api/orders", new { EntrantCount = 2 });
        var token = (await paid.Content.ReadFromJsonAsync<TokenShape>())!.Token;
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();

        // A second order left unpaid: it must not show up in the revenue.
        (await client.PostAsJsonAsync("/api/orders", new { EntrantCount = 5 })).EnsureSuccessStatusCode();

        var response = await client.GetAsync("/api/admin/stats");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var stats = await response.Content.ReadFromJsonAsync<StatsShape>();
        Assert.Equal(Pricing.DefaultEntryFeeZar * 2, stats!.EntryRevenueZar);
        Assert.Equal(1, stats.PaidOrders);
        Assert.Equal(1, stats.PendingOrders);
        Assert.Equal(2, stats.UnfilledSlots); // paid for two, entered none
    }

    [Fact]
    public async Task Stats_are_refused_without_the_admin_role()
    {
        var response = await _factory.CreateClient().GetAsync("/api/admin/stats");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<HttpClient> SignedInAsAdmin()
    {
        const string email = "stats-admin@vasbyt.test";
        const string password = "Vasbyt!2026";

        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
            if (!await roles.RoleExistsAsync(Roles.Admin)) await roles.CreateAsync(new AppRole(Roles.Admin));
            if (await users.FindByEmailAsync(email) is null)
            {
                var admin = new AppUser { UserName = email, Email = email, EmailConfirmed = true };
                Assert.True((await users.CreateAsync(admin, password)).Succeeded);
                await users.AddToRoleAsync(admin, Roles.Admin);
            }
        }

        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = password });
        login.EnsureSuccessStatusCode();
        return client;
    }

    private record TokenShape(Guid Token);
    private record StatsShape(int PaidOrders, int PendingOrders, int UnfilledSlots,
        decimal EntryRevenueZar, decimal DonationRevenueZar);
}
