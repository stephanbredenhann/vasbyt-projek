using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

/// <summary>
/// Boots the real app against a throwaway Postgres in Docker.
///
/// Not an in-memory or SQLite substitute: the provider differences are exactly what bites — a
/// decimal SUM that SQLite refuses and Postgres translates fine is a 500 nobody sees until
/// production. Testing on the engine we deploy on is the whole point. Costs a few seconds of
/// container startup per test class.
///
/// Each test class gets its own fixture, hence its own database, so tests that assert on totals
/// are not reading someone else's rows.
/// </summary>
public class VasbytFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder("postgres:16-alpine").Build();

    /// Seeded route category ids, keyed by the code the spec names them by.
    public IReadOnlyDictionary<string, int> RouteIds { get; private set; } =
        new Dictionary<string, int>();

    public int RouteId(string code) => RouteIds[code];

    public async Task InitializeAsync() => await _db.StartAsync();

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _db.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(l => l.ClearProviders());
        // Point the app's own registration at the container rather than swapping the DbContext out,
        // so the Npgsql wiring under test is the same wiring that ships.
        builder.UseSetting("ConnectionStrings:Default", _db.GetConnectionString());
    }

    /// A client carrying an Identity cookie for a freshly made admin. Every /api/admin endpoint is
    /// behind the Admin role, so anything reaching one needs this rather than CreateClient().
    public async Task<HttpClient> AdminClientAsync(string email, string password = "Vasbyt!2026")
    {
        var client = CreateClient();

        using (var scope = Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
            if (!await roles.RoleExistsAsync(Roles.Admin))
                await roles.CreateAsync(new AppRole(Roles.Admin));
            if (await users.FindByEmailAsync(email) is null)
            {
                var admin = new AppUser { UserName = email, Email = email, EmailConfirmed = true };
                var created = await users.CreateAsync(admin, password);
                if (!created.Succeeded)
                    throw new InvalidOperationException(
                        string.Join(" ", created.Errors.Select(e => e.Description)));
                await users.AddToRoleAsync(admin, Roles.Admin);
            }
        }

        var login = await client.PostAsJsonAsync("/api/auth/login",
            new { Email = email, Password = password });
        login.EnsureSuccessStatusCode();
        return client;
    }

    protected override void ConfigureClient(HttpClient client)
    {
        // The host boots on first client, which runs migrations and the seed. Read the seeded ids
        // back out rather than hard-coding them.
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        RouteIds = db.RouteCategories.ToDictionary(r => r.Code, r => r.Id);
        base.ConfigureClient(client);
    }
}
