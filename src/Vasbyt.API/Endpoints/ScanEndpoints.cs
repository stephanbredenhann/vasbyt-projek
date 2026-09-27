using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record ScanRequest(string? Code);

public static partial class ScanEndpoints
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
            else if (EntryNumber().IsMatch(code.ToUpperInvariant()))
                query = query.Where(e => e.EntryNumber == code.ToUpperInvariant());
            else
                return Results.Problem("Gebruik 'n Vasbyt 2027 QR-kode of 'n geldige inskrywingsnommer.", statusCode: 400);

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

        group.MapPost("/entrants/{id:int}/check-in", async (int id, VasbytDbContext db, HttpContext context) =>
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
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.CheckedInUtc, DateTime.UtcNow));
            return Results.Ok(await Details(db, id));
        });
    }

    private static async Task<object?> Details(VasbytDbContext db, int id) =>
        await db.Entrants.AsNoTracking().Where(e => e.Id == id).Select(e => new
        {
            e.Id, e.EntryNumber, e.CheckedInUtc, e.IsComplete, e.FirstName, e.LastName, e.IdNumber,
            e.Email, e.Phone, e.DateOfBirth, e.Gender, e.ShirtSize, e.StreetAddress, e.Town,
            e.Province, e.PostalCode, e.MedicalConditions, e.Medication, e.MedicalFund,
            e.MedicalFundNumber, e.EmergencyName, e.EmergencyRelationship, e.EmergencyPhone,
            e.ClubName, Route = e.RouteCategory!.Name, RouteCode = e.RouteCategory.Code,
            Tariff = e.TariffKind.ToString(), OrderReference = e.OrderLine!.Order!.Reference,
            OrderStatus = e.OrderLine.Order.Status.ToString(),
            OrderLines = e.OrderLine.Order.Lines.OrderBy(l => l.Id).Select(l => new
            {
                l.Id, Kind = l.Kind.ToString(), l.Description, l.Quantity,
                l.UnitPriceZar, l.LineTotalZar,
            }),
        }).SingleOrDefaultAsync();

    [GeneratedRegex(@"\AVB2027-\d{4,10}\z", RegexOptions.CultureInvariant)]
    private static partial Regex EntryNumber();
}
