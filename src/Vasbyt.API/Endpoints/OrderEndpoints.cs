using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

/// A quantity per (route, tariff) pair, which is exactly what the entry screen collects. No price:
/// the server looks that up itself.
public record CartTicket(int RouteCategoryId, TariffKind TariffKind, int Quantity);

/// A shop line. Same deal as CartTicket: a quantity against an id, and no price.
public record CartProduct(int ProductVariantId, int Quantity);

public record CreateOrderRequest(
    string FirstName, string LastName, string Email, string? Phone,
    IReadOnlyList<CartTicket>? Tickets, decimal? DonationZar,
    IReadOnlyList<CartProduct>? Products);

public record OrderResponse(
    Guid Token, string Reference, string Status, decimal TotalZar, DateTime CreatedUtc,
    string BuyerFirstName, string BuyerLastName, string BuyerEmail, bool IsClaimed,
    IEnumerable<OrderLineDto> Lines, IEnumerable<EntrantSlotDto> Entrants);

public record OrderLineDto(
    int Id, string Kind, string Description, int Quantity, decimal UnitPriceZar,
    decimal LineTotalZar, string? RouteCode, string? TariffKind);

/// POPIA: a participant facing view of an entrant form. No identity number, no medical field, by
/// construction rather than by filtering, the same way /api/registrations/by-province works.
public record EntrantSlotDto(
    int Id, int OrderLineId, string RouteCode, string RouteName, string TariffKind,
    string FirstName, string LastName, bool IsComplete, string? EntryNumber);

/// Spec 8.1. Deliberately carries no route and no tariff: those come off the paid order line.
public record EntrantFormRequest(
    string FirstName, string LastName, string IdNumber, string Email, string Phone,
    DateOnly DateOfBirth, string Gender, string ShirtSize, string StreetAddress, string Town,
    string Province, string PostalCode, string? MedicalConditions, string? Medication,
    string? MedicalFund, string? MedicalFundNumber, string EmergencyName,
    string EmergencyRelationship, string EmergencyPhone, string? ClubName,
    bool AcceptTerms, string? GuardianConsentName, bool PhotoConsent);

public record ClaimRequest(string Email, string Password, string? FirstName, string? LastName);

public static class OrderEndpoints
{
    /// The season these references and entry numbers belong to. ponytail: a constant, not a settings
    /// row, because the next edition is a redeploy anyway.
    public const int EventYear = 2027;

    // The flow the spec describes: one screen combining the six routes and the two tariffs -> the
    // server prices the cart and stores it against a reference -> PAY -> one form per ticket bought,
    // each already bound to its route and tariff.
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/orders").WithTags("Orders");

        g.MapPost("/", async (CreateOrderRequest req, VasbytDbContext db) =>
        {
            var order = await BuildOrderAsync(db, req);
            return order is string problem
                ? Results.Problem(problem, statusCode: 400)
                : Results.Ok(await Load(db, ((Order)order).PublicToken));
        }).AllowAnonymous();

        g.MapGet("/{token:guid}", async (Guid token, VasbytDbContext db) =>
            await Load(db, token) is { } r ? Results.Ok(r) : Results.NotFound()).AllowAnonymous();

        // ponytail: demo payment, flips straight to Paid. Replace with the PSP redirect plus a
        // signed webhook that sets PaymentReference; keep the Paid transition and the Gate call in
        // this one method, so the webhook inherits both without a second code path.
        g.MapPost("/{token:guid}/pay-demo", async (Guid token, VasbytDbContext db) =>
        {
            var order = await Tracked(db, token);
            if (order is null) return Results.NotFound();
            if (order.Status == OrderStatus.Cancelled)
                return Results.Problem("Hierdie bestelling is gekanselleer.", statusCode: 409);

            if (order.Status != OrderStatus.Paid)
            {
                order.Status = OrderStatus.Paid;
                order.PaidUtc = DateTime.UtcNow;
                order.PaymentReference = $"DEMO-{order.Id:D6}";
            }

            // Spec 8: one participant form per ticket bought, created the moment payment lands.
            if (Gate(order) is { } refusal) return refusal;
            await db.SaveChangesAsync();
            return Results.Ok(await Load(db, token));
        }).AllowAnonymous();

        // Fills in a form that payment already created. It cannot create one, cannot move one to
        // another route, and cannot reach a form on an unpaid order.
        g.MapPut("/{token:guid}/entrants/{id:int}", async (
            Guid token, int id, EntrantFormRequest req, VasbytDbContext db) =>
        {
            var order = await Tracked(db, token);
            if (order is null) return Results.NotFound();
            if (Gate(order) is { } refusal) return refusal;

            var entrant = order.Lines.SelectMany(l => l.Entrants).FirstOrDefault(e => e.Id == id);
            if (entrant is null) return Results.NotFound();

            if (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName))
                return Results.Problem("Naam en van word vereis.", statusCode: 400);
            if (string.IsNullOrWhiteSpace(req.IdNumber))
                return Results.Problem("Identiteitsnommer word vereis.", statusCode: 400);
            if (string.IsNullOrWhiteSpace(req.Province))
                return Results.Problem("Provinsie word vereis.", statusCode: 400);
            if (string.IsNullOrWhiteSpace(req.EmergencyName) || string.IsNullOrWhiteSpace(req.EmergencyPhone))
                return Results.Problem("Noodkontakpersoon en -nommer word vereis.", statusCode: 400);
            if (!req.AcceptTerms)
                return Results.Problem("Die voorwaardes en vrywaring moet aanvaar word.", statusCode: 400);
            // ponytail: minority judged at the moment of entry, not on the day of the event. A few
            // days out either way for anyone turning 18 that April; tighten against RouteDay 1 if
            // the organisers care.
            if (IsMinor(req.DateOfBirth) && string.IsNullOrWhiteSpace(req.GuardianConsentName))
                return Results.Problem("Ouer- of voogtoestemming word vir 'n minderjarige vereis.",
                    statusCode: 400);

            entrant.FirstName = req.FirstName.Trim();
            entrant.LastName = req.LastName.Trim();
            entrant.IdNumber = req.IdNumber.Trim();
            entrant.Email = req.Email.Trim();
            entrant.Phone = req.Phone.Trim();
            entrant.DateOfBirth = req.DateOfBirth;
            entrant.Gender = req.Gender;
            entrant.ShirtSize = req.ShirtSize;
            entrant.StreetAddress = req.StreetAddress.Trim();
            entrant.Town = req.Town.Trim();
            entrant.Province = req.Province.Trim();
            entrant.PostalCode = req.PostalCode.Trim();
            entrant.MedicalConditions = req.MedicalConditions?.Trim();
            entrant.Medication = req.Medication?.Trim();
            entrant.MedicalFund = req.MedicalFund?.Trim();
            entrant.MedicalFundNumber = req.MedicalFundNumber?.Trim();
            entrant.EmergencyName = req.EmergencyName.Trim();
            entrant.EmergencyRelationship = req.EmergencyRelationship.Trim();
            entrant.EmergencyPhone = req.EmergencyPhone.Trim();
            entrant.ClubName = req.ClubName?.Trim();
            entrant.GuardianConsentName = req.GuardianConsentName?.Trim();
            entrant.PhotoConsent = req.PhotoConsent;
            entrant.TermsAcceptedUtc = DateTime.UtcNow;
            entrant.IsComplete = true;
            // Spec 9: the bib number exists once the form does, and never changes after that.
            entrant.EntryNumber ??= $"VB{EventYear}-{entrant.Id:D4}";

            await db.SaveChangesAsync();
            return Results.Ok(await Load(db, token));
        }).AllowAnonymous();

        // Registers a new account or signs into an existing one, then attaches this order to it.
        // Runs alongside the first entrant's form, there is no earlier point at which an account exists.
        g.MapPost("/{token:guid}/claim", async (
            Guid token, ClaimRequest req, VasbytDbContext db,
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
                return Results.Problem("Hierdie e-pos is reeds geregistreer, die wagwoord is verkeerd.",
                    statusCode: 401);
            }

            order.UserId = user.Id;
            await db.SaveChangesAsync();
            await signIn.SignInAsync(user, isPersistent: true);
            return Results.Ok(await Load(db, token));
        }).AllowAnonymous();

        app.MapGet("/api/my/orders", async (ClaimsPrincipal principal, VasbytDbContext db,
            UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null) return Results.Unauthorized();

            var tokens = await db.Orders.Where(o => o.UserId == user.Id)
                .OrderByDescending(o => o.CreatedUtc).Select(o => o.PublicToken).ToListAsync();

            var orders = new List<OrderResponse>();
            foreach (var t in tokens) if (await Load(db, t) is { } r) orders.Add(r);
            return Results.Ok(orders);
        }).RequireAuthorization();
    }

    /// <summary>
    /// The one enforced business rule, in one place. Every Entrant in the system is created here and
    /// nowhere else, so none of the three has a path around it:
    /// no form before the order is paid, never more forms than tickets paid for, and the route and
    /// tariff are read off the paid line rather than off anything a browser sent, so a paid R165
    /// student ticket cannot be walked up to an R560 route after the fact.
    /// </summary>
    internal static IResult? Gate(Order order)
    {
        if (order.Status == OrderStatus.Cancelled)
            return Results.Problem("Hierdie bestelling is gekanselleer.", statusCode: 409);
        if (order.Status != OrderStatus.Paid)
            return Results.Problem(
                "Betaling word eers vereis voordat deelnemersvorms beskikbaar is.", statusCode: 403);

        foreach (var line in order.Lines.Where(l => l.Kind == OrderLineKind.Ticket))
        {
            // The quantity paid for is the only bound. Already-created forms are never duplicated,
            // so this is safe to run again on every request that touches a form.
            var missing = line.Quantity - line.Entrants.Count;
            for (var i = 0; i < missing; i++)
                line.Entrants.Add(new Entrant
                {
                    RouteCategoryId = line.RouteCategoryId!.Value,
                    TariffKind = line.TariffKind!.Value,
                });
        }
        return null;
    }

    /// Returns the saved Order, or an Afrikaans problem string. Every amount on it is looked up
    /// server side: the request carries quantities and nothing else.
    private static async Task<object> BuildOrderAsync(VasbytDbContext db, CreateOrderRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName))
            return "Naam en van van die koper word vereis.";
        if (string.IsNullOrWhiteSpace(req.Email))
            return "E-posadres van die koper word vereis.";

        var tickets = (req.Tickets ?? []).Where(t => t.Quantity > 0).ToList();
        var products = (req.Products ?? []).Where(p => p.Quantity > 0).ToList();
        if (tickets.Count == 0 && products.Count == 0 && req.DonationZar is null or <= 0)
            return "Kies asseblief ten minste een inskrywing, produk of 'n skenking.";
        if (tickets.Sum(t => t.Quantity) > 20)
            return "Hoogstens 20 inskrywings per bestelling. Doen asseblief 'n tweede bestelling.";
        if (req.DonationZar is > 0 and < 10)
            return "Minimum skenking is R10.";

        var now = DateTime.UtcNow;
        var order = new Order
        {
            BuyerFirstName = req.FirstName.Trim(),
            BuyerLastName = req.LastName.Trim(),
            BuyerEmail = req.Email.Trim(),
            BuyerPhone = req.Phone?.Trim() ?? "",
        };

        foreach (var t in tickets)
        {
            var route = await db.RouteCategories.AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == t.RouteCategoryId);
            if (route is null) return "Kies asseblief 'n geldige roetekategorie.";
            if (!route.IsOpen) return $"Inskrywings vir {route.Name} is gesluit.";

            var rule = await Pricing.RuleAsync(db, t.TariffKind, now);
            if (rule is null) return "Inskrywings is gesluit.";

            order.Lines.Add(new OrderLine
            {
                Kind = OrderLineKind.Ticket,
                RouteCategoryId = route.Id,
                TariffKind = t.TariffKind,
                Description = $"{route.Name} - {rule.Label}",
                Quantity = t.Quantity,
                UnitPriceZar = rule.AmountZar,
                LineTotalZar = rule.AmountZar * t.Quantity,
            });
        }

        // Shop lines. Priced off ProductVariant.PriceZar the same way a ticket is priced off the
        // rule, and carrying no RouteCategoryId or TariffKind, so Gate never sees one.
        foreach (var p in products)
        {
            var variant = await db.ProductVariants.AsNoTracking().Include(v => v.Product)
                .FirstOrDefaultAsync(v => v.Id == p.ProductVariantId);
            if (variant is null || !variant.IsActive || variant.Product is not { IsActive: true })
                return "Kies asseblief 'n geldige produk.";

            order.Lines.Add(new OrderLine
            {
                Kind = OrderLineKind.Product,
                ProductVariantId = variant.Id,
                Description = $"{variant.Product.Name} - {variant.Label}",
                Quantity = p.Quantity,
                UnitPriceZar = variant.PriceZar,
                LineTotalZar = variant.PriceZar * p.Quantity,
            });
        }

        // Spec 6.2: the donation is a line on the order, not a record of its own.
        if (req.DonationZar is > 0)
            order.Lines.Add(new OrderLine
            {
                Kind = OrderLineKind.Donation,
                Description = "Skenking aan Orania Helpmekaar",
                Quantity = 1,
                UnitPriceZar = req.DonationZar.Value,
                LineTotalZar = req.DonationZar.Value,
            });

        // ponytail: Stock is displayed but never decremented. Doing it safely needs an atomic
        // `UPDATE ... SET Stock = Stock - n WHERE Id = @id AND Stock >= n` plus a release path for
        // orders that are never paid, and the shop sells a handful of shirts. Add both together the
        // day overselling actually costs something.

        // Spec 6.3: the total is the sum of the lines, recalculated here before payment starts.
        order.TotalZar = order.Lines.Sum(l => l.LineTotalZar);

        db.Orders.Add(order);
        // The reference wants the row's id, so it can only land on a second save. The token stands
        // in until then, because Reference is unique and two orders created at the same instant
        // would otherwise collide on an empty string.
        order.Reference = order.PublicToken.ToString();
        await db.SaveChangesAsync();
        order.Reference = $"VB-{EventYear}-{order.Id:D6}";
        await db.SaveChangesAsync();
        return order;
    }

    private static bool IsMinor(DateOnly dateOfBirth) =>
        dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-18);

    /// Tracked, with everything Gate and the form endpoint need to reach.
    private static Task<Order?> Tracked(VasbytDbContext db, Guid token) =>
        db.Orders.Include(o => o.Lines).ThenInclude(l => l.Entrants)
            .FirstOrDefaultAsync(o => o.PublicToken == token);

    private static async Task<OrderResponse?> Load(VasbytDbContext db, Guid token)
    {
        var o = await db.Orders
            .Include(x => x.Lines).ThenInclude(l => l.RouteCategory)
            .Include(x => x.Lines).ThenInclude(l => l.Entrants).ThenInclude(e => e.RouteCategory)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PublicToken == token);
        if (o is null) return null;

        return new OrderResponse(
            o.PublicToken, o.Reference, o.Status.ToString(), o.TotalZar, o.CreatedUtc,
            o.BuyerFirstName, o.BuyerLastName, o.BuyerEmail, o.UserId is not null,
            o.Lines.OrderBy(l => l.Id).Select(l => new OrderLineDto(
                l.Id, l.Kind.ToString(), l.Description, l.Quantity, l.UnitPriceZar, l.LineTotalZar,
                l.RouteCategory?.Code, l.TariffKind?.ToString())),
            o.Lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).Select(e => new EntrantSlotDto(
                e.Id, e.OrderLineId, e.RouteCategory?.Code ?? "", e.RouteCategory?.Name ?? "",
                e.TariffKind.ToString(), e.FirstName, e.LastName, e.IsComplete, e.EntryNumber)));
    }
}
