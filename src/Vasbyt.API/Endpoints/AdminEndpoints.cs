using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
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
public record AddAdminRequest(string Email);
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

        g.MapGet("/admins", async (UserManager<AppUser> users) =>
            (await users.GetUsersInRoleAsync(Roles.Admin))
                .OrderBy(u => u.Email).Select(u => new { u.Email, u.FirstName, u.LastName }));

        // An existing account is promoted on the spot; anyone else gets a signup link that makes them admin.
        g.MapPost("/admins", async (AddAdminRequest req, UserManager<AppUser> users, AdminInvite invite,
            ClaimsPrincipal principal) =>
        {
            var email = req.Email?.Trim() ?? "";
            if (!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email) || !email.Contains('.'))
                return Results.Problem("Gee 'n geldige e-posadres.", statusCode: 400);
            if (await users.FindByEmailAsync(email) is { } user)
            {
                if (await users.IsInRoleAsync(user, Roles.Admin)) return Results.Ok(new { status = "already" });
                await users.AddToRoleAsync(user, Roles.Admin);
                return Results.Ok(new { status = "promoted" });
            }
            var me = await users.GetUserAsync(principal);
            var by = $"{me?.FirstName} {me?.LastName}".Trim() is { Length: > 0 } n ? n : "'n Vasbyt-administrateur";
            return await invite.SendAsync(email, by) ? Results.Ok(new { status = "invited" })
                : Results.Problem("Die uitnodiging kon nie gestuur word nie. Probeer later weer.", statusCode: 503);
        });

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
        // medical fields. It sits behind RequireAuthorization(Admin) and every read is in the audit log.
        g.MapGet("/entrants", async (VasbytDbContext db, string? q, bool? incompleteOnly, string? routeCode,
            int page = 1, int size = 25) =>
        {
            size = Math.Clamp(size, 1, 200);
            var query = db.Entrants.AsNoTracking().AsQueryable();
            if (incompleteOnly == true) query = query.Where(e => !e.IsComplete);
            if (!string.IsNullOrWhiteSpace(routeCode)) query = query.Where(e => e.RouteCategory!.Code == routeCode);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var t = q.Trim().ToLower();
                query = query.Where(e => e.FirstName.ToLower().Contains(t) || e.LastName.ToLower().Contains(t)
                    || e.Email.ToLower().Contains(t) || e.Town.ToLower().Contains(t) || e.IdNumber.Contains(t)
                    || (e.EntryNumber != null && e.EntryNumber.ToLower().Contains(t))
                    || e.OrderLine!.Order!.Reference.ToLower().Contains(t));
            }

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

        g.MapGet("/orders", async (VasbytDbContext db, string? q, OrderStatus? status, int page = 1, int size = 25) =>
        {
            size = Math.Clamp(size, 1, 200);
            var query = db.Orders.AsNoTracking().AsQueryable();
            if (status is not null) query = query.Where(o => o.Status == status);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var t = q.Trim().ToLower();
                query = query.Where(o => o.Reference.ToLower().Contains(t) || o.BuyerFirstName.ToLower().Contains(t)
                    || o.BuyerLastName.ToLower().Contains(t) || o.BuyerEmail.ToLower().Contains(t) || o.BuyerPhone.Contains(t));
            }
            var total = await query.CountAsync();
            var items = await query.OrderByDescending(o => o.Id)
                .Skip((page - 1) * size).Take(size)
                .Select(o => new
                {
                    o.Id, o.Reference, o.PublicToken, Status = o.Status.ToString(), o.TotalZar,
                    o.BuyerFirstName, o.BuyerLastName, o.BuyerEmail, o.BuyerPhone,
                    o.CreatedUtc, o.PaidUtc, o.PaymentReference,
                    FormsOutstanding = o.Lines.SelectMany(l => l.Entrants).Count(e => !e.IsComplete),
                    Lines = o.Lines.OrderBy(l => l.Id).Select(l => new
                    {
                        l.Id, Kind = l.Kind.ToString(), l.Description, l.Quantity,
                        l.UnitPriceZar, l.LineTotalZar, l.ProductVariantId, l.CollectedQuantity,
                    }),
                }).ToListAsync();
            return Results.Ok(new { total, page, size, items });
        });

        g.MapGet("/audit", async (VasbytDbContext db, string? q, int page = 1, int size = 50) =>
        {
            size = Math.Clamp(size, 1, 200);
            var query = db.AuditEntries.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var t = q.Trim().ToLower();
                query = query.Where(a => a.ActorEmail.ToLower().Contains(t) || a.Path.ToLower().Contains(t));
            }
            var total = await query.CountAsync();
            var rows = await query.OrderByDescending(a => a.Id).Skip((Math.Max(page, 1) - 1) * size).Take(size).ToListAsync();
            var items = rows.Select(a => new
            {
                a.Id, a.CreatedUtc, a.ActorEmail, a.Method, a.Path, a.StatusCode,
                Changes = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(a.Changes),
            });
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

        // Packing list for the team on the ground: one block per payer (by email), merging all their
        // paid orders, with everyone they entered listed under them. Donations have nothing to pack.
        g.MapGet("/packing-list.pdf", async (VasbytDbContext db, UserManager<AppUser> users, ClaimsPrincipal principal) =>
        {
            var orders = await db.Orders.AsNoTracking()
                .Where(o => o.Status == OrderStatus.Paid
                    && o.Lines.Any(l => l.Kind != OrderLineKind.Donation))
                .OrderBy(o => o.Id)
                .Select(o => new
                {
                    o.Reference, o.BuyerFirstName, o.BuyerLastName, o.BuyerEmail, o.BuyerPhone,
                    Entrants = o.Lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).Select(e => new
                    {
                        e.FirstName, e.LastName, e.Phone, e.Gender, e.IsComplete,
                        EnteredFor = e.OrderLine!.Description,
                    }).ToList(),
                    Products = o.Lines.Where(l => l.Kind == OrderLineKind.Product).OrderBy(l => l.Id)
                        .Select(l => new { l.Quantity, l.Description }).ToList(),
                }).ToListAsync();

            // The latest order's name and phone win, a payer may have corrected them between orders.
            var payers = orders.GroupBy(o => o.BuyerEmail.Trim().ToLowerInvariant()).Select(grp =>
            {
                var last = grp.Last();
                return new
                {
                    Buyer = $"{last.BuyerFirstName} {last.BuyerLastName}".Trim(), last.BuyerLastName,
                    last.BuyerFirstName, last.BuyerPhone,
                    References = string.Join(", ", grp.Select(o => o.Reference)),
                    Entrants = grp.SelectMany(o => o.Entrants).ToList(),
                    Products = grp.SelectMany(o => o.Products).GroupBy(p => p.Description)
                        .Select(p => $"{p.Sum(x => x.Quantity)} x {p.Key}").ToList(),
                };
            }).OrderBy(p => p.BuyerLastName).ThenBy(p => p.BuyerFirstName).ToList();

            var exportedBy = await ReportPdf.ExportedByAsync(users, principal);
            var exportedAt = DateTime.UtcNow.AddHours(2);

            var pdf = Document.Create(doc => doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(t => t.FontSize(9));
                page.Header().PaddingBottom(8).Row(r =>
                {
                    r.RelativeItem().Text($"Vasbyt {OrderEndpoints.EventYear}: paklys").FontSize(14).Bold();
                    r.AutoItem().AlignBottom().Text($"{payers.Count} betalers");
                });
                page.Content().Column(col =>
                {
                    col.Spacing(10);
                    foreach (var p in payers) col.Item().ShowEntire().Border(0.5f).Padding(6).Column(b =>
                    {
                        b.Spacing(4);
                        b.Item().Row(r =>
                        {
                            r.ConstantItem(12).Height(10).Border(0.75f);
                            r.RelativeItem().PaddingLeft(6).Text(t =>
                            {
                                t.Span(p.Buyer).Bold();
                                t.Span($"   {p.BuyerPhone}   Verw. {p.References}");
                            });
                        });
                        if (p.Products.Count > 0) b.Item().Text(t =>
                        {
                            t.Span("Winkel: ").SemiBold();
                            t.Span(string.Join(",  ", p.Products));
                        });
                        if (p.Entrants.Count > 0) b.Item().Table(t =>
                        {
                            t.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3); c.RelativeColumn(2); c.RelativeColumn(1.2f);
                                c.RelativeColumn(3);
                            });
                            t.Header(h =>
                            {
                                foreach (var label in new[] { "Deelnemer", "Selfoon", "Geslag", "Ingeskryf vir" })
                                    h.Cell().BorderBottom(0.5f).Text(label).SemiBold();
                            });
                            foreach (var e in p.Entrants)
                            {
                                var name = $"{e.FirstName} {e.LastName}".Trim();
                                t.Cell().Text(e.IsComplete || name.Length > 0 ? name : "(vorm nie voltooi nie)");
                                t.Cell().Text(e.Phone);
                                t.Cell().Text(e.Gender);
                                t.Cell().Text(e.EnteredFor);
                            }
                        });
                    });
                });
                page.Footer().Row(r =>
                {
                    r.RelativeItem().Text($"Uitgevoer deur {exportedBy} op {exportedAt:yyyy-MM-dd HH:mm}");
                    r.AutoItem().Text(t => { t.CurrentPageNumber(); t.Span(" / "); t.TotalPages(); });
                });
            })).GeneratePdf();

            return Results.File(pdf, "application/pdf", $"paklys-{OrderEndpoints.EventYear}.pdf");
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
        // edited but never created or deleted. A walk shows its run route's days and figures.
        g.MapGet("/routes", async (VasbytDbContext db) =>
        {
            var routes = await db.RouteCategories.Include(r => r.Days).AsNoTracking()
                .OrderBy(r => r.SortOrder).ToListAsync();
            var byId = routes.ToDictionary(r => r.Id);
            return Results.Ok(routes.Select(r =>
            {
                var s = PublicEndpoints.Source(r, byId);
                return new
                {
                    r.Id, r.Code, r.Name, Discipline = r.Discipline.ToString(), r.Blurb,
                    s.TotalDistanceKm, s.ElevationGainM, r.Difficulty, s.GpxFileName,
                    r.SortOrder, r.IsOpen,
                    SharesRouteWithCode = s == r ? null : s.Code,
                    Days = s.Days.OrderBy(d => d.DayNumber).Select(d => new
                    {
                        d.Id, d.DayNumber, d.DateLocal, d.DistanceKm, d.ElevationGainM,
                        d.StartTimeLocal, d.Description, d.GpxFileName,
                    }),
                };
            }));
        });

        g.MapPut("/routes/{id:int}", async (int id, RouteCategoryRequest req, VasbytDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.Problem("'n Roete benodig 'n naam.", statusCode: 400);
            if (await db.RouteCategories.FindAsync(id) is not { } route) return Results.NotFound();
            (route.Name, route.Blurb, route.Difficulty) = (req.Name, req.Blurb, req.Difficulty);
            // A sharing category shows its run route's distance and climb, so they are edited there only.
            if (route.SharesRouteWithId is null)
                (route.TotalDistanceKm, route.ElevationGainM) = (req.TotalDistanceKm, req.ElevationGainM);
            (route.IsOpen, route.SortOrder) = (req.IsOpen, req.SortOrder);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        g.MapPost("/routes/{id:int}/days", async (
            int id, CreateRouteDayRequest req, VasbytDbContext db) =>
        {
            if (await db.RouteCategories.FindAsync(id) is not { } cat) return Results.NotFound();
            if (SharedRouteConflict(cat) is { } conflict) return conflict;
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
            if (await db.RouteCategories.FindAsync(id) is { } cat && SharedRouteConflict(cat) is { } conflict)
                return conflict;
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
            if (await db.RouteCategories.FindAsync(id) is { } cat && SharedRouteConflict(cat) is { } conflict)
                return conflict;
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

    private static IResult? SharedRouteConflict(RouteCategory cat) =>
        cat.SharesRouteWithId is null ? null : Results.Problem(
            "Hierdie roete deel sy dae met die hardloop-roete. Wysig die dae daar.", statusCode: 409);

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
