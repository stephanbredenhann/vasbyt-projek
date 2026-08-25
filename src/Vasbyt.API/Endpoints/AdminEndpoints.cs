using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record UpdateEntrantRequest(string FirstName, string LastName, string Email, string Phone,
    string ShirtSize, string Town, string Province, string? ClubName, string? MedicalNotes);

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/admin").WithTags("Admin").RequireAuthorization(Roles.Admin);

        // Aggregated in memory rather than with SUM(): SQLite has no decimal type and refuses to
        // translate a decimal SUM at all, so a server-side aggregate here would work on Postgres and
        // throw on the prototype. A field of a few thousand orders fits in memory without complaint.
        // ponytail: push these back down to SQL once the move to Postgres happens and it matters.
        g.MapGet("/stats", async (VasbytDbContext db) =>
        {
            var paid = await db.Orders.Where(o => o.Status == OrderStatus.Paid)
                .Select(o => new { o.EntrantCount, o.AmountZar }).ToListAsync();

            var donations = await db.Donations.Where(d => d.Status == OrderStatus.Paid)
                .Select(d => d.AmountZar).ToListAsync();

            var entrants = await db.Entrants
                .Where(e => e.Order!.Status == OrderStatus.Paid)
                .Select(e => new
                {
                    Name = e.EventDistance!.Event!.Name,
                    Distance = e.EventDistance.Name,
                })
                .ToListAsync();

            return Results.Ok(new
            {
                entrants = await db.Entrants.CountAsync(),
                paidOrders = paid.Count,
                pendingOrders = await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending),
                // Slots sold but never filled in — the "paid for 4, entered 2" gap.
                unfilledSlots = paid.Sum(o => o.EntrantCount) - entrants.Count,
                entryRevenueZar = paid.Sum(o => o.AmountZar),
                donationRevenueZar = donations.Sum(),
                byDistance = entrants
                    .GroupBy(e => new { e.Name, e.Distance })
                    .Select(g => new { g.Key.Name, g.Key.Distance, Count = g.Count() })
                    .OrderByDescending(x => x.Count)
                    .ToList(),
            });
        });

        g.MapGet("/entrants", async (VasbytDbContext db, string? q, int page = 1, int size = 25) =>
        {
            size = Math.Clamp(size, 1, 200);
            var query = db.Entrants.Include(e => e.EventDistance)!.ThenInclude(d => d!.Event)
                .AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(e => e.FirstName.Contains(q) || e.LastName.Contains(q)
                    || e.Email.Contains(q) || e.Town.Contains(q));

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(e => e.Id)
                .Skip((page - 1) * size).Take(size)
                .Select(e => new
                {
                    e.Id, e.FirstName, e.LastName, e.Email, e.Phone, e.Town, e.Province,
                    e.ShirtSize, e.ClubName, e.MedicalNotes,
                    Event = e.EventDistance!.Event!.Name,
                    Distance = e.EventDistance.Name,
                    OrderStatus = e.Order!.Status.ToString(),
                }).ToListAsync();
            return Results.Ok(new { total, page, size, items });
        });

        g.MapPatch("/entrants/{id:int}", async (int id, UpdateEntrantRequest req, VasbytDbContext db) =>
        {
            var e = await db.Entrants.FindAsync(id);
            if (e is null) return Results.NotFound();
            // Admins may correct an entrant's details. They may NOT change how many entrants an
            // order holds — that is what the customer paid for, and it stays fixed.
            (e.FirstName, e.LastName, e.Email, e.Phone) =
                (req.FirstName, req.LastName, req.Email, req.Phone);
            (e.ShirtSize, e.Town, e.Province, e.ClubName, e.MedicalNotes) =
                (req.ShirtSize, req.Town, req.Province, req.ClubName, req.MedicalNotes);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
