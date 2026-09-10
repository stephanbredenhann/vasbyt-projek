using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Data;

public static class SeedData
{
    // Orania, 2027. Thursday to Saturday, same shape as every previous year.
    private static readonly DateOnly Day1 = new(2027, 4, 29);
    private static readonly DateOnly Day2 = new(2027, 4, 30);
    private static readonly DateOnly Day3 = new(2027, 5, 1);

    private static readonly TimeOnly Evening = new(18, 0);
    private static readonly TimeOnly Morning = new(6, 30);
    private static readonly TimeOnly EarlyMorning = new(6, 0);

    // Entry windows. ponytail: UTC midnight rather than SAST midnight, two hours out at the seam.
    // Move to a timestamptz comparison in Africa/Johannesburg if a tariff ever flips at midnight.
    private static readonly DateTime EntriesOpen = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime NormalRateStarts = new(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc);
    // ponytail: the spec lists the late student rate's start date as an open decision. Defaulting to
    // two weeks before the event, and using the same date for the late normal rate the management
    // report prices but never dates. One constant to change once the organisers rule on it.
    private static readonly DateTime LateRateStarts = new(2027, 4, 16, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime EntriesClose = new(2027, 5, 2, 0, 0, 0, DateTimeKind.Utc);

    private const string EveningRun =
        "Dorpsdraf in die vroeg-aand. Ons stap/draf saam met die gemeenskap deur die dorp. "
        + "Die roete is 'n kombinasie van sementpad, grondpad en veldpaadjies.";
    private const string EveningRide =
        "Aandrit. Ons ry saam met die gemeenskap deur die dorp. Die roete is 'n kombinasie van "
        + "sementpad, grondpad en veldpaadjies.";
    private const string CanalDown =
        "Op die laaste dag neem ons wedren ons weer uit die dorp uit, waar die koppies se op- en "
        + "afdraandes jou lekker besig hou. Geniet die uitsig terwyl jy sweet tap, want dit is "
        + "afdraande terug dorp toe.";

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
                // Say so rather than starting with no admin and a 401 that explains nothing.
                else
                    scope.ServiceProvider.GetRequiredService<ILogger<VasbytDbContext>>().LogWarning(
                        "Seed:AdminPassword was rejected, so no admin account exists: {Errors}",
                        string.Join(" ", created.Errors.Select(e => e.Description)));
            }
        }

        if (!await db.PricingRules.AnyAsync()) await SeedPricingAsync(db);
        if (!await db.RouteCategories.AnyAsync()) await SeedRoutesAsync(db);

        // ponytail: no Product, ProductVariant or Advert rows. Both are admin-CMS managed and the
        // organisers have supplied neither a product range nor a single advertiser yet.
    }

    /// The 2027 table out of the management report. Windows are contiguous per tariff, which is what
    /// lets Pricing.RuleAsync pick one with a single comparison.
    private static async Task SeedPricingAsync(VasbytDbContext db)
    {
        db.PricingRules.AddRange(
            new PricingRule
            {
                TariffKind = TariffKind.Student, AmountZar = 165m, Label = "Student en skolier",
                ValidFromUtc = EntriesOpen, ValidToUtc = LateRateStarts,
            },
            new PricingRule
            {
                TariffKind = TariffKind.Student, AmountZar = 225m,
                Label = "Laat student- en skolierinskrywing",
                ValidFromUtc = LateRateStarts, ValidToUtc = EntriesClose,
            },
            new PricingRule
            {
                TariffKind = TariffKind.Normal, AmountZar = 440m,
                Label = "Vroeë inskrywing (Oktober 2026 tot Februarie 2027)",
                ValidFromUtc = EntriesOpen, ValidToUtc = NormalRateStarts,
            },
            new PricingRule
            {
                TariffKind = TariffKind.Normal, AmountZar = 560m,
                Label = "Gewone inskrywing (Maart tot April 2027)",
                ValidFromUtc = NormalRateStarts, ValidToUtc = LateRateStarts,
            },
            new PricingRule
            {
                TariffKind = TariffKind.Normal, AmountZar = 690m, Label = "Laat inskrywing",
                ValidFromUtc = LateRateStarts, ValidToUtc = EntriesClose,
            });
        await db.SaveChangesAsync();
    }

    /// Distances, climbs, start times and copy are the 2026 brochure's, which is the only real data
    /// there is. The brochure's LIGLOOP is the spec's Ligdraf.
    private static async Task SeedRoutesAsync(VasbytDbContext db)
    {
        db.RouteCategories.AddRange(
            new RouteCategory
            {
                Code = "ligtrap", Name = "Ligtrap", Discipline = Discipline.Cycle, SortOrder = 1,
                TotalDistanceKm = 71.99m, ElevationGainM = 465, Difficulty = "Matig",
                Blurb = "Die Ligtrap is 'n lekker avontuur in die saal. Jy ruik Karoobossies en "
                    + "luister na die mooiste Karoo natuurklanke. Vir drie dae trap jy al tussen die "
                    + "Karookoppies en maak nuwe vriende en herinneringe, terwyl jy die uitsig in "
                    + "'n bottel wil bêre.",
                Days =
                [
                    new() { DayNumber = 1, DateLocal = Day1, DistanceKm = 10.62m, ElevationGainM = 78,
                        StartTimeLocal = Evening, Description = EveningRide },
                    new() { DayNumber = 2, DateLocal = Day2, DistanceKm = 39.33m, ElevationGainM = 244,
                        StartTimeLocal = Morning,
                        Description = "Op Dag 2 ry ons oor die Fluitjeskraalbrug oor die Oranjerivier "
                            + "en al langs die kanaal tot ons fietse ons weer terug in Orania bring." },
                    new() { DayNumber = 3, DateLocal = Day3, DistanceKm = 21.82m, ElevationGainM = 143,
                        StartTimeLocal = Morning, Description = CanalDown },
                ],
            },
            new RouteCategory
            {
                Code = "vastrap", Name = "Vastrap", Discipline = Discipline.Cycle, SortOrder = 2,
                TotalDistanceKm = 152.45m, ElevationGainM = 820, Difficulty = "Swaar",
                Blurb = "Die Vastrap is vir die tawwe tienies. Jy ruik Karoobossies en luister na "
                    + "die mooiste Karoo natuurklanke. In die drie dae spandeer jy lekker baie tyd "
                    + "in die saal en ry jy al tussen die Karookoppies, terwyl jy die uitsig in "
                    + "'n bottel wil bêre.",
                Days =
                [
                    new() { DayNumber = 1, DateLocal = Day1, DistanceKm = 21.65m, ElevationGainM = 157,
                        StartTimeLocal = Evening, Description = EveningRide },
                    new() { DayNumber = 2, DateLocal = Day2, DistanceKm = 91.91m, ElevationGainM = 410,
                        StartTimeLocal = Morning,
                        Description = "Op Dag 2 ry ons oor die Fluitjeskraalbrug oor die Oranjerivier "
                            + "tot by Wanda en dan draai ons terug tot ons fietse ons weer terug na "
                            + "die hartland, Orania, bring." },
                    new() { DayNumber = 3, DateLocal = Day3, DistanceKm = 38.89m, ElevationGainM = 253,
                        StartTimeLocal = EarlyMorning, Description = CanalDown },
                ],
            },
            // ponytail: the two walking categories are new for 2027 and the organisers have not
            // supplied distances, climbs, start times or a day breakdown. Placeholder totals, no
            // RouteDay rows, IsOpen false so nothing can be sold against a made-up distance.
            new RouteCategory
            {
                Code = "ligstap", Name = "Ligstap", Discipline = Discipline.Walk, SortOrder = 3,
                TotalDistanceKm = 24m, ElevationGainM = 0, Difficulty = "Maklik", IsOpen = false,
                Blurb = "Die kort staproete. Afstande en vertrektye word bevestig sodra die "
                    + "organiseerders die roete afgestap het.",
            },
            new RouteCategory
            {
                Code = "vasstap", Name = "Vasstap", Discipline = Discipline.Walk, SortOrder = 4,
                TotalDistanceKm = 48m, ElevationGainM = 0, Difficulty = "Matig", IsOpen = false,
                Blurb = "Die lang staproete. Afstande en vertrektye word bevestig sodra die "
                    + "organiseerders die roete afgestap het.",
            },
            new RouteCategory
            {
                Code = "ligdraf", Name = "Ligdraf", Discipline = Discipline.Run, SortOrder = 5,
                TotalDistanceKm = 36.36m, ElevationGainM = 363, Difficulty = "Matig",
                // Placeholder loop around Orania; swap the file for the real Strava export.
                GpxFileName = "hardloop-kort.gpx",
                Blurb = "Die Ligdraf is 'n avontuur te voet. Vir drie dae trap jy spore al tussen "
                    + "die Karookoppies en maak nuwe vriende en herinneringe, terwyl jy die uitsig "
                    + "in 'n bottel wil bêre.",
                Days =
                [
                    new() { DayNumber = 1, DateLocal = Day1, DistanceKm = 5.69m, ElevationGainM = 34,
                        StartTimeLocal = Evening,
                        Description = EveningRun + " Die roete neem jou selfs deur ons Museum." },
                    new() { DayNumber = 2, DateLocal = Day2, DistanceKm = 15.99m, ElevationGainM = 145,
                        StartTimeLocal = Morning,
                        Description = "Op Dag 2 stap/draf ons met die Fluitjeskraalbrug oor die "
                            + "Oranjerivier en al langs die kanaal tot ons voete ons weer terug in "
                            + "Orania bring." },
                    new() { DayNumber = 3, DateLocal = Day3, DistanceKm = 14.68m, ElevationGainM = 184,
                        StartTimeLocal = EarlyMorning,
                        Description = "Op die laaste dag word ons Liglopers met 'n trok na 'n plaas "
                            + "vervoer, waar die deelnemers om die spilpunte sal stap en dan 'n roete "
                            + "langs die kanaal op pad dorp toe sal neem. Oplaai om 05:30." },
                ],
            },
            new RouteCategory
            {
                Code = "vasbyt", Name = "Vasbyt", Discipline = Discipline.Run, SortOrder = 6,
                TotalDistanceKm = 72.95m, ElevationGainM = 599, Difficulty = "Swaar",
                Blurb = "Die Vasbyt neem die ernstige atlete op 'n Karoo-avontuur te voet. Vir drie "
                    + "dae trap jy spore al tussen die Karookoppies, terwyl jy die uitsig in 'n "
                    + "bottel wil bêre. Dit toets uithouvermoë en beplanning, aangesien daar slegs "
                    + "36 uur tussen jou eerste en jou laaste wegspring verloop.",
                Days =
                [
                    new() { DayNumber = 1, DateLocal = Day1, DistanceKm = 10.62m, ElevationGainM = 75,
                        StartTimeLocal = Evening, Description = EveningRun },
                    new() { DayNumber = 2, DateLocal = Day2, DistanceKm = 39.33m, ElevationGainM = 244,
                        StartTimeLocal = Morning,
                        Description = "Op Dag 2 stap/draf ons oor die Fluitjeskraalbrug oor die "
                            + "Oranjerivier en al langs die kanaal tot ons voete ons weer terug in "
                            + "Orania bring." },
                    new() { DayNumber = 3, DateLocal = Day3, DistanceKm = 23m, ElevationGainM = 280,
                        StartTimeLocal = Morning,
                        Description = "Op die laaste dag word ons wedloopdeelnemers met 'n trok na "
                            + "'n plaas vervoer, waar die deelnemers op 'n plaas sal wegspring en "
                            + "dan 'n roete langs die kanaal op pad dorp toe sal neem. Oplaai om "
                            + "05:30." },
                ],
            });
        await db.SaveChangesAsync();
    }
}
