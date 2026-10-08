using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

public record UpdateEntrantRequest(string FirstName, string LastName, string Email, string Phone,
    string ShirtSize, string StreetAddress, string Town, string Province, string PostalCode,
    string? ClubName, string? MedicalConditions, string? Medication, string? MedicalFund,
    string? MedicalFundNumber, string EmergencyName, string EmergencyRelationship,
    string EmergencyPhone);

/// ImageFileName, not ImageUrl: the admin sends back whatever POST /uploads gave it. The public
/// projections are the ones that turn a name into a /media path.
public record ProductRequest(string Name, string Description, string? ImageFileName,
    int SortOrder, bool IsActive);

public record VariantRequest(string Label, decimal PriceZar, int Stock, bool IsActive,
    bool? TrackStock = null, uint? Version = null);
public record CollectionLineRequest(int OrderLineId, int CollectedQuantity);
public record CollectionRequest(IReadOnlyList<CollectionLineRequest> Lines);

public record AdvertRequest(AdvertKind Kind, string Name, string Blurb, string? ImageFileName,
    string? LinkUrl, string? BookingUrl, string? Phone, int SortOrder, bool IsActive);

public record PricingRuleRequest(TariffKind TariffKind, DateTime ValidFromUtc, DateTime ValidToUtc,
    decimal AmountZar, string Label, bool IsActive);

/// No Code and no Discipline: the six categories are fixed by the spec, and their codes are what
/// the SPA and the GPX filenames key off.
public record RouteCategoryRequest(string Name, string Blurb, decimal TotalDistanceKm,
    int ElevationGainM, string Difficulty, bool IsOpen, int SortOrder);

public record RouteDayRequest(DateOnly DateLocal, decimal DistanceKm, int ElevationGainM,
    TimeOnly StartTimeLocal, string Description);

/// The same fields plus the day it is. DayNumber is fixed once the row exists, so it is on the
/// create body and not on the update one.
public record CreateRouteDayRequest(int DayNumber, DateOnly DateLocal, decimal DistanceKm,
    int ElevationGainM, TimeOnly StartTimeLocal, string Description);

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/admin").WithTags("Admin").RequireAuthorization(Roles.Admin);

        g.MapGet("/stats", async (VasbytDbContext db) =>
        {
            var paid = db.Orders.Where(o => o.Status == OrderStatus.Paid);
            var paidLines = db.OrderLines.Where(l => l.Order!.Status == OrderStatus.Paid);
            var paidEntrants = db.Entrants.Where(e => e.OrderLine!.Order!.Status == OrderStatus.Paid);

            return Results.Ok(new
            {
                entrants = await paidEntrants.CountAsync(),
                paidOrders = await paid.CountAsync(),
                pendingOrders = await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending),
                // Spec 8.2 and 10: paid for, form never finished. This is the follow-up list's size.
                unfilledForms = await paidEntrants.CountAsync(e => !e.IsComplete),
                totalRevenueZar = await paid.SumAsync(o => o.TotalZar),
                entryRevenueZar = await paidLines
                    .Where(l => l.Kind == OrderLineKind.Ticket).SumAsync(l => l.LineTotalZar),
                productRevenueZar = await paidLines
                    .Where(l => l.Kind == OrderLineKind.Product).SumAsync(l => l.LineTotalZar),
                donationRevenueZar = await paidLines
                    .Where(l => l.Kind == OrderLineKind.Donation).SumAsync(l => l.LineTotalZar),
                byRoute = await paidEntrants
                    .GroupBy(e => new { e.RouteCategory!.Code, e.RouteCategory.Name })
                    .Select(x => new { x.Key.Code, x.Key.Name, Count = x.Count() })
                    .OrderByDescending(x => x.Count)
                    .ToListAsync(),
            });
        });

        // POPIA: the only projection in the codebase that carries the identity number and the four
        // medical fields. It sits behind RequireAuthorization(Admin) and nothing else reaches them.
        // ponytail: no per-field access log yet. Spec 11 wants access to sensitive fields recorded;
        // add an audit row here when the organisers name who may read them.
        g.MapGet("/entrants", async (VasbytDbContext db, string? q, bool? incompleteOnly,
            int page = 1, int size = 25) =>
        {
            size = Math.Clamp(size, 1, 200);
            var query = db.Entrants.AsNoTracking().AsQueryable();
            if (incompleteOnly == true) query = query.Where(e => !e.IsComplete);
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(e => e.FirstName.Contains(q) || e.LastName.Contains(q)
                    || e.Email.Contains(q) || e.Town.Contains(q) || e.IdNumber.Contains(q));

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(e => e.Id)
                .Skip((page - 1) * size).Take(size)
                .Select(e => new
                {
                    e.Id, e.EntryNumber, e.IsComplete, e.FirstName, e.LastName, e.IdNumber,
                    e.Email, e.Phone, e.DateOfBirth, e.Gender, e.ShirtSize,
                    e.StreetAddress, e.Town, e.Province, e.PostalCode,
                    e.MedicalConditions, e.Medication, e.MedicalFund, e.MedicalFundNumber,
                    e.EmergencyName, e.EmergencyRelationship, e.EmergencyPhone,
                    e.ClubName, e.PhotoConsent, e.GuardianConsentName, e.TermsAcceptedUtc,
                    Route = e.RouteCategory!.Name,
                    RouteCode = e.RouteCategory.Code,
                    Tariff = e.TariffKind.ToString(),
                    OrderReference = e.OrderLine!.Order!.Reference,
                    OrderStatus = e.OrderLine.Order.Status.ToString(),
                }).ToListAsync();
            return Results.Ok(new { total, page, size, items });
        });

        g.MapGet("/orders", async (VasbytDbContext db, int page = 1, int size = 25) =>
        {
            size = Math.Clamp(size, 1, 200);
            var total = await db.Orders.CountAsync();
            var items = await db.Orders.AsNoTracking().OrderByDescending(o => o.Id)
                .Skip((page - 1) * size).Take(size)
                .Select(o => new
                {
                    o.Id, o.Reference, o.PublicToken, Status = o.Status.ToString(), o.TotalZar,
                    o.BuyerFirstName, o.BuyerLastName, o.BuyerEmail, o.BuyerPhone,
                    o.CreatedUtc, o.PaidUtc, o.PaymentReference,
                    Lines = o.Lines.OrderBy(l => l.Id).Select(l => new
                    {
                        l.Id, Kind = l.Kind.ToString(), l.Description, l.Quantity,
                        l.UnitPriceZar, l.LineTotalZar, l.ProductVariantId, l.CollectedQuantity,
                    }),
                }).ToListAsync();
            return Results.Ok(new { total, page, size, items });
        });

        g.MapPut("/orders/{id:int}/collection", async (int id, CollectionRequest req, VasbytDbContext db) =>
        {
            if (req.Lines is null || req.Lines.Count == 0 ||
                req.Lines.Select(l => l.OrderLineId).Distinct().Count() != req.Lines.Count)
                return Results.Problem("Verskaf unieke produklyne.", statusCode: 400);
            await using var tx = await db.Database.BeginTransactionAsync();
            if (!await OrderEndpoints.LockRow(db, "Orders", "Id", id)) return Results.NotFound();
            var order = await db.Orders.Include(o => o.Lines).FirstAsync(o => o.Id == id);
            if (order.Status != OrderStatus.Paid)
                return Results.Problem("Slegs betaalde bestellings kan afgehaal word.", statusCode: 409);
            foreach (var line in req.Lines)
            {
                var owned = order.Lines.FirstOrDefault(l => l.Id == line.OrderLineId);
                if (owned is null || owned.Kind != OrderLineKind.Product ||
                    line.CollectedQuantity < 0 || line.CollectedQuantity > owned.Quantity)
                    return Results.Problem("Ongeldige produklyn of afgehaalde hoeveelheid.", statusCode: 400);
                owned.CollectedQuantity = line.CollectedQuantity;
            }
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Ok(new { lines = order.Lines.Where(l => l.Kind == OrderLineKind.Product)
                .OrderBy(l => l.Id).Select(l => new { orderLineId = l.Id, l.CollectedQuantity, l.Quantity }) });
        });

        g.MapPatch("/entrants/{id:int}", async (int id, UpdateEntrantRequest req, VasbytDbContext db) =>
        {
            var e = await db.Entrants.FindAsync(id);
            if (e is null) return Results.NotFound();
            // Admins may correct an entrant's details. They may NOT move one to another route or
            // tariff, and may not add one: that is what the customer paid for, and it stays fixed.
            (e.FirstName, e.LastName, e.Email, e.Phone) =
                (req.FirstName, req.LastName, req.Email, req.Phone);
            (e.ShirtSize, e.StreetAddress, e.Town, e.Province, e.PostalCode, e.ClubName) =
                (req.ShirtSize, req.StreetAddress, req.Town, req.Province, req.PostalCode, req.ClubName);
            (e.MedicalConditions, e.Medication, e.MedicalFund, e.MedicalFundNumber) =
                (req.MedicalConditions, req.Medication, req.MedicalFund, req.MedicalFundNumber);
            (e.EmergencyName, e.EmergencyRelationship, e.EmergencyPhone) =
                (req.EmergencyName, req.EmergencyRelationship, req.EmergencyPhone);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Spec 10: "Deelnemerslyste per roete uitvoer". One file per route, every 8.1 field on it,
        // including the sensitive ones. Same authorisation as /entrants and no other way in.
        g.MapGet("/entrants/export", async (VasbytDbContext db, string? routeCode) =>
        {
            var query = db.Entrants.AsNoTracking()
                .Where(e => e.OrderLine!.Order!.Status == OrderStatus.Paid);
            if (!string.IsNullOrWhiteSpace(routeCode))
                query = query.Where(e => e.RouteCategory!.Code == routeCode);

            var rows = await query
                .OrderBy(e => e.RouteCategory!.SortOrder).ThenBy(e => e.LastName).ThenBy(e => e.Id)
                .Select(e => new
                {
                    e.EntryNumber, Route = e.RouteCategory!.Name, e.RouteCategory.Code,
                    Tariff = e.TariffKind.ToString(), e.FirstName, e.LastName, e.IdNumber,
                    e.Email, e.Phone, e.DateOfBirth, e.Gender, e.ShirtSize, e.StreetAddress,
                    e.Town, e.Province, e.PostalCode, e.MedicalConditions, e.Medication,
                    e.MedicalFund, e.MedicalFundNumber, e.EmergencyName, e.EmergencyRelationship,
                    e.EmergencyPhone, e.ClubName, e.PhotoConsent, e.GuardianConsentName,
                    e.TermsAcceptedUtc, e.IsComplete, Reference = e.OrderLine!.Order!.Reference,
                }).ToListAsync();

            var csv = new StringBuilder();
            csv.AppendLine(string.Join(',', new[]
            {
                "Inskrywingsnommer", "Roete", "Roetekode", "Tarief", "Naam", "Van",
                "Identiteitsnommer", "E-pos", "Selfoon", "Geboortedatum", "Geslag", "Hempgrootte",
                "Straatadres", "Dorp", "Provinsie", "Poskode", "Mediese toestande", "Medikasie",
                "Mediese fonds", "Mediese fondsnommer", "Noodkontak", "Verwantskap",
                "Noodkontaknommer", "Klub", "Fototoestemming", "Voogtoestemming",
                "Voorwaardes aanvaar", "Vorm voltooi", "Bestellingsverwysing",
            }.Select(Csv)));

            foreach (var r in rows)
                csv.AppendLine(string.Join(',', new[]
                {
                    Csv(r.EntryNumber), Csv(r.Route), Csv(r.Code), Csv(r.Tariff), Csv(r.FirstName),
                    Csv(r.LastName), Csv(r.IdNumber), Csv(r.Email), Csv(r.Phone),
                    Csv(r.DateOfBirth.ToString("yyyy-MM-dd")), Csv(r.Gender), Csv(r.ShirtSize),
                    Csv(r.StreetAddress), Csv(r.Town), Csv(r.Province), Csv(r.PostalCode),
                    Csv(r.MedicalConditions), Csv(r.Medication), Csv(r.MedicalFund),
                    Csv(r.MedicalFundNumber), Csv(r.EmergencyName), Csv(r.EmergencyRelationship),
                    Csv(r.EmergencyPhone), Csv(r.ClubName), Csv(r.PhotoConsent ? "Ja" : "Nee"),
                    Csv(r.GuardianConsentName), Csv(r.TermsAcceptedUtc?.ToString("u")),
                    Csv(r.IsComplete ? "Ja" : "Nee"), Csv(r.Reference),
                }));

            // The byte order mark is what makes Excel read this as UTF-8 rather than mangling
            // every ë and every ê in a Karoo address.
            var name = $"deelnemers-{(string.IsNullOrWhiteSpace(routeCode) ? "alle" : routeCode)}"
                + $"-{OrderEndpoints.EventYear}.csv";
            return Results.File(Encoding.UTF8.GetBytes("\uFEFF" + csv), "text/csv", name);
        });

        // Spec 10: "Tariewe, datumreëls en inskrywingsperke bestuur". Pricing.RuleAsync reads this
        // table on every request with no cache in front of it, so an edit here lands immediately on
        // GET /api/tariffs and on the next order priced.
        g.MapGet("/pricing-rules", async (VasbytDbContext db) =>
            Results.Ok(await db.PricingRules.AsNoTracking()
                .OrderBy(r => r.TariffKind).ThenBy(r => r.ValidFromUtc).ToListAsync()));

        g.MapPost("/pricing-rules", async (PricingRuleRequest req, VasbytDbContext db) =>
        {
            if (Invalid(req) is { } problem) return Results.Problem(problem, statusCode: 400);
            var rule = new PricingRule();
            Apply(rule, req);
            db.PricingRules.Add(rule);
            await db.SaveChangesAsync();
            return Results.Ok(rule);
        });

        g.MapPut("/pricing-rules/{id:int}", async (int id, PricingRuleRequest req, VasbytDbContext db) =>
        {
            if (Invalid(req) is { } problem) return Results.Problem(problem, statusCode: 400);
            if (await db.PricingRules.FindAsync(id) is not { } rule) return Results.NotFound();
            Apply(rule, req);
            await db.SaveChangesAsync();
            return Results.Ok(rule);
        });

        // Nothing points at a pricing rule: an OrderLine snapshots the amount and the label it was
        // sold under, so removing the rule never rewrites an invoice. Always a hard delete.
        g.MapDelete("/pricing-rules/{id:int}", async (int id, VasbytDbContext db) =>
        {
            if (await db.PricingRules.FindAsync(id) is not { } rule) return Results.NotFound();
            db.PricingRules.Remove(rule);
            await db.SaveChangesAsync();
            return Results.Ok(new { hardDeleted = true });
        });

        // Spec 10: "Produkte, variante, voorraad en pryse bestuur". Inactive rows included, this is
        // the editor's list, not the shop's.
        g.MapGet("/products", async (VasbytDbContext db) =>
            Results.Ok(await db.Products.AsNoTracking().Include(p => p.Variants)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
                .Select(p => new
                {
                    p.Id, p.Name, p.Description, p.ImageFileName,
                    ImageUrl = MediaStore.Url(p.ImageFileName),
                    p.SortOrder, p.IsActive,
                    Variants = p.Variants.OrderBy(v => v.Id).Select(v => new
                    {
                        v.Id, v.Label, v.PriceZar, v.Stock, v.IsActive, v.TrackStock, v.Version,
                    }),
                }).ToListAsync()));

        g.MapPost("/products", async (ProductRequest req, VasbytDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.Problem("'n Produk benodig 'n naam.", statusCode: 400);
            var product = new Product();
            Apply(product, req);
            db.Products.Add(product);
            await db.SaveChangesAsync();
            return Results.Ok(new { product.Id });
        });

        g.MapPut("/products/{id:int}", async (int id, ProductRequest req, VasbytDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.Problem("'n Produk benodig 'n naam.", statusCode: 400);
            if (await db.Products.FindAsync(id) is not { } product) return Results.NotFound();
            Apply(product, req);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // The endpoint decides, not the caller: a product somebody has bought is history and only
        // gets deactivated, because an OrderLine points at its variant and snapshots its name.
        g.MapDelete("/products/{id:int}", async (int id, VasbytDbContext db) =>
        {
            var product = await db.Products.Include(p => p.Variants)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (product is null) return Results.NotFound();

            var variantIds = product.Variants.Select(v => v.Id).ToList();
            var sold = await db.OrderLines.AnyAsync(l => l.ProductVariantId != null
                && variantIds.Contains(l.ProductVariantId.Value));
            if (sold)
            {
                product.IsActive = false;
                foreach (var v in product.Variants) v.IsActive = false;
            }
            else db.Products.Remove(product);

            await db.SaveChangesAsync();
            return Results.Ok(new { hardDeleted = !sold });
        });

        g.MapPost("/products/{id:int}/variants", async (
            int id, VariantRequest req, VasbytDbContext db) =>
        {
            if (!await db.Products.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (req.PriceZar < 0 || req.Stock < 0)
                return Results.Problem("'n Prys mag nie negatief wees nie.", statusCode: 400);
            var variant = new ProductVariant { ProductId = id };
            Apply(variant, req);
            db.ProductVariants.Add(variant);
            await db.SaveChangesAsync();
            return Results.Ok(new { variant.Id });
        });

        g.MapPut("/products/{id:int}/variants/{variantId:int}", async (
            int id, int variantId, VariantRequest req, VasbytDbContext db) =>
        {
            if (req.PriceZar < 0 || req.Stock < 0)
                return Results.Problem("'n Prys mag nie negatief wees nie.", statusCode: 400);
            var variant = await db.ProductVariants
                .FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == id);
            if (variant is null) return Results.NotFound();
            if (req.Version is { } version ? version != variant.Version :
                req.Stock != variant.Stock || req.TrackStock is { } tracked && tracked != variant.TrackStock)
                return Results.Problem("Produkvoorraad of variant het intussen verander. Herlaai asseblief.", statusCode: 409);
            Apply(variant, req);
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Problem("Produkvoorraad of variant het intussen verander. Herlaai asseblief.", statusCode: 409);
            }
            return Results.NoContent();
        });

        g.MapDelete("/products/{id:int}/variants/{variantId:int}", async (
            int id, int variantId, VasbytDbContext db) =>
        {
            var variant = await db.ProductVariants
                .FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == id);
            if (variant is null) return Results.NotFound();

            var sold = await db.OrderLines.AnyAsync(l => l.ProductVariantId == variantId);
            if (sold) variant.IsActive = false;
            else db.ProductVariants.Remove(variant);

            await db.SaveChangesAsync();
            return Results.Ok(new { hardDeleted = !sold });
        });

        // Spec 10: "Verblyfadvertensies, borglogo's en skakels bestuur". The client was explicit
        // that a sponsor must supply an image and may supply a booking link.
        g.MapGet("/adverts", async (VasbytDbContext db, AdvertKind? kind) =>
            Results.Ok(await db.Adverts.AsNoTracking()
                .Where(a => kind == null || a.Kind == kind)
                .OrderBy(a => a.Kind).ThenBy(a => a.SortOrder).ThenBy(a => a.Id)
                .Select(a => new
                {
                    a.Id, a.Kind, a.Name, a.Blurb, a.ImageFileName,
                    ImageUrl = MediaStore.Url(a.ImageFileName),
                    a.LinkUrl, a.BookingUrl, a.Phone, a.SortOrder, a.IsActive,
                }).ToListAsync()));

        g.MapPost("/adverts", async (AdvertRequest req, VasbytDbContext db) =>
        {
            if (Invalid(req) is { } problem) return Results.Problem(problem, statusCode: 400);
            var advert = new Advert();
            Apply(advert, req);
            db.Adverts.Add(advert);
            await db.SaveChangesAsync();
            return Results.Ok(new { advert.Id });
        });

        g.MapPut("/adverts/{id:int}", async (int id, AdvertRequest req, VasbytDbContext db) =>
        {
            if (Invalid(req) is { } problem) return Results.Problem(problem, statusCode: 400);
            if (await db.Adverts.FindAsync(id) is not { } advert) return Results.NotFound();
            Apply(advert, req);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Nothing in the schema points at an advert, so this one is always a real delete.
        g.MapDelete("/adverts/{id:int}", async (int id, VasbytDbContext db) =>
        {
            if (await db.Adverts.FindAsync(id) is not { } advert) return Results.NotFound();
            db.Adverts.Remove(advert);
            await db.SaveChangesAsync();
            return Results.Ok(new { hardDeleted = true });
        });

        // The six categories and their codes are fixed by the spec, so a route category can be
        // edited but never created or deleted. Its days can be all three: ligstap and vasstap were
        // seeded with no days at all, and this is how they get a breakdown and get switched on.
        g.MapGet("/routes", async (VasbytDbContext db) =>
            Results.Ok(await db.RouteCategories.AsNoTracking().Include(r => r.Days)
                .OrderBy(r => r.SortOrder)
                .Select(r => new
                {
                    r.Id, r.Code, r.Name, Discipline = r.Discipline.ToString(), r.Blurb,
                    r.TotalDistanceKm, r.ElevationGainM, r.Difficulty, r.GpxFileName,
                    r.SortOrder, r.IsOpen,
                    Days = r.Days.OrderBy(d => d.DayNumber).Select(d => new
                    {
                        d.Id, d.DayNumber, d.DateLocal, d.DistanceKm, d.ElevationGainM,
                        d.StartTimeLocal, d.Description, d.GpxFileName,
                    }),
                }).ToListAsync()));

        g.MapPut("/routes/{id:int}", async (int id, RouteCategoryRequest req, VasbytDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.Problem("'n Roete benodig 'n naam.", statusCode: 400);
            if (await db.RouteCategories.FindAsync(id) is not { } route) return Results.NotFound();
            (route.Name, route.Blurb, route.Difficulty) = (req.Name, req.Blurb, req.Difficulty);
            (route.TotalDistanceKm, route.ElevationGainM) = (req.TotalDistanceKm, req.ElevationGainM);
            (route.IsOpen, route.SortOrder) = (req.IsOpen, req.SortOrder);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        g.MapPost("/routes/{id:int}/days", async (
            int id, CreateRouteDayRequest req, VasbytDbContext db) =>
        {
            if (!await db.RouteCategories.AnyAsync(r => r.Id == id)) return Results.NotFound();
            if (req.DayNumber < 1)
                return Results.Problem("'n Dagnommer moet 1 of hoër wees.", statusCode: 400);
            // There is a unique index behind this. Checking first is only so the organiser reads a
            // sentence rather than a constraint violation.
            if (await db.RouteDays.AnyAsync(d => d.RouteCategoryId == id && d.DayNumber == req.DayNumber))
                return Results.Problem($"Dag {req.DayNumber} bestaan reeds vir hierdie roete.",
                    statusCode: 400);

            var day = new RouteDay
            {
                RouteCategoryId = id,
                DayNumber = req.DayNumber,
                DateLocal = req.DateLocal,
                DistanceKm = req.DistanceKm,
                ElevationGainM = req.ElevationGainM,
                StartTimeLocal = req.StartTimeLocal,
                Description = req.Description,
            };
            db.RouteDays.Add(day);
            await db.SaveChangesAsync();
            return Results.Ok(new { day.Id });
        });

        g.MapPut("/routes/{id:int}/days/{dayId:int}", async (
            int id, int dayId, RouteDayRequest req, VasbytDbContext db) =>
        {
            var day = await db.RouteDays.FirstOrDefaultAsync(d => d.Id == dayId && d.RouteCategoryId == id);
            if (day is null) return Results.NotFound();
            (day.DateLocal, day.StartTimeLocal, day.Description) =
                (req.DateLocal, req.StartTimeLocal, req.Description);
            (day.DistanceKm, day.ElevationGainM) = (req.DistanceKm, req.ElevationGainM);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Nothing in the schema points at a RouteDay, an entrant is bound to the category. So this
        // is always a real delete, and a day entered by mistake can simply go.
        g.MapDelete("/routes/{id:int}/days/{dayId:int}", async (
            int id, int dayId, VasbytDbContext db) =>
        {
            var day = await db.RouteDays.FirstOrDefaultAsync(d => d.Id == dayId && d.RouteCategoryId == id);
            if (day is null) return Results.NotFound();
            db.RouteDays.Remove(day);
            await db.SaveChangesAsync();
            return Results.Ok(new { hardDeleted = true });
        });

        // A trust boundary: this is the one endpoint that writes a file to disk. Everything a
        // client controls about it is either checked or thrown away, see MediaStore.
        g.MapPost("/uploads", async (
            IFormFile? file, IConfiguration cfg, IWebHostEnvironment env) =>
        {
            if (file is null) return Results.Problem("Kies asseblief 'n prentlêer.", statusCode: 400);
            var (fileName, problem) = await MediaStore.SaveAsync(file, MediaStore.Root(cfg, env));
            return problem is not null
                ? Results.Problem(problem, statusCode: 400)
                : Results.Ok(new { fileName, url = MediaStore.Url(fileName) });
        })
            // No antiforgery token: this is a same-site cookie API with no HTML form behind it, and
            // the middleware is not in the pipeline.
            .DisableAntiforgery()
            // Kestrel aborts anything past this before the body is buffered, and it answers with a
            // bare 413. The headroom is deliberate: a 6 MB phone photo is the ordinary mistake, and
            // it should come back as MediaStore's readable 400 rather than an empty status code.
            .WithMetadata(new RequestSizeLimitAttribute(MediaStore.MaxBytes * 2));

        g.MapDelete("/uploads/{fileName}", (
            string fileName, IConfiguration cfg, IWebHostEnvironment env) =>
            MediaStore.Delete(MediaStore.Root(cfg, env), fileName)
                ? Results.NoContent()
                : Results.NotFound());
    }

    /// Quotes every field and neutralises anything a spreadsheet would evaluate as a formula. An
    /// entrant chooses their own club name, and that string ends up in the organisers' Excel.
    private static string Csv(string? value)
    {
        var v = value ?? "";
        if (v.Length > 0 && "=+-@\t\r".Contains(v[0])) v = "'" + v;
        return $"\"{v.Replace("\"", "\"\"")}\"";
    }

    /// The field is named ...Utc and the column is a timestamptz, which Npgsql will only accept a
    /// UTC DateTime for. Take the name at its word for anything that arrives without a kind.
    private static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    private static string? Invalid(PricingRuleRequest req) =>
        req.AmountZar < 0 ? "'n Tarief mag nie negatief wees nie."
        : req.ValidToUtc <= req.ValidFromUtc ? "Die einddatum moet ná die begindatum wees."
        : string.IsNullOrWhiteSpace(req.Label) ? "'n Tarief benodig 'n beskrywing."
        : null;

    private static string? Invalid(AdvertRequest req) =>
        string.IsNullOrWhiteSpace(req.Name) ? "'n Advertensie benodig 'n naam."
        // The client was explicit: a sponsor or accommodation listing must supply an image.
        : string.IsNullOrWhiteSpace(req.ImageFileName) ? "'n Prent word vereis. Laai dit eers op."
        : null;

    private static void Apply(PricingRule rule, PricingRuleRequest req)
    {
        (rule.TariffKind, rule.AmountZar, rule.Label, rule.IsActive) =
            (req.TariffKind, req.AmountZar, req.Label.Trim(), req.IsActive);
        (rule.ValidFromUtc, rule.ValidToUtc) = (AsUtc(req.ValidFromUtc), AsUtc(req.ValidToUtc));
    }

    private static void Apply(Product product, ProductRequest req) =>
        (product.Name, product.Description, product.ImageFileName, product.SortOrder, product.IsActive) =
            (req.Name.Trim(), req.Description.Trim(), req.ImageFileName, req.SortOrder, req.IsActive);

    private static void Apply(ProductVariant variant, VariantRequest req) =>
        (variant.Label, variant.PriceZar, variant.Stock, variant.IsActive, variant.TrackStock) =
            (req.Label.Trim(), req.PriceZar, req.Stock, req.IsActive, req.TrackStock ?? variant.TrackStock);

    private static void Apply(Advert advert, AdvertRequest req)
    {
        (advert.Kind, advert.Name, advert.Blurb, advert.ImageFileName) =
            (req.Kind, req.Name.Trim(), req.Blurb.Trim(), req.ImageFileName);
        (advert.LinkUrl, advert.BookingUrl, advert.Phone) =
            (req.LinkUrl, req.BookingUrl, req.Phone);
        (advert.SortOrder, advert.IsActive) = (req.SortOrder, req.IsActive);
    }
}
