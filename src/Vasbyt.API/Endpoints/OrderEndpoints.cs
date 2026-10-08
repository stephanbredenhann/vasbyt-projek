using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
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
    IReadOnlyList<CartProduct>? Products, Guid? CheckoutKey = null, string? Lang = null);

public record UpdateOrderRequest(
    string FirstName, string LastName, string Email, string? Phone,
    IReadOnlyList<CartTicket>? Tickets, decimal? DonationZar,
    IReadOnlyList<CartProduct>? Products, uint Version, decimal? ExpectedTotalZar = null, string? Lang = null);

public record PayDemoRequest(uint? Version, decimal? ExpectedTotalZar);

public record OrderResponse(
    Guid Token, string Reference, string Status, decimal TotalZar, DateTime CreatedUtc,
    string BuyerFirstName, string BuyerLastName, string BuyerEmail, string BuyerPhone, uint Version, bool IsClaimed,
    IEnumerable<OrderLineDto> Lines, IEnumerable<EntrantSlotDto> Entrants, DateTime? ConfirmationEmailSentUtc);

public record OrderLineDto(
    int Id, string Kind, string Description, int Quantity, decimal UnitPriceZar,
    decimal LineTotalZar, string? RouteCode, string? TariffKind,
    int? ProductVariantId, int? RouteCategoryId, int CollectedQuantity);

/// POPIA: a participant facing view of an entrant form. No identity number, no medical field, by
/// construction rather than by filtering, the same way /api/registrations/by-province works.
public record EntrantSlotDto(
    int Id, int OrderLineId, string RouteCode, string RouteName, string TariffKind,
    string FirstName, string LastName, bool IsComplete, string? EntryNumber, string? QrPayload);

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
    public const int MaxQuantity = 20;

    // The flow the spec describes: one screen combining the six routes and the two tariffs -> the
    // server prices the cart and stores it against a reference -> PAY -> one form per ticket bought,
    // each already bound to its route and tariff.
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/orders").WithTags("Orders");
        g.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });

        g.MapPost("/quote", async (CreateOrderRequest req, VasbytDbContext db) =>
        {
            var (order, error, outOfStock) = await OrderPricing.QuoteAsync(db, req, false);
            return error is not null ? Results.Problem(error, statusCode: outOfStock ? 409 : 400) : Results.Ok(new
            {
                lines = order!.Lines.Select(l => new
                {
                    kind = l.Kind.ToString(), l.Description, l.Quantity, l.UnitPriceZar,
                    l.LineTotalZar, l.ProductVariantId, l.RouteCategoryId,
                    tariffKind = l.TariffKind?.ToString(),
                }),
                order.TotalZar,
            });
        }).AllowAnonymous();

        g.MapPost("/", async (CreateOrderRequest req, VasbytDbContext db, HttpContext context,
            UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(context.User);
            var fingerprint = OrderPricing.Fingerprint(req);
            if (req.CheckoutKey is { } key && await db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(o => o.CheckoutKey == key) is { } existing)
                return await KeyedResult(db, existing, fingerprint, user);
            var (order, error, outOfStock) = await OrderPricing.QuoteAsync(db, req, true);
            if (error is not null) return Results.Problem(error, statusCode: outOfStock ? 409 : 400);
            order!.CheckoutKey = req.CheckoutKey;
            order.Language = req.Lang == "en" ? "en" : "af";
            order.CheckoutFingerprint = req.CheckoutKey is null ? null : fingerprint;
            order.UserId = user?.Id;
            try
            {
                await PersistNewOrder(db, order);
            }
            catch (DbUpdateException e) when (req.CheckoutKey is not null &&
                e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                db.ChangeTracker.Clear();
                var winner = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.CheckoutKey == req.CheckoutKey);
                if (winner is null) throw;
                return await KeyedResult(db, winner, fingerprint, user);
            }
            return Results.Ok(await Load(db, order.PublicToken));
        }).AllowAnonymous();

        g.MapPut("/{token:guid}", async (Guid token, UpdateOrderRequest req, VasbytDbContext db) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            if (!await LockRow(db, "Orders", "PublicToken", token)) return Results.NotFound();
            var order = await db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.PublicToken == token);
            if (order is null) return Results.NotFound();
            if (order.Status != OrderStatus.Pending || order.Version != req.Version)
                return Results.Problem("Bestelling is reeds betaal of intussen verander.", statusCode: 409);
            var (quote, error, outOfStock) = await OrderPricing.QuoteAsync(db,
                new(req.FirstName, req.LastName, req.Email, req.Phone, req.Tickets, req.DonationZar, req.Products), true);
            if (error is not null) return Results.Problem(error, statusCode: outOfStock ? 409 : 400);
            if (req.ExpectedTotalZar is { } expected && expected != quote!.TotalZar)
                return Results.Problem("Prys het verander. Hersien die nuwe totaal voor betaling.", statusCode: 409);
            db.OrderLines.RemoveRange(order.Lines);
            order.Lines = quote!.Lines;
            order.BuyerFirstName = quote.BuyerFirstName;
            order.BuyerLastName = quote.BuyerLastName;
            order.BuyerEmail = quote.BuyerEmail;
            order.BuyerPhone = quote.BuyerPhone;
            if (req.Lang is "af" or "en") order.Language = req.Lang;
            order.TotalZar = quote.TotalZar;
            db.Entry(order).Property(o => o.BuyerEmail).IsModified = true;
            try { await db.SaveChangesAsync(); await tx.CommitAsync(); }
            catch (DbUpdateConcurrencyException)
            {
                await tx.RollbackAsync();
                return Results.Problem("Bestelling is intussen verander.", statusCode: 409);
            }
            return Results.Ok(await Load(db, token));
        }).AllowAnonymous();

        g.MapPost("/{token:guid}/link", async (Guid token, VasbytDbContext db,
            ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null) return Results.Unauthorized();
            var order = await db.Orders.FirstOrDefaultAsync(o => o.PublicToken == token);
            if (order is null) return Results.NotFound();
            if (order.UserId == user.Id) return Results.Ok(await Load(db, token));
            if (order.UserId is not null) return Results.Problem("Bestelling behoort aan 'n ander rekening.", statusCode: 409);
            order.UserId = user.Id;
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
                var owner = await db.Orders.AsNoTracking().Where(o => o.PublicToken == token).Select(o => o.UserId).SingleAsync();
                if (owner != user.Id) return Results.Problem("Bestelling behoort aan 'n ander rekening.", statusCode: 409);
            }
            return Results.Ok(await Load(db, token));
        }).RequireAuthorization();

        g.MapGet("/{token:guid}", async (Guid token, VasbytDbContext db) =>
            await Load(db, token) is { } r ? Results.Ok(r) : Results.NotFound()).AllowAnonymous();

        // Demo payment, flips straight to Paid. Off with Payments:DemoEnabled=false.
        g.MapPost("/{token:guid}/pay-demo", async (Guid token, HttpRequest request,
            VasbytDbContext db, OrderConfirmationEmail email, IConfiguration cfg) =>
        {
            if (!DemoPaymentsEnabled(cfg)) return Results.NotFound();
            var (intent, bad) = await ReadIntentAsync(request);
            if (bad is not null) return bad;
            await using var tx = await db.Database.BeginTransactionAsync();
            if (!await LockRow(db, "Orders", "PublicToken", token)) return Results.NotFound();
            var order = await Tracked(db, token);
            if (order is null) return Results.NotFound();
            if (order.Status == OrderStatus.Pending && await CheckPayableAsync(db, order, intent, lockStock: true) is { } refusal)
                return refusal;
            return await MarkPaidAsync(db, tx, order, $"DEMO-{order.Id:D6}", email);
        }).AllowAnonymous();

        // Kwik: checks the order is still payable as reviewed, then hands back the hosted checkout URL.
        g.MapPost("/{token:guid}/pay", async (Guid token, HttpRequest request, VasbytDbContext db, KwikPayments kwik) =>
        {
            if (!kwik.Enabled) return Results.NotFound();
            var (intent, bad) = await ReadIntentAsync(request);
            if (bad is not null) return bad;
            var order = await Tracked(db, token);
            if (order is null) return Results.NotFound();
            if (order.Status != OrderStatus.Pending)
                return Results.Problem("Hierdie bestelling kan nie meer betaal word nie.", statusCode: 409);
            if (await CheckPayableAsync(db, order, intent, lockStock: false) is { } refusal) return refusal;
            return await kwik.CreateLinkAsync(order) is { } url
                ? Results.Ok(new { url })
                : Results.Problem("Die betaalportaal is nie nou beskikbaar nie. Probeer asseblief weer.", statusCode: 502);
        }).AllowAnonymous();

        // The browser lands back from Kwik and asks us to check. Answers with the order either way.
        g.MapPost("/{token:guid}/pay/verify", async (Guid token, VasbytDbContext db, KwikPayments kwik, OrderConfirmationEmail email) =>
            await VerifyKwikAsync(db, token, kwik, email) ?? Results.NotFound()).AllowAnonymous();

        // Kwik's server-to-server notice. Its contents are only used to find the order to look up.
        app.MapPost("/api/payments/kwik/webhook", async (JsonElement body, VasbytDbContext db, KwikPayments kwik, OrderConfirmationEmail email) =>
        {
            if (KwikPayments.WebhookOrderToken(body) is { } token) await VerifyKwikAsync(db, token, kwik, email);
            return Results.Ok();
        }).AllowAnonymous().WithTags("Orders");

        // Fills in a form that payment already created. It cannot create one, cannot move one to
        // another route, and cannot reach a form on an unpaid order.
        g.MapPut("/{token:guid}/entrants/{id:int}", async (
            Guid token, int id, EntrantFormRequest req, VasbytDbContext db, OrderConfirmationEmail email, PassQueue passes) =>
        {
            var order = await Tracked(db, token);
            if (order is null) return Results.NotFound();
            if (Gate(order) is { } refusal) return refusal;

            var entrant = order.Lines.SelectMany(l => l.Entrants).FirstOrDefault(e => e.Id == id);
            if (entrant is null) return Results.NotFound();
            if (entrant.CheckedInUtc is not null)
                return Results.Problem("Hierdie deelnemer is reeds aangemeld. Kontak die organiseerders vir veranderinge.",
                    statusCode: 409);

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

            var sendPass = !entrant.IsComplete || !string.Equals(entrant.Email, req.Email.Trim(), StringComparison.OrdinalIgnoreCase);
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

            if (!await SaveGatedAsync(db, order))
                return Results.Problem("Die bestelling is intussen verander. Probeer asseblief weer.", statusCode: 409);
            if (sendPass) passes.Enqueue(entrant.Id);
            await SendCompletedConfirmation(db, token, email);
            return Results.Ok(await Load(db, token));
        }).AllowAnonymous();

        g.MapPost("/{token:guid}/confirmation-email", async (Guid token, VasbytDbContext db, OrderConfirmationEmail email) =>
        {
            if (!await db.Orders.AnyAsync(o => o.PublicToken == token)) return Results.NotFound();
            await SendCompletedConfirmation(db, token, email);
            return Results.Ok(await Load(db, token));
        }).AllowAnonymous();

        // Registers a new account or signs into an existing one, then attaches this order to it.
        // Runs alongside the first entrant's form, there is no earlier point at which an account exists.
        g.MapPost("/{token:guid}/claim", async (
            Guid token, ClaimRequest req, VasbytDbContext db,
            UserManager<AppUser> users, SignInManager<AppUser> signIn, ClaimsPrincipal principal) =>
        {
            var order = await db.Orders.FirstOrDefaultAsync(o => o.PublicToken == token);
            if (order is null) return Results.NotFound();
            if (order.Status != OrderStatus.Paid)
                return Results.Problem("Betaling word eers vereis.", statusCode: 403);
            if (order.UserId is not null)
                return Results.Problem("Hierdie bestelling is reeds aan 'n rekening gekoppel.", statusCode: 409);

            var activeUser = await users.GetUserAsync(principal);
            if (activeUser is not null && !string.Equals(activeUser.Email, req.Email, StringComparison.OrdinalIgnoreCase))
                return Results.Problem("Meld eers van die huidige rekening af.", statusCode: 409);

            var user = activeUser ?? await users.FindByEmailAsync(req.Email);
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
            else if (activeUser is null)
            {
                var result = await signIn.CheckPasswordSignInAsync(user, req.Password, lockoutOnFailure: true);
                if (result.IsLockedOut)
                    return Results.Problem("Rekening tydelik gesluit. Probeer later weer.", statusCode: 423);
                if (!result.Succeeded)
                    return Results.Problem("Hierdie e-pos is reeds geregistreer, die wagwoord is verkeerd.",
                        statusCode: 401);
            }

            order.UserId = user.Id;
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Problem("Hierdie bestelling is intussen aan 'n rekening gekoppel.", statusCode: 409);
            }
            if (activeUser is null) await signIn.SignInAsync(user, isPersistent: true);
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

    /// Demo payment stays on by default until a real PSP exists; set Payments:DemoEnabled=false to close it.
    public static bool DemoPaymentsEnabled(IConfiguration cfg) => cfg.GetValue("Payments:DemoEnabled", true);

    private static async Task<IResult?> VerifyKwikAsync(VasbytDbContext db, Guid token, KwikPayments kwik, OrderConfirmationEmail email)
    {
        if (!kwik.Enabled) return null;
        await using var tx = await db.Database.BeginTransactionAsync();
        if (!await LockRow(db, "Orders", "PublicToken", token)) return null;
        var order = await Tracked(db, token);
        if (order is null) return null;
        if (order.Status != OrderStatus.Pending || await kwik.PaidTransactionAsync(order) is not { } transaction)
            return Results.Ok(await Load(db, token));
        // Money has moved, so price or stock drift no longer blocks it; the amount was matched against the order total.
        await LockStockAsync(db, order);
        return await MarkPaidAsync(db, tx, order, transaction, email);
    }

    /// Body is optional; when sent it must carry both the reviewed version and total.
    private static async Task<(PayDemoRequest? Intent, IResult? Error)> ReadIntentAsync(HttpRequest request)
    {
        if (request.HttpContext.Features.Get<IHttpRequestBodyDetectionFeature>()?.CanHaveBody != true) return (null, null);
        PayDemoRequest? intent;
        try { intent = await request.ReadFromJsonAsync<PayDemoRequest>(); }
        catch (Exception e) when (e is JsonException or InvalidOperationException)
        {
            return (null, Results.Problem("Ongeldige betalingsversoek.", statusCode: 400));
        }
        if (intent?.Version is null || intent.ExpectedTotalZar is null)
            return (null, Results.Problem("Verskaf weergawe en verwagte totaal saam.", statusCode: 400));
        return (intent, null);
    }

    /// Refuses payment when the order changed since review or its prices or stock moved.
    private static async Task<IResult?> CheckPayableAsync(VasbytDbContext db, Order order, PayDemoRequest? intent, bool lockStock)
    {
        if (order.Status == OrderStatus.Cancelled)
            return Results.Problem("Hierdie bestelling is gekanselleer.", statusCode: 409);
        if (intent is not null && (intent.Version != order.Version || intent.ExpectedTotalZar != order.TotalZar))
            return Results.Problem("Bestelling of totaal het intussen verander. Hersien dit voor betaling.", statusCode: 409);
        if (lockStock) await LockStockAsync(db, order);
        var (quote, error, _) = await OrderPricing.QuoteAsync(db, SavedRequest(order), true);
        if (error is not null || !MatchesSnapshot(order, quote!))
            return Results.Problem("Prys of beskikbaarheid het verander. Hersien en werk die bestelling by voor betaling. " + error,
                statusCode: 409);
        return null;
    }

    private static async Task LockStockAsync(VasbytDbContext db, Order order)
    {
        foreach (var variantId in order.Lines.Where(l => l.ProductVariantId is not null)
            .Select(l => l.ProductVariantId!.Value).Distinct().OrderBy(id => id))
            await LockRow(db, "ProductVariants", "Id", variantId);
    }

    /// The only Paid transition. Every payment method lands here so stock, Gate and the receipt are never skipped.
    private static async Task<IResult> MarkPaidAsync(VasbytDbContext db, IDbContextTransaction tx, Order order, string paymentReference,
        OrderConfirmationEmail email)
    {
        if (order.Status == OrderStatus.Cancelled)
            return Results.Problem("Hierdie bestelling is gekanselleer.", statusCode: 409);

        var firstPayment = order.Status != OrderStatus.Paid;
        if (firstPayment)
        {
            foreach (var line in order.Lines.Where(l => l.Kind == OrderLineKind.Product))
            {
                var variant = await db.ProductVariants.FindAsync(line.ProductVariantId!.Value);
                if (variant!.TrackStock) variant.Stock = Math.Max(0, variant.Stock - line.Quantity);
            }
            order.Status = OrderStatus.Paid;
            order.PaidUtc = DateTime.UtcNow;
            order.PaymentReference = paymentReference;
        }

        // Spec 8: one participant form per ticket bought, created the moment payment lands.
        if (Gate(order) is { } refusal) return refusal;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        if (firstPayment && order.Lines.SelectMany(l => l.Entrants).Any(e => !e.IsComplete)) await email.SendAsync(order);
        await SendCompletedConfirmation(db, order.PublicToken, email);
        return Results.Ok(await Load(db, order.PublicToken));
    }

    /// Saves after Gate. False when another request changed the order first (xmin conflict).
    private static async Task<bool> SaveGatedAsync(VasbytDbContext db, Order order)
    {
        // Forms added by Gate must bump the order row too, or the xmin check never fires.
        if (db.ChangeTracker.Entries<Entrant>().Any(e => e.State == EntityState.Added))
            db.Entry(order).Property(o => o.Status).IsModified = true;
        try
        {
            await db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return false;
        }
    }

    private static async Task SendCompletedConfirmation(VasbytDbContext db, Guid token, OrderConfirmationEmail email)
    {
        if (!email.Enabled) return;
        // Reload after saving so concurrent participant submissions see the current order state.
        var order = await db.Orders.AsNoTracking().Include(o => o.Lines).ThenInclude(l => l.Entrants)
            .FirstOrDefaultAsync(o => o.PublicToken == token);
        if (order is null || order.Status != OrderStatus.Paid || order.ConfirmationEmailSentUtc is not null ||
            order.Lines.SelectMany(l => l.Entrants).Any(e => !e.IsComplete)) return;
        if (await email.SendAsync(order))
            await db.Orders.Where(o => o.Id == order.Id && o.ConfirmationEmailSentUtc == null)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.ConfirmationEmailSentUtc, DateTime.UtcNow));
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

    private static bool IsMinor(DateOnly dateOfBirth) =>
        dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-18);

    private static async Task PersistNewOrder(VasbytDbContext db, Order order)
    {
        db.Orders.Add(order);
        await using var tx = await db.Database.BeginTransactionAsync();
        order.Reference = order.PublicToken.ToString();
        await db.SaveChangesAsync();
        order.Reference = $"VB-{EventYear}-{order.Id:D6}";
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    private static async Task<IResult> KeyedResult(VasbytDbContext db, Order existing,
        string fingerprint, AppUser? user)
    {
        if (existing.CheckoutFingerprint != fingerprint ||
            (user is not null && existing.UserId is not null && existing.UserId != user.Id))
            return Results.Problem("Hierdie bestellingsleutel is reeds vir 'n ander bestelling gebruik.", statusCode: 409);
        return Results.Ok(await Load(db, existing.PublicToken));
    }

    private static CreateOrderRequest SavedRequest(Order order) => new(
        order.BuyerFirstName, order.BuyerLastName, order.BuyerEmail, order.BuyerPhone,
        order.Lines.Where(l => l.Kind == OrderLineKind.Ticket)
            .Select(l => new CartTicket(l.RouteCategoryId!.Value, l.TariffKind!.Value, l.Quantity)).ToList(),
        order.Lines.Where(l => l.Kind == OrderLineKind.Donation).Sum(l => l.LineTotalZar),
        order.Lines.Where(l => l.Kind == OrderLineKind.Product)
            .Select(l => new CartProduct(l.ProductVariantId!.Value, l.Quantity)).ToList());

    private record SnapshotLine(OrderLineKind Kind, int? RouteCategoryId, TariffKind? TariffKind,
        int? ProductVariantId, string Description, decimal UnitPriceZar, long Quantity, decimal LineTotalZar);

    private static bool MatchesSnapshot(Order saved, Order quote)
    {
        if (saved.TotalZar != quote.TotalZar) return false;
        static SnapshotLine[] Normalised(IEnumerable<OrderLine> lines) => lines
            .GroupBy(l => new { l.Kind, l.RouteCategoryId, l.TariffKind, l.ProductVariantId,
                l.Description, l.UnitPriceZar })
            .Select(g => new SnapshotLine(g.Key.Kind, g.Key.RouteCategoryId, g.Key.TariffKind,
                g.Key.ProductVariantId, g.Key.Description, g.Key.UnitPriceZar,
                g.Sum(l => (long)l.Quantity), g.Sum(l => l.LineTotalZar)))
            .OrderBy(l => l.Kind).ThenBy(l => l.RouteCategoryId).ThenBy(l => l.TariffKind)
            .ThenBy(l => l.ProductVariantId).ThenBy(l => l.Description).ToArray();
        return Normalised(saved.Lines).SequenceEqual(Normalised(quote.Lines));
    }

    internal static async Task<bool> LockRow(VasbytDbContext db, string table, string field, object value)
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction!.GetDbTransaction();
        command.CommandText = $"SELECT \"Id\" FROM \"{table}\" WHERE \"{field}\" = @value FOR UPDATE";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "value";
        parameter.Value = value;
        command.Parameters.Add(parameter);
        return await command.ExecuteScalarAsync() is not null;
    }

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
            o.BuyerFirstName, o.BuyerLastName, o.BuyerEmail, o.BuyerPhone, o.Version, o.UserId is not null,
            o.Lines.OrderBy(l => l.Id).Select(l => new OrderLineDto(
                l.Id, l.Kind.ToString(), l.Description, l.Quantity, l.UnitPriceZar, l.LineTotalZar,
                l.RouteCategory?.Code, l.TariffKind?.ToString(), l.ProductVariantId, l.RouteCategoryId,
                l.Kind == OrderLineKind.Product ? l.CollectedQuantity : 0)),
            o.Lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).Select(e => new EntrantSlotDto(
                e.Id, e.OrderLineId, e.RouteCategory?.Code ?? "", e.RouteCategory?.Name ?? "",
                e.TariffKind.ToString(), e.FirstName, e.LastName, e.IsComplete, e.EntryNumber,
                o.Status == OrderStatus.Paid && e.IsComplete
                    ? $"VASBYT:{EventYear}:{e.QrToken:D}" : null)), o.ConfirmationEmailSentUtc);
    }
}
