using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using Vasbyt.API.Data;

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
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public int DistanceId { get; private set; }
    public int OtherDistanceId { get; private set; }

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

    protected override void ConfigureClient(HttpClient client)
    {
        // The host boots on first client, which runs migrations and the seed. Read the seeded ids
        // back out rather than hard-coding them.
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var distances = db.EventDistances.OrderBy(d => d.Id).Take(2).ToList();
        DistanceId = distances[0].Id;
        OtherDistanceId = distances[1].Id;
        base.ConfigureClient(client);
    }
}
