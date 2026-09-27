using Microsoft.AspNetCore.Identity;

namespace Vasbyt.API.Domain;

public enum Discipline { Run = 0, Cycle = 1, Walk = 2 }
public enum OrderStatus { Pending = 0, Paid = 1, Cancelled = 2 }
public enum TariffKind { Student = 0, Normal = 1 }
public enum OrderLineKind { Ticket = 0, Product = 1, Donation = 2 }
public enum AdvertKind { Accommodation = 0, Sponsor = 1 }

/// One of the six entry categories. Flat: a category is both the event and the distance, because the
/// organisers sell one three-day stage per category and never a choice of distance within one.
public class RouteCategory
{
    public int Id { get; set; }
    /// ligtrap | vastrap | ligstap | vasstap | ligdraf | vasbyt. Stable across years, so the SPA
    /// and the GPX filenames can key off it instead of an autoincrement id.
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public Discipline Discipline { get; set; }
    public string Blurb { get; set; } = "";
    public decimal TotalDistanceKm { get; set; }
    public int ElevationGainM { get; set; }
    public string Difficulty { get; set; } = "";
    /// File in Vasbyt.API/Routes/, exported from Strava. Null until the GPX lands.
    public string? GpxFileName { get; set; }
    public int SortOrder { get; set; }
    public bool IsOpen { get; set; } = true;
    public List<RouteDay> Days { get; set; } = [];
}

/// One stage of a category. Three per category, Thursday to Saturday.
public class RouteDay
{
    public int Id { get; set; }
    public int RouteCategoryId { get; set; }
    public RouteCategory? RouteCategory { get; set; }
    public int DayNumber { get; set; }
    /// Orania local date. The event has no timezone story worth modelling: it is all SAST.
    public DateOnly DateLocal { get; set; }
    public decimal DistanceKm { get; set; }
    public int ElevationGainM { get; set; }
    public TimeOnly StartTimeLocal { get; set; }
    public string Description { get; set; } = "";
    public string? GpxFileName { get; set; }
}

/// What one ticket of a given kind costs inside one date window. The server resolves the rule for
/// (kind, now) and prices every line itself, so nothing a browser sends can set a price.
public class PricingRule
{
    public int Id { get; set; }
    public TariffKind TariffKind { get; set; }
    public DateTime ValidFromUtc { get; set; }
    public DateTime ValidToUtc { get; set; }
    public decimal AmountZar { get; set; }
    public string Label { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public class Order
{
    public int Id { get; set; }
    /// The anonymous browser's only handle on this order, it exists before any account does.
    public Guid PublicToken { get; set; } = Guid.NewGuid();
    /// The number a buyer reads out over the phone. Assigned once the row has an id.
    public string Reference { get; set; } = "";
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public string BuyerFirstName { get; set; } = "";
    public string BuyerLastName { get; set; } = "";
    public string BuyerEmail { get; set; } = "";
    public string BuyerPhone { get; set; } = "";
    /// Sum of the lines, recalculated server side before payment starts. Snapshotted so a later
    /// tariff change never rewrites what someone actually owed.
    public decimal TotalZar { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PaidUtc { get; set; }
    public DateTime? ConfirmationEmailSentUtc { get; set; }
    public string? PaymentReference { get; set; }
    /// Postgres xmin. Two requests that both create the paid forms cannot both save.
    public uint Version { get; set; }
    /// Null until the first entrant's form creates or attaches an account.
    public Guid? UserId { get; set; }
    public AppUser? User { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
}

/// Tickets, shop products and the donation are all lines on one order, so payment, reconciliation
/// and the admin views have a single shape to deal with.
public class OrderLine
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    public OrderLineKind Kind { get; set; }
    /// Set on Ticket lines only. Every entrant on this line rides or runs this category.
    public int? RouteCategoryId { get; set; }
    public RouteCategory? RouteCategory { get; set; }
    public TariffKind? TariffKind { get; set; }
    /// Set on Product lines only.
    public int? ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }
    /// What the buyer saw, frozen. A renamed route or product never rewrites an old invoice.
    public string Description { get; set; } = "";
    public int Quantity { get; set; } = 1;
    public decimal UnitPriceZar { get; set; }
    public decimal LineTotalZar { get; set; }
    public List<Entrant> Entrants { get; set; } = [];
}

/// One per unit of a paid ticket line. Created by OrderEndpoints.Gate at payment, already bound to
/// the line's route and tariff, so the form asks for a person and never for an event.
public class Entrant
{
    public int Id { get; set; }
    public int OrderLineId { get; set; }
    public OrderLine? OrderLine { get; set; }
    public int RouteCategoryId { get; set; }
    public RouteCategory? RouteCategory { get; set; }
    public TariffKind TariffKind { get; set; }

    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    /// POPIA: sensitive. Never appears on a public or participant facing DTO.
    public string IdNumber { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public DateOnly DateOfBirth { get; set; }
    public string Gender { get; set; } = "";
    public string ShirtSize { get; set; } = "";
    public string StreetAddress { get; set; } = "";
    public string Town { get; set; } = "";
    /// Drives the homepage map. Aggregated to a count before it ever leaves the server (POPIA).
    public string Province { get; set; } = "";
    public string PostalCode { get; set; } = "";
    /// POPIA: the four medical fields are admin-only, same as IdNumber.
    public string? MedicalConditions { get; set; }
    public string? Medication { get; set; }
    public string? MedicalFund { get; set; }
    public string? MedicalFundNumber { get; set; }
    public string EmergencyName { get; set; } = "";
    public string EmergencyRelationship { get; set; } = "";
    public string EmergencyPhone { get; set; } = "";
    public string? ClubName { get; set; }
    public DateTime? TermsAcceptedUtc { get; set; }
    /// Only filled in when the entrant is a minor on the day of the event.
    public string? GuardianConsentName { get; set; }
    public bool PhotoConsent { get; set; }
    /// False while the form is a stub. Spec 8.2: a paid order may hold unfinished profiles.
    public bool IsComplete { get; set; }
    /// The number on the bib. Assigned when the form is completed, never before.
    public string? EntryNumber { get; set; }
    public Guid QrToken { get; set; } = Guid.NewGuid();
    public DateTime? CheckedInUtc { get; set; }
    /// Email of the admin who checked the entrant in.
    public string? CheckedInBy { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}

public class ProgrammeDay
{
    public int Id { get; set; }
    public int DayNumber { get; set; }
    public DateOnly DateLocal { get; set; }
    public string TitleAf { get; set; } = "";
    public string TitleEn { get; set; } = "";
    public string NoteAf { get; set; } = "";
    public string NoteEn { get; set; } = "";
    public List<ProgrammeEntry> Entries { get; set; } = [];
}

public class ProgrammeEntry
{
    public int Id { get; set; }
    public int ProgrammeDayId { get; set; }
    public ProgrammeDay? ProgrammeDay { get; set; }
    public TimeOnly TimeLocal { get; set; }
    public string TitleAf { get; set; } = "";
    public string TitleEn { get; set; } = "";
    public string DetailAf { get; set; } = "";
    public string DetailEn { get; set; } = "";
    public int SortOrder { get; set; }
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ImageFileName { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public List<ProductVariant> Variants { get; set; } = [];
}

public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    /// Size, colour, or whatever else distinguishes it. One free text label, not a matrix.
    public string Label { get; set; } = "";
    public decimal PriceZar { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
}

/// Paid accommodation listings and sponsor logos. One table with a Kind: they carry the same fields
/// and the same admin screen, and two tables would only duplicate both.
public class Advert
{
    public int Id { get; set; }
    public AdvertKind Kind { get; set; }
    public string Name { get; set; } = "";
    public string Blurb { get; set; } = "";
    public string? ImageFileName { get; set; }
    public string? LinkUrl { get; set; }
    public string? BookingUrl { get; set; }
    public string? Phone { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AppUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
}

public class AppRole : IdentityRole<Guid>
{
    public AppRole() { }
    public AppRole(string name) : base(name) { }
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string Participant = "Participant";
}
