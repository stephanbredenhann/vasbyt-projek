using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record CreateOrderRequest(int EntrantCount);

public record OrderResponse(
    Guid Token, int EntrantCount, decimal AmountZar, decimal EntryFeeZar, string Status,
    int EntrantsFilled, bool IsClaimed, IEnumerable<EntrantSummary> Entrants);

public record EntrantSummary(
    int Id, string FirstName, string LastName, string Town, string Province,
    string EventName, string DistanceName, Discipline Discipline);

public record CreateEntrantRequest(
    int EventDistanceId, string FirstName, string LastName, string Email, string Phone,
    DateOnly DateOfBirth, string Gender, string ShirtSize, string EmergencyName,
    string EmergencyPhone, string? MedicalNotes, string Town, string Province, string? ClubName);

public record ClaimRequest(string Email, string Password, string? FirstName, string? LastName);

public static class OrderEndpoints
{
    // The flow the organisers specified: choose how many people -> PAY -> fill one form per person,
    // each picking their own event -> the first of those forms also creates the account.
    //
    // The entry fee is flat across all four events, which is what lets payment come before anyone
    // has chosen one. An order is immutable once paid: the wrong count means paying again.
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/orders").WithTags("Orders");

        g.MapPost("/", async (CreateOrderRequest req, VasbytDbContext db, IConfiguration cfg) =>
        {
            if (req.EntrantCount is < 1 or > 20)
                return Results.Problem("Aantal deelnemers moet tussen 1 en 20 wees.", statusCode: 400);

            var fee = Pricing.EntryFeeZar(cfg);
            var order = new Order
            {
                EntrantCount = req.EntrantCount,
                // Priced on the server from config; the client never says what anything costs.
                AmountZar = fee * req.EntrantCount,
            };
            db.Orders.Add(order);
            await db.SaveChangesAsync();
            return Results.Ok(await Load(db, order.PublicToken, fee));
        }).AllowAnonymous();

        g.MapGet("/{token:guid}", async (Guid token, VasbytDbContext db, IConfiguration cfg) =>
            await Load(db, token, Pricing.EntryFeeZar(cfg)) is { } r
                ? Results.Ok(r) : Results.NotFound()).AllowAnonymous();

        // ponytail: demo payment — flips straight to Paid. Replace with the PSP redirect plus a
        // signed webhook that sets PaymentReference; keep the Paid transition in this one method.
        g.MapPost("/{token:guid}/pay-demo", async (Guid token, VasbytDbContext db, IConfiguration cfg) =>
        {
            var order = await db.Orders.FirstOrDefaultAsync(o => o.PublicToken == token);
            if (order is null) return Results.NotFound();
            if (order.Status == OrderStatus.Cancelled)
                return Results.Problem("Hierdie bestelling is gekanselleer.", statusCode: 409);

            if (order.Status != OrderStatus.Paid)
            {
                order.Status = OrderStatus.Paid;
                order.PaidUtc = DateTime.UtcNow;
                order.PaymentReference = $"DEMO-{order.Id:D6}";
                await db.SaveChangesAsync();
            }

            return Results.Ok(await Load(db, token, Pricing.EntryFeeZar(cfg)));
        }).AllowAnonymous();

        g.MapPost("/{token:guid}/entrants", async (
            Guid token, CreateEntrantRequest req, VasbytDbContext db, IConfiguration cfg) =>
        {
            var order = await db.Orders.Include(o => o.Entrants)
                .FirstOrDefaultAsync(o => o.PublicToken == token);
            if (order is null) return Results.NotFound();
            if (Gate(order) is { } refusal) return refusal;

            var distance = await db.EventDistances.Include(d => d.Event)
                .FirstOrDefaultAsync(d => d.Id == req.EventDistanceId);
            if (distance is null) return Results.Problem("Kies asseblief 'n geleentheid.", statusCode: 400);
            if (distance.Event?.IsOpen != true)
                return Results.Problem("Inskrywings vir hierdie geleentheid is gesluit.", statusCode: 409);

            if (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName))
                return Results.Problem("Naam en van word vereis.", statusCode: 400);
            if (string.IsNullOrWhiteSpace(req.Province))
                return Results.Problem("Provinsie word vereis.", statusCode: 400);

            db.Entrants.Add(new Entrant
            {
                OrderId = order.Id,
                EventDistanceId = distance.Id,
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                Email = req.Email.Trim(),
                Phone = req.Phone.Trim(),
                DateOfBirth = req.DateOfBirth,
                Gender = req.Gender,
                ShirtSize = req.ShirtSize,
                EmergencyName = req.EmergencyName.Trim(),
                EmergencyPhone = req.EmergencyPhone.Trim(),
                MedicalNotes = req.MedicalNotes,
                Town = req.Town.Trim(),
                Province = req.Province.Trim(),
                ClubName = req.ClubName?.Trim(),
            });
            await db.SaveChangesAsync();
            return Results.Ok(await Load(db, token, Pricing.EntryFeeZar(cfg)));
        }).AllowAnonymous();

        // Registers a new account or signs into an existing one, then attaches this order to it.
        // Runs alongside entrant #1's form — there is no earlier point at which an account exists.
        g.MapPost("/{token:guid}/claim", async (
            Guid token, ClaimRequest req, VasbytDbContext db, IConfiguration cfg,
            UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var order = await db.Orders.FirstOrDefaultAsync(o => o.PublicToken == token);
            if (order is null) return Results.NotFound();
            if (order.Status != OrderStatus.Paid)
                return Results.Problem("Betaling word eers vereis.", statusCode: 403);
            if (order.UserId is not null)
                return Results.Problem("Hierdie bestelling is reeds aan 'n rekening gekoppel.", statusCode: 409);

            var user = await users.FindByEmailAsync(req.Email);
            if (user is null)
            {
                user = new AppUser
                {
                    UserName = req.Email,
                    Email = req.Email,
                    FirstName = req.FirstName ?? "",
                    LastName = req.LastName ?? "",
                };
                var created = await users.CreateAsync(user, req.Password);
                if (!created.Succeeded)
                    return Results.Problem(string.Join(" ", created.Errors.Select(e => e.Description)),
                        statusCode: 400);
                await users.AddToRoleAsync(user, Roles.Participant);
            }
            else if (!await users.CheckPasswordAsync(user, req.Password))
            {
                return Results.Problem("Hierdie e-pos is reeds geregistreer — die wagwoord is verkeerd.",
                    statusCode: 401);
            }

            order.UserId = user.Id;
            await db.SaveChangesAsync();
            await signIn.SignInAsync(user, isPersistent: true);
            return Results.Ok(await Load(db, token, Pricing.EntryFeeZar(cfg)));
        }).AllowAnonymous();

        app.MapGet("/api/my/orders", async (ClaimsPrincipal principal, VasbytDbContext db,
            IConfiguration cfg, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null) return Results.Unauthorized();

            var fee = Pricing.EntryFeeZar(cfg);
            var tokens = await db.Orders.Where(o => o.UserId == user.Id)
                .OrderByDescending(o => o.CreatedUtc).Select(o => o.PublicToken).ToListAsync();

            var orders = new List<OrderResponse>();
            foreach (var t in tokens) if (await Load(db, t, fee) is { } r) orders.Add(r);
            return Results.Ok(orders);
        }).RequireAuthorization();
    }

    /// The strict rule, in one place. Every entrant in the system is created through the endpoint
    /// that calls this, so there is no second path around it.
    private static IResult? Gate(Order order) => order.Status switch
    {
        OrderStatus.Pending => Results.Problem(
            "Betaling word eers vereis voordat deelnemers bygevoeg kan word.", statusCode: 403),
        OrderStatus.Cancelled => Results.Problem(
            "Hierdie bestelling is gekanselleer.", statusCode: 409),
        _ when order.Entrants.Count >= order.EntrantCount => Results.Problem(
            $"Al {order.EntrantCount} plekke op hierdie bestelling is gevul. "
            + "Doen asseblief 'n nuwe bestelling vir verdere deelnemers.", statusCode: 409),
        _ => null,
    };

    private static async Task<OrderResponse?> Load(VasbytDbContext db, Guid token, decimal fee)
    {
        var o = await db.Orders
            .Include(x => x.Entrants).ThenInclude(e => e.EventDistance!).ThenInclude(d => d.Event)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PublicToken == token);
        if (o is null) return null;

        return new OrderResponse(
            o.PublicToken, o.EntrantCount, o.AmountZar, fee, o.Status.ToString(),
            o.Entrants.Count, o.UserId is not null,
            o.Entrants.OrderBy(e => e.Id).Select(e => new EntrantSummary(
                e.Id, e.FirstName, e.LastName, e.Town, e.Province,
                e.EventDistance?.Event?.Name ?? "",
                e.EventDistance?.Name ?? "",
                e.EventDistance?.Event?.Discipline ?? Discipline.Run)));
    }
}

/// One flat entry fee for all four events — the reason payment can come before anyone has chosen
/// which one they are doing. ponytail: config, not a settings table, until an admin needs to change
/// it without a redeploy.
public static class Pricing
{
    public const decimal DefaultEntryFeeZar = 1200m;

    public static decimal EntryFeeZar(IConfiguration cfg) =>
        cfg.GetValue<decimal?>("Pricing:EntryFeeZar") ?? DefaultEntryFeeZar;
}
