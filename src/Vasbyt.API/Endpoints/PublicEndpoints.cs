using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

public record RouteDayDto(int DayNumber, DateOnly DateLocal, decimal DistanceKm,
    int ElevationGainM, TimeOnly StartTimeLocal, string Description, bool HasRoute);

public record RouteCategoryDto(int Id, string Code, string Name, string Discipline, string Blurb,
    decimal TotalDistanceKm, int ElevationGainM, string Difficulty, bool HasRoute, bool IsOpen,
    IEnumerable<RouteDayDto> Days);

public record TariffDto(string Kind, decimal AmountZar, string Label,
    DateTime ValidFromUtc, DateTime ValidToUtc);

public record ProvinceCount(string Province, int Count);
public record RouteCount(string Code, string Name, int Count);

public record ProductVariantDto(int Id, string Label, decimal PriceZar, int Stock);

/// ImageUrl, never ImageFileName: the stored name is an implementation detail of the media root and
/// the browser only ever needs the path it can fetch.
public record ProductDto(int Id, string Name, string Description, string? ImageUrl,
    IEnumerable<ProductVariantDto> Variants);

public record AdvertDto(int Id, string Kind, string Name, string Blurb, string? ImageUrl,
    string? LinkUrl, string? BookingUrl, string? Phone);

public static class PublicEndpoints
{
    public static void MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        // The SPA asks for this on boot: it decides whether to load the Google Places script at all.
        app.MapGet("/api/config", (IConfiguration cfg) => Results.Ok(new
        {
            googleMapsApiKey = cfg["GoogleMaps:ApiKey"],
            demoPayments = true,
            eventYear = OrderEndpoints.EventYear,
        })).AllowAnonymous();

        // What a ticket of each kind costs at this moment. The entry screen shows both alongside the
        // six categories; it never computes a total of its own that the server has to trust.
        app.MapGet("/api/tariffs", async (VasbytDbContext db) =>
        {
            var now = DateTime.UtcNow;
            var tariffs = new List<TariffDto>();
            foreach (var kind in new[] { TariffKind.Student, TariffKind.Normal })
                if (await Pricing.RuleAsync(db, kind, now) is { } r)
                    tariffs.Add(new TariffDto(kind.ToString(), r.AmountZar, r.Label,
                        r.ValidFromUtc, r.ValidToUtc));
            return Results.Ok(tariffs);
        }).AllowAnonymous();

        app.MapGet("/api/routes", async (VasbytDbContext db) =>
        {
            var routes = await db.RouteCategories.Include(r => r.Days).AsNoTracking()
                .OrderBy(r => r.SortOrder).ToListAsync();
            return Results.Ok(routes.Select(r => new RouteCategoryDto(
                r.Id, r.Code, r.Name, r.Discipline.ToString(), r.Blurb, r.TotalDistanceKm,
                r.ElevationGainM, r.Difficulty, !string.IsNullOrEmpty(r.GpxFileName), r.IsOpen,
                r.Days.OrderBy(d => d.DayNumber).Select(d => new RouteDayDto(
                    d.DayNumber, d.DateLocal, d.DistanceKm, d.ElevationGainM, d.StartTimeLocal,
                    d.Description, !string.IsNullOrEmpty(d.GpxFileName))))));
        }).AllowAnonymous();

        // Spec 4.4: a counter of valid entries per route category.
        // ponytail: counts paid tickets, not completed forms. The spec lists which of the two the
        // public counter should use as an open decision; swap the predicate when they rule.
        app.MapGet("/api/registrations/by-route", async (VasbytDbContext db) =>
        {
            var counts = await db.Entrants
                .Where(e => e.OrderLine!.Order!.Status == OrderStatus.Paid)
                .GroupBy(e => new { e.RouteCategory!.Code, e.RouteCategory.Name })
                .Select(g => new RouteCount(g.Key.Code, g.Key.Name, g.Count()))
                .ToListAsync();
            return Results.Ok(counts.OrderByDescending(c => c.Count));
        }).AllowAnonymous();

        // POPIA: province-level counts only. No name, no town, no coordinate leaves the server here.
        // ponytail: town-level granularity would need small-count suppression before it ships.
        app.MapGet("/api/registrations/by-province", async (VasbytDbContext db) =>
        {
            var counts = await db.Entrants
                .Where(e => e.OrderLine!.Order!.Status == OrderStatus.Paid && e.Province != "")
                .GroupBy(e => e.Province)
                .Select(g => new ProvinceCount(g.Key, g.Count()))
                .ToListAsync();
            return Results.Ok(counts.OrderByDescending(c => c.Count));
        }).AllowAnonymous();

        app.MapGet("/api/routes/{routeCategoryId:int}/gpx", async (
            int routeCategoryId, VasbytDbContext db, IWebHostEnvironment env) =>
        {
            var name = await db.RouteCategories.Where(r => r.Id == routeCategoryId)
                .Select(r => r.GpxFileName).FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(name)) return Results.NotFound();

            // Guard the join: GpxFileName is admin-editable, so treat it as untrusted input.
            var dir = Path.Combine(env.ContentRootPath, "Routes");
            var path = Path.GetFullPath(Path.Combine(dir, name));
            if (!path.StartsWith(dir + Path.DirectorySeparatorChar) || !File.Exists(path))
                return Results.NotFound();

            return Results.File(path, "application/gpx+xml");
        }).AllowAnonymous();

        // The shop. There is no seeded catalogue by design: an admin adds every product through the
        // CMS, so an empty array is the correct answer until they do.
        app.MapGet("/api/products", async (VasbytDbContext db) =>
        {
            var products = await db.Products.Include(p => p.Variants).AsNoTracking()
                .Where(p => p.IsActive).OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();
            return Results.Ok(products.Select(p => new ProductDto(
                p.Id, p.Name, p.Description, MediaStore.Url(p.ImageFileName),
                p.Variants.Where(v => v.IsActive).OrderBy(v => v.Id)
                    .Select(v => new ProductVariantDto(v.Id, v.Label, v.PriceZar, v.Stock)))));
        }).AllowAnonymous();

        // Accommodation listings and sponsor logos share a table and a shape, so they share an
        // endpoint. Omit kind to get both, which is what the sponsors strip in the footer wants.
        app.MapGet("/api/adverts", async (VasbytDbContext db, AdvertKind? kind) =>
        {
            var adverts = await db.Adverts.AsNoTracking()
                .Where(a => a.IsActive && (kind == null || a.Kind == kind))
                .OrderBy(a => a.SortOrder).ThenBy(a => a.Id).ToListAsync();
            return Results.Ok(adverts.Select(a => new AdvertDto(
                a.Id, a.Kind.ToString(), a.Name, a.Blurb, MediaStore.Url(a.ImageFileName),
                a.LinkUrl, a.BookingUrl, a.Phone)));
        }).AllowAnonymous();

        // The standalone /skenk page has no endpoint of its own. A donation is an Order carrying one
        // Donation line: POST /api/orders with DonationZar set and no tickets, then the same
        // /api/orders/{token}/pay-demo. One payment path, one admin reconciliation view.
    }
}
