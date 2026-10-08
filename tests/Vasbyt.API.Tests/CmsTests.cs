using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

/// Wave 2: the admin CMS, the shop and the one endpoint that writes a file to disk. The three
/// things worth a test here are the ones that fail quietly: an upload trusting a header, a shop
/// line conjuring a participant form, and a tariff edit that does not reach GET /api/tariffs.
public class CmsTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public CmsTests(VasbytFactory factory) => _factory = factory;

    /// The declared content type is a claim. The first twelve bytes are the fact, and where the two
    /// disagree the upload is refused rather than stored under whatever extension was asked for.
    [Fact]
    public async Task An_upload_is_judged_on_its_magic_bytes_and_never_on_its_filename()
    {
        var client = await _factory.AdminClientAsync("cms-oplaai@vasbyt.test");

        var lying = await client.PostAsync("/api/admin/uploads", Part(Jpeg, "image/png", "s.png"));
        Assert.Equal(HttpStatusCode.BadRequest, lying.StatusCode);

        // Honest bytes, but a type outside the allowlist.
        var gif = await client.PostAsync("/api/admin/uploads", Part(Gif, "image/gif", "s.gif"));
        Assert.Equal(HttpStatusCode.BadRequest, gif.StatusCode);

        // The genuine article lands, under a name the client had no say in.
        var response = await client.PostAsync("/api/admin/uploads",
            Part(Png, "image/png", "../../../etc/passwd"));
        response.EnsureSuccessStatusCode();
        var saved = (await response.Content.ReadFromJsonAsync<UploadShape>())!;

        Assert.EndsWith(".png", saved.FileName);
        Assert.DoesNotContain("passwd", saved.FileName);
        Assert.DoesNotContain("..", saved.FileName);
        Assert.Equal($"/media/{saved.FileName}", saved.Url);

        // Served straight back out of the media root by the second UseStaticFiles.
        var fetched = await client.GetAsync(saved.Url);
        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        Assert.Equal(Png, await fetched.Content.ReadAsByteArrayAsync());

        var root = MediaStore.Root(
            _factory.Services.GetRequiredService<IConfiguration>(),
            _factory.Services.GetRequiredService<IWebHostEnvironment>());

        // The delete guard resolves the name first, so nothing outside the root is reachable.
        Assert.False(MediaStore.Delete(root, "../appsettings.json"));
        Assert.False(MediaStore.Delete(root, "/etc/passwd"));

        (await client.DeleteAsync($"/api/admin/uploads/{saved.FileName}")).EnsureSuccessStatusCode();
        Assert.False(File.Exists(Path.Combine(root, saved.FileName)));
    }

    /// A shirt is an OrderLine like any other, priced off the variant. What it must never be is an
    /// entry: Gate only ever walks Ticket lines, and this is the test that says so.
    [Fact]
    public async Task A_product_line_is_priced_server_side_and_creates_no_entrant()
    {
        var client = await _factory.AdminClientAsync("cms-winkel@vasbyt.test");

        var product = await Created(client, "/api/admin/products", new
        {
            Name = "Vasbyt-hemp", Description = "Katoen, 2027", ImageFileName = (string?)null,
            SortOrder = 1, IsActive = true,
        });
        var variant = await Created(client, $"/api/admin/products/{product}/variants", new
        {
            Label = "Medium", PriceZar = 320m, Stock = 12, IsActive = true,
        });

        var shop = (await client.GetFromJsonAsync<ProductShape[]>("/api/products"))!;
        Assert.Equal(320m, shop.Single(p => p.Id == product).Variants.Single().PriceZar);

        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toetser", Email = "winkel@voorbeeld.co.za",
            // A price on the request, which the server does not read.
            Products = new[] { new { ProductVariantId = variant, Quantity = 2, UnitPriceZar = 1m } },
        });
        created.EnsureSuccessStatusCode();
        var order = (await created.Content.ReadFromJsonAsync<OrderShape>())!;

        Assert.Equal(640m, order.TotalZar);
        var line = Assert.Single(order.Lines);
        Assert.Equal("Product", line.Kind);
        Assert.Equal(320m, line.UnitPriceZar);
        Assert.Equal("Vasbyt-hemp - Medium", line.Description);

        var pay = await client.PostAsync($"/api/orders/{order.Token}/pay-demo", null);
        pay.EnsureSuccessStatusCode();
        Assert.Empty((await pay.Content.ReadFromJsonAsync<OrderShape>())!.Entrants);

        // Sold, so deleting it may not remove the row the invoice line points at.
        var sold = await client.DeleteAsync($"/api/admin/products/{product}");
        Assert.False((await sold.Content.ReadFromJsonAsync<DeleteShape>())!.HardDeleted);
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<ProductShape[]>("/api/products"))!, p => p.Id == product);

        // Never sold, so it goes for real.
        var unsold = await Created(client, "/api/admin/products", new
        {
            Name = "Onverkoop", Description = "", ImageFileName = (string?)null,
            SortOrder = 2, IsActive = true,
        });
        var gone = await client.DeleteAsync($"/api/admin/products/{unsold}");
        Assert.True((await gone.Content.ReadFromJsonAsync<DeleteShape>())!.HardDeleted);
    }

    /// Spec 10: "Tariewe, datumreëls en inskrywingsperke bestuur". Nothing caches PricingRule, so an
    /// edit has to be visible on the next GET /api/tariffs. This test is what keeps a cache out.
    [Fact]
    public async Task Editing_a_pricing_rule_changes_what_the_tariff_endpoint_returns()
    {
        var client = await _factory.AdminClientAsync("cms-tariewe@vasbyt.test");
        var before = await Tariffs(client);

        // A window that opens before every seeded one and closes long after, so Pricing.RuleAsync
        // resolves the Student tariff to this rule whenever the suite happens to run.
        var rule = new
        {
            TariffKind = "Student",
            ValidFromUtc = DateTime.UtcNow.AddYears(-10),
            ValidToUtc = DateTime.UtcNow.AddYears(10),
            AmountZar = 111m,
            Label = "Toetstarief",
            IsActive = true,
        };
        var created = await client.PostAsJsonAsync("/api/admin/pricing-rules", rule);
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<IdShape>())!.Id;

        Assert.Equal(111m, (await Tariffs(client)).Single(t => t.Kind == "Student").AmountZar);

        var edited = await client.PutAsJsonAsync($"/api/admin/pricing-rules/{id}",
            new { rule.TariffKind, rule.ValidFromUtc, rule.ValidToUtc, AmountZar = 133m,
                Label = "Toetstarief, hersien", rule.IsActive });
        edited.EnsureSuccessStatusCode();

        var after = (await Tariffs(client)).Single(t => t.Kind == "Student");
        Assert.Equal(133m, after.AmountZar);
        Assert.Equal("Toetstarief, hersien", after.Label);

        // Nothing points at a pricing rule, so this one really goes and the seeded table is back.
        (await client.DeleteAsync($"/api/admin/pricing-rules/{id}")).EnsureSuccessStatusCode();
        Assert.Equal(before.Select(t => (t.Kind, t.AmountZar)),
            (await Tariffs(client)).Select(t => (t.Kind, t.AmountZar)));
    }

    /// The client's words: "the sponsor will be required to provide an image, and an additional
    /// booking link (optional)". Both halves of that are enforced here.
    [Fact]
    public async Task An_advert_must_carry_an_image_and_reads_back_as_a_media_path()
    {
        var client = await _factory.AdminClientAsync("cms-advertensies@vasbyt.test");

        var withoutImage = await client.PostAsJsonAsync("/api/admin/adverts", new
        {
            Kind = "Accommodation", Name = "Oranje Gastehuis", Blurb = "Vier kamers.",
            ImageFileName = (string?)null, LinkUrl = (string?)null, BookingUrl = (string?)null,
            SortOrder = 1, IsActive = true,
        });
        Assert.Equal(HttpStatusCode.BadRequest, withoutImage.StatusCode);

        var id = await Created(client, "/api/admin/adverts", new
        {
            Kind = "Accommodation", Name = "Oranje Gastehuis", Blurb = "Vier kamers.",
            ImageFileName = "gastehuis.jpg", LinkUrl = "https://voorbeeld.co.za",
            BookingUrl = "https://boek.voorbeeld.co.za", SortOrder = 1, IsActive = true,
        });

        var listed = (await client.GetFromJsonAsync<AdvertShape[]>("/api/adverts?kind=Accommodation"))!
            .Single(a => a.Id == id);
        Assert.Equal("Accommodation", listed.Kind);
        Assert.Equal("/media/gastehuis.jpg", listed.ImageUrl);
        Assert.Equal("https://boek.voorbeeld.co.za", listed.BookingUrl);

        // The kind filter is a filter, not a label.
        Assert.DoesNotContain((await client.GetFromJsonAsync<AdvertShape[]>("/api/adverts?kind=Sponsor"))!,
            a => a.Id == id);

        // Nothing in the schema points at an advert, so this one goes for real.
        var gone = await client.DeleteAsync($"/api/admin/adverts/{id}");
        Assert.True((await gone.Content.ReadFromJsonAsync<DeleteShape>())!.HardDeleted);
    }

    /// Spec 10: "Deelnemerslyste per roete uitvoer". The sensitive columns belong on this file and
    /// on no other response, which is the same boundary the POPIA test guards from the other side.
    [Fact]
    public async Task The_entrant_export_is_csv_per_route_and_carries_the_sensitive_columns()
    {
        var client = await _factory.AdminClientAsync("cms-uitvoer@vasbyt.test");

        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toetser", Email = "uitvoer@voorbeeld.co.za",
            Tickets = new[]
            {
                new { RouteCategoryId = _factory.RouteId("ligdraf"), TariffKind = "Normal", Quantity = 1 },
            },
        });
        created.EnsureSuccessStatusCode();
        var order = (await created.Content.ReadFromJsonAsync<OrderShape>())!;
        var pay = await client.PostAsync($"/api/orders/{order.Token}/pay-demo", null);
        pay.EnsureSuccessStatusCode();
        var slot = (await pay.Content.ReadFromJsonAsync<PaidShape>())!.Entrants.Single();

        (await client.PutAsJsonAsync($"/api/orders/{order.Token}/entrants/{slot.Id}", new
        {
            FirstName = "Hendrik", LastName = "Uitvoer", IdNumber = "8503125800086",
            Email = "hendrik@voorbeeld.co.za", Phone = "0821234567", DateOfBirth = "1985-03-12",
            Gender = "M", ShirtSize = "L", StreetAddress = "Kerkstraat 1", Town = "Orania",
            Province = "Noord-Kaap", PostalCode = "8752", MedicalConditions = "Asma",
            Medication = "Antihistamien", MedicalFund = "Discovery", MedicalFundNumber = "123456",
            EmergencyName = "Ma", EmergencyRelationship = "Moeder", EmergencyPhone = "0827654321",
            // A club name a spreadsheet would otherwise evaluate as a formula.
            ClubName = "=1+1", AcceptTerms = true, GuardianConsentName = (string?)null,
            PhotoConsent = true,
        })).EnsureSuccessStatusCode();

        var response = await client.GetAsync("/api/admin/entrants/export?routeCode=ligdraf");
        response.EnsureSuccessStatusCode();
        Assert.Equal("text/csv", response.Content.Headers.ContentType!.MediaType);

        var csv = await response.Content.ReadAsStringAsync();
        Assert.Contains("Identiteitsnommer", csv);
        Assert.Contains("Mediese toestande", csv);
        Assert.Contains("8503125800086", csv);
        Assert.Contains("Hendrik", csv);
        Assert.Contains("\"'=1+1\"", csv);

        // A different route's file does not carry this entrant.
        Assert.DoesNotContain("8503125800086",
            await client.GetStringAsync("/api/admin/entrants/export?routeCode=vasbyt"));

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _factory.CreateClient().GetAsync("/api/admin/entrants/export")).StatusCode);
    }

    /// The story the CMS exists to serve: organisers add days to a run route and everything they enter has to reach the public
    /// route list, which is the only place a participant ever sees it.
    [Fact]
    public async Task A_day_created_for_ligdraf_appears_on_the_public_route_list()
    {
        var client = await _factory.AdminClientAsync("cms-roetes@vasbyt.test");
        var ligdraf = _factory.RouteId("ligdraf");

        Assert.Equal([1, 2, 3], (await PublicRoute(client, "ligdraf")).Days.Select(d => d.DayNumber));

        var day = await Created(client, $"/api/admin/routes/{ligdraf}/days", new
        {
            DayNumber = 4, DateLocal = "2027-04-29", DistanceKm = 6.1m, ElevationGainM = 40,
            StartTimeLocal = "18:00:00", Description = "Aandstap deur die dorp.",
        });

        // A second day 4 on the same route is refused before the unique index has to say so.
        var duplicate = await client.PostAsJsonAsync($"/api/admin/routes/{ligdraf}/days", new
        {
            DayNumber = 4, DateLocal = "2027-04-30", DistanceKm = 9m, ElevationGainM = 60,
            StartTimeLocal = "06:30:00", Description = "Botsing.",
        });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Contains("Dag 4 bestaan reeds",
            (await duplicate.Content.ReadFromJsonAsync<ProblemShape>())!.Detail);

        // Day 5 is fine.
        await Created(client, $"/api/admin/routes/{ligdraf}/days", new
        {
            DayNumber = 5, DateLocal = "2027-04-30", DistanceKm = 9.4m, ElevationGainM = 62,
            StartTimeLocal = "06:30:00", Description = "Langs die kanaal.",
        });

        // Saving the route itself works too; its own values go back unchanged.
        var own = (await client.GetFromJsonAsync<AdminRouteShape[]>("/api/admin/routes"))!.Single(r => r.Id == ligdraf);
        (await client.PutAsJsonAsync($"/api/admin/routes/{ligdraf}", own)).EnsureSuccessStatusCode();

        var published = await PublicRoute(client, "ligdraf");
        Assert.True(published.IsOpen);
        Assert.Equal([1, 2, 3, 4, 5], published.Days.Select(d => d.DayNumber));
        Assert.Equal(6.1m, published.Days[3].DistanceKm);
        Assert.Equal("Aandstap deur die dorp.", published.Days[3].Description);
        Assert.Equal("18:00:00", published.Days[3].StartTimeLocal);
        Assert.Equal("2027-04-29", published.Days[3].DateLocal);

        // A day entered by mistake goes for real, nothing points at one.
        var removed = await client.DeleteAsync($"/api/admin/routes/{ligdraf}/days/{day}");
        Assert.True((await removed.Content.ReadFromJsonAsync<DeleteShape>())!.HardDeleted);
        Assert.Equal([1, 2, 3, 5], (await PublicRoute(client, "ligdraf")).Days.Select(d => d.DayNumber));

        // A day belongs to its route: the wrong route's id does not reach it.
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.DeleteAsync($"/api/admin/routes/{_factory.RouteId("vasbyt")}/days/{day}")).StatusCode);
    }

    [Fact]
    public async Task Walk_routes_show_the_run_days_and_refuse_their_own()
    {
        var client = await _factory.AdminClientAsync("cms-deel@vasbyt.test");
        foreach (var (walk, run) in new[] { ("ligstap", "ligdraf"), ("vasstap", "vasbyt") })
        {
            var shown = await PublicRoute(client, walk);
            var source = await PublicRoute(client, run);
            Assert.True(shown.IsOpen);
            Assert.Equal(run, shown.SharesRouteWithCode);
            Assert.Equal(source.Days.Select(d => d.DayNumber), shown.Days.Select(d => d.DayNumber));

            var gpx = await client.GetAsync($"/api/routes/{walk}/days/1/gpx");
            gpx.EnsureSuccessStatusCode();
            Assert.Contains("<trkpt", await gpx.Content.ReadAsStringAsync());

            var edit = await client.PostAsJsonAsync($"/api/admin/routes/{_factory.RouteId(walk)}/days", new
            {
                DayNumber = 9, DateLocal = "2027-04-29", DistanceKm = 1m, ElevationGainM = 1,
                StartTimeLocal = "06:00:00", Description = "Nee.",
            });
            Assert.Equal(HttpStatusCode.Conflict, edit.StatusCode);
        }

        var admin = await client.GetFromJsonAsync<AdminWalkShape[]>("/api/admin/routes");
        foreach (var (walk, run) in new[] { ("ligstap", "ligdraf"), ("vasstap", "vasbyt") })
        {
            var row = admin!.Single(r => r.Code == walk);
            Assert.Equal(run, row.SharesRouteWithCode);
            Assert.True(row.Days.Length >= 3);
        }
    }

    private static async Task<RouteShape> PublicRoute(HttpClient client, string code) =>
        (await client.GetFromJsonAsync<RouteShape[]>("/api/routes"))!.Single(r => r.Code == code);

    private static async Task<TariffShape[]> Tariffs(HttpClient client) =>
        (await client.GetFromJsonAsync<TariffShape[]>("/api/tariffs"))!;

    private static async Task<int> Created(HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<IdShape>())!.Id;
    }

    private static MultipartFormDataContent Part(byte[] bytes, string contentType, string fileName)
    {
        var part = new ByteArrayContent(bytes);
        part.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { part, "file", fileName } };
    }

    // A real 1x1 PNG, a JPEG's own opening bytes, and a GIF87a header.
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
    private static readonly byte[] Jpeg =
        [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00];
    private static readonly byte[] Gif =
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00];

    private record UploadShape(string FileName, string Url);
    private record IdShape(int Id);
    private record DeleteShape(bool HardDeleted);
    private record TariffShape(string Kind, decimal AmountZar, string Label);
    private record ProblemShape(string Detail);
    private record AdminRouteShape(int Id, string Name, string Blurb, decimal TotalDistanceKm, int ElevationGainM,
        string Difficulty, bool IsOpen, int SortOrder);
    private record AdminWalkShape(string Code, string? SharesRouteWithCode, DayShape[] Days);
    private record RouteShape(string Code, bool IsOpen, DayShape[] Days, string? SharesRouteWithCode = null);
    private record DayShape(int DayNumber, decimal DistanceKm, string StartTimeLocal,
        string DateLocal, string Description);
    private record ProductShape(int Id, string Name, string? ImageUrl, VariantShape[] Variants);
    private record VariantShape(int Id, string Label, decimal PriceZar, int Stock);
    private record AdvertShape(int Id, string Kind, string Name, string? ImageUrl, string? BookingUrl);
    private record OrderShape(Guid Token, decimal TotalZar, LineShape[] Lines, object[] Entrants);
    private record PaidShape(SlotShape[] Entrants);
    private record SlotShape(int Id);
    private record LineShape(string Kind, string Description, int Quantity, decimal UnitPriceZar);
}
