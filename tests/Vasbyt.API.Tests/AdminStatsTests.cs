using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

/// The stats endpoint aggregates money. SQLite cannot translate a decimal SUM and Postgres can, so
/// this endpoint is the one place a provider difference can pass review and 500 in production —
/// hence a test that actually runs it rather than only checking the numbers add up.
public class AdminStatsTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public AdminStatsTests(VasbytFactory factory) => _factory = factory;

    [Fact]
    public async Task Stats_are_computed_over_paid_orders_only_and_split_by_line_kind()
    {
        var client = await SignedInAsAdmin();

        var paid = await client.PostAsJsonAsync("/api/orders", Cart(2, donation: 75m));
        var order = (await paid.Content.ReadFromJsonAsync<OrderShape>())!;
        (await client.PostAsync($"/api/orders/{order.Token}/pay-demo", null)).EnsureSuccessStatusCode();

        // A second order left unpaid: it must not show up in the revenue or the form counts.
        (await client.PostAsJsonAsync("/api/orders", Cart(5))).EnsureSuccessStatusCode();

        var response = await client.GetAsync("/api/admin/stats");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var stats = (await response.Content.ReadFromJsonAsync<StatsShape>())!;
        var tickets = order.Lines.Single(l => l.Kind == "Ticket").LineTotalZar;

        Assert.Equal(1, stats.PaidOrders);
        Assert.Equal(1, stats.PendingOrders);
        Assert.Equal(order.TotalZar, stats.TotalRevenueZar);
        Assert.Equal(tickets, stats.EntryRevenueZar);
        Assert.Equal(75m, stats.DonationRevenueZar);
        Assert.Equal(0m, stats.ProductRevenueZar);
        // Two forms created by payment, neither filled in yet.
        Assert.Equal(2, stats.Entrants);
        Assert.Equal(2, stats.UnfilledForms);
    }

    [Fact]
    public async Task Stats_are_refused_without_the_admin_role()
    {
        var response = await _factory.CreateClient().GetAsync("/api/admin/stats");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private object Cart(int quantity, decimal? donation = null) => new
    {
        FirstName = "Koper", LastName = "Toetser", Email = "koper@voorbeeld.co.za",
        Tickets = new[]
        {
            new { RouteCategoryId = _factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = quantity },
        },
        DonationZar = donation,
    };

    private async Task<HttpClient> SignedInAsAdmin()
    {
        const string email = "stats-admin@vasbyt.test";
        const string password = "Vasbyt!2026";

        var client = _factory.CreateClient();

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

        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = password });
        login.EnsureSuccessStatusCode();
        return client;
    }

    private record OrderShape(Guid Token, decimal TotalZar, LineShape[] Lines);
    private record LineShape(string Kind, decimal LineTotalZar);
    private record StatsShape(int Entrants, int PaidOrders, int PendingOrders, int UnfilledForms,
        decimal TotalRevenueZar, decimal EntryRevenueZar, decimal ProductRevenueZar,
        decimal DonationRevenueZar);
}
