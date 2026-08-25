using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Data;

public static class SeedData
{
    private const string Lorem =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor "
        + "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.";

    public static async Task InitialiseAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        await db.Database.MigrateAsync();

        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
        foreach (var role in new[] { Roles.Admin, Roles.Participant })
            if (!await roles.RoleExistsAsync(role)) await roles.CreateAsync(new AppRole(role));

        var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var adminEmail = cfg["Seed:AdminEmail"];
        var adminPassword = cfg["Seed:AdminPassword"];
        if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            if (await users.FindByEmailAsync(adminEmail) is null)
            {
                var admin = new AppUser
                {
                    UserName = adminEmail, Email = adminEmail, EmailConfirmed = true,
                    FirstName = "Vasbyt", LastName = "Admin",
                };
                var created = await users.CreateAsync(admin, adminPassword);
                if (created.Succeeded) await users.AddToRoleAsync(admin, Roles.Admin);
            }
        }

        if (await db.Events.AnyAsync()) return;

        // Placeholder distances and dates — replace once the organisers confirm them.
        // The entry fee is flat across all four and lives in Pricing:EntryFeeZar.
        var start = new DateTime(DateTime.UtcNow.Year + 1, 5, 1, 6, 0, 0, DateTimeKind.Utc);
        db.Events.AddRange(
            new Event
            {
                Discipline = Discipline.Run, Name = "Vasbyt Hardloop", Blurb = Lorem,
                StartDateUtc = start,
                Distances =
                [
                    new() { Name = "Kort roete", DistanceKm = 21m, ElevationGainM = 620,
                        // Placeholder loop; swap the file for the real Strava export.
                        GpxFileName = "hardloop-kort.gpx" },
                    new() { Name = "Lang roete", DistanceKm = 42m, ElevationGainM = 1340 },
                ],
            },
            new Event
            {
                Discipline = Discipline.Cycle, Name = "Vasbyt Fiets", Blurb = Lorem,
                StartDateUtc = start,
                Distances =
                [
                    new() { Name = "Kort roete", DistanceKm = 65m, ElevationGainM = 880 },
                    new() { Name = "Lang roete", DistanceKm = 120m, ElevationGainM = 1910 },
                ],
            });
        await db.SaveChangesAsync();
    }
}
