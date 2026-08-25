using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record DistanceDto(int Id, string Name, decimal DistanceKm, int ElevationGainM, bool HasRoute);
public record EventDto(int Id, string Discipline, string Name, string Blurb,
    DateTime StartDateUtc, bool IsOpen, IEnumerable<DistanceDto> Distances);
public record ProvinceCount(string Province, int Count);
public record CreateDonationRequest(decimal AmountZar, string? Name, string? Email, string? Message);

public static class PublicEndpoints
{
    public static void MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        // The SPA asks for this on boot: it decides whether to load the Google Places script at all.
        app.MapGet("/api/config", (IConfiguration cfg) => Results.Ok(new
        {
            googleMapsApiKey = cfg["GoogleMaps:ApiKey"],
            demoPayments = true,
            // Flat across all four events, which is what lets payment come before the choice.
            entryFeeZar = Pricing.EntryFeeZar(cfg),
        })).AllowAnonymous();

        app.MapGet("/api/events", async (VasbytDbContext db) =>
        {
            var events = await db.Events.Include(e => e.Distances).AsNoTracking()
                .OrderBy(e => e.Discipline).ToListAsync();
            return Results.Ok(events.Select(e => new EventDto(
                e.Id, e.Discipline.ToString(), e.Name, e.Blurb, e.StartDateUtc, e.IsOpen,
                e.Distances.OrderBy(d => d.DistanceKm).Select(d => new DistanceDto(
                    d.Id, d.Name, d.DistanceKm, d.ElevationGainM,
                    !string.IsNullOrEmpty(d.GpxFileName))))));
        }).AllowAnonymous();

        // POPIA: province-level counts only. No name, no town, no coordinate leaves the server here.
        // ponytail: town-level granularity would need small-count suppression before it ships.
        app.MapGet("/api/registrations/by-province", async (VasbytDbContext db) =>
        {
            var counts = await db.Entrants
                .Where(e => e.Order!.Status == OrderStatus.Paid && e.Province != "")
                .GroupBy(e => e.Province)
                .Select(g => new ProvinceCount(g.Key, g.Count()))
                .ToListAsync();
            return Results.Ok(counts.OrderByDescending(c => c.Count));
        }).AllowAnonymous();

        app.MapGet("/api/routes/{distanceId:int}/gpx", async (
            int distanceId, VasbytDbContext db, IWebHostEnvironment env) =>
        {
            var name = await db.EventDistances.Where(d => d.Id == distanceId)
                .Select(d => d.GpxFileName).FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(name)) return Results.NotFound();

            // Guard the join: GpxFileName is admin-editable, so treat it as untrusted input.
            var dir = Path.Combine(env.ContentRootPath, "Routes");
            var path = Path.GetFullPath(Path.Combine(dir, name));
            if (!path.StartsWith(dir + Path.DirectorySeparatorChar) || !File.Exists(path))
                return Results.NotFound();

            return Results.File(path, "application/gpx+xml");
        }).AllowAnonymous();

        var d = app.MapGroup("/api/donations").WithTags("Donations");

        d.MapPost("/", async (CreateDonationRequest req, VasbytDbContext db) =>
        {
            if (req.AmountZar < 10) return Results.Problem("Minimum skenking is R10.", statusCode: 400);
            var donation = new Donation
            {
                AmountZar = req.AmountZar,
                DonorName = req.Name?.Trim(),
                Email = req.Email?.Trim(),
                Message = req.Message?.Trim(),
            };
            db.Donations.Add(donation);
            await db.SaveChangesAsync();
            return Results.Ok(new { token = donation.PublicToken, amountZar = donation.AmountZar });
        }).AllowAnonymous();

        // ponytail: demo payment, same swap as the order one.
        d.MapPost("/{token:guid}/pay-demo", async (Guid token, VasbytDbContext db) =>
        {
            var donation = await db.Donations.FirstOrDefaultAsync(x => x.PublicToken == token);
            if (donation is null) return Results.NotFound();
            donation.Status = OrderStatus.Paid;
            donation.PaymentReference = $"DEMO-D{donation.Id:D6}";
            await db.SaveChangesAsync();
            return Results.Ok(new { status = donation.Status.ToString(), donation.AmountZar });
        }).AllowAnonymous();
    }
}
