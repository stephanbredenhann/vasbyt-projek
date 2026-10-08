using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record ScanRequest(string? Code);

public static class ScanEndpoints
{
    public static void MapScanEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").RequireAuthorization(Roles.Admin).WithTags("Reception");
        group.MapPost("/scan", async (ScanRequest request, VasbytDbContext db, HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var code = request.Code?.Trim() ?? "";
            var prefix = $"VASBYT:{OrderEndpoints.EventYear}:";
            var query = db.Entrants.AsNoTracking();
            if (code.StartsWith(prefix, StringComparison.Ordinal)
                && Guid.TryParseExact(code[prefix.Length..], "D", out var token))
                query = query.Where(e => e.QrToken == token);
            else if (EntryNumber.IsMatch(code.ToUpperInvariant()))
                query = query.Where(e => e.EntryNumber == code.ToUpperInvariant());
            else
                return Results.Problem($"Gebruik 'n Vasbyt {OrderEndpoints.EventYear} QR-kode of 'n geldige inskrywingsnommer.", statusCode: 400);

            var entrant = await query.Select(e => new
            {
                e.Id, e.IsComplete, Status = e.OrderLine!.Order!.Status,
            }).SingleOrDefaultAsync();
            if (entrant is null)
                return Results.Problem("Geen deelnemer met hierdie kode gevind nie.", statusCode: 404);
            if (!entrant.IsComplete || entrant.Status != OrderStatus.Paid)
                return Results.Problem("Hierdie inskrywing is onvoltooid, onbetaal of gekanselleer.", statusCode: 409);
            return Results.Ok(await Details(db, entrant.Id));
        });

        group.MapPost("/entrants/{id:int}/check-in", async (int id, VasbytDbContext db, HttpContext context, ClaimsPrincipal user) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var entrant = await db.Entrants.AsNoTracking().Where(e => e.Id == id)
                .Select(e => new { e.IsComplete, Status = e.OrderLine!.Order!.Status }).SingleOrDefaultAsync();
            if (entrant is null) return Results.NotFound();
            if (!entrant.IsComplete || entrant.Status != OrderStatus.Paid)
                return Results.Problem("Slegs voltooide, betaalde inskrywings kan aangemeld word.", statusCode: 409);

            // A conditional update keeps the first arrival time even if two admins check in together.
            await db.Entrants.Where(e => e.Id == id && e.CheckedInUtc == null && e.IsComplete
                    && e.OrderLine!.Order!.Status == OrderStatus.Paid)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(e => e.CheckedInUtc, DateTime.UtcNow)
                    .SetProperty(e => e.CheckedInBy, user.FindFirstValue(ClaimTypes.Email) ?? user.Identity!.Name));
            return Results.Ok(await Details(db, id));
        });

        // Sibling switching at the desk: same details as a scan, found by id.
        group.MapGet("/entrants/{id:int}", async (int id, VasbytDbContext db, HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            return await Details(db, id) is { } details ? Results.Ok(details) : Results.NotFound();
        });

        // Undo for a mistaken check-in at the desk.
        group.MapDelete("/entrants/{id:int}/check-in", async (int id, VasbytDbContext db, HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var changed = await db.Entrants.Where(e => e.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.CheckedInUtc, (DateTime?)null)
                    .SetProperty(e => e.CheckedInBy, (string?)null));
            return changed == 0 ? Results.NotFound() : Results.Ok(await Details(db, id));
        });
    }

    private static async Task<object?> Details(VasbytDbContext db, int id)
    {
        var owner = await db.Entrants.AsNoTracking().Where(e => e.Id == id)
            .Select(e => new { e.OrderLine!.OrderId, e.OrderLine.Order!.UserId }).SingleOrDefaultAsync();
        if (owner is null) return null;
        var orderId = owner.OrderId;
        var userId = owner.UserId;
        // Same order, plus the account's other paid orders; incomplete forms are listed but flagged.
        var siblings = await db.Entrants.AsNoTracking()
            .Where(o => o.Id != id && o.OrderLine!.Order!.Status == OrderStatus.Paid
                && (o.OrderLine.OrderId == orderId || (userId != null && o.OrderLine.Order.UserId == userId)))
            .OrderBy(o => o.OrderLine!.OrderId).ThenBy(o => o.Id)
            .Select(o => new
            {
                o.Id, FullName = o.FirstName + " " + o.LastName, Route = o.RouteCategory!.Name,
                o.EntryNumber, o.IsComplete, CheckedIn = o.CheckedInUtc != null,
            }).ToListAsync();
        return await db.Entrants.AsNoTracking().Where(e => e.Id == id).Select(e => new
        {
            e.Id, e.EntryNumber, e.CheckedInUtc, e.CheckedInBy, e.IsComplete, e.FirstName, e.LastName,
            // POPIA: reception only needs enough of the ID to match a card, the admin entrant page has the rest.
            IdNumber = e.IdNumber.Length > 4 ? new string('•', e.IdNumber.Length - 4) + e.IdNumber.Substring(e.IdNumber.Length - 4) : e.IdNumber,
            e.Email, e.Phone, e.DateOfBirth, e.Gender, e.ShirtSize, e.StreetAddress, e.Town,
            e.Province, e.PostalCode, e.MedicalConditions, e.Medication, e.MedicalFund,
            e.MedicalFundNumber, e.EmergencyName, e.EmergencyRelationship, e.EmergencyPhone,
            e.ClubName, Route = e.RouteCategory!.Name, RouteCode = e.RouteCategory.Code,
            Tariff = e.TariffKind.ToString(),
            OrderId = e.OrderLine!.OrderId, OrderReference = e.OrderLine.Order!.Reference,
            OrderStatus = e.OrderLine.Order.Status.ToString(),
            OrderPaidUtc = e.OrderLine.Order.PaidUtc, OrderTotalZar = e.OrderLine.Order.TotalZar,
            BuyerName = e.OrderLine.Order.BuyerFirstName + " " + e.OrderLine.Order.BuyerLastName,
            BuyerEmail = e.OrderLine.Order.BuyerEmail, BuyerPhone = e.OrderLine.Order.BuyerPhone,
            AccountEmail = e.OrderLine.Order.User != null ? e.OrderLine.Order.User.Email : null,
            OrderLines = e.OrderLine.Order.Lines.OrderBy(l => l.Id).Select(l => new
            {
                l.Id, Kind = l.Kind.ToString(), l.Description, l.Quantity,
                l.UnitPriceZar, l.LineTotalZar, l.CollectedQuantity,
            }),
            Siblings = siblings,
        }).SingleOrDefaultAsync();
    }

    private static readonly Regex EntryNumber =
        new($@"\AVB{OrderEndpoints.EventYear}-\d{{4,10}}\z", RegexOptions.CultureInvariant);
}
