using Microsoft.AspNetCore.Identity;

namespace Vasbyt.API.Domain;

public enum Discipline { Run = 0, Cycle = 1 }
public enum OrderStatus { Pending = 0, Paid = 1, Cancelled = 2 }

public class Event
{
    public int Id { get; set; }
    public Discipline Discipline { get; set; }
    public string Name { get; set; } = "";
    public string Blurb { get; set; } = "";
    public DateTime StartDateUtc { get; set; }
    public bool IsOpen { get; set; } = true;
    public List<EventDistance> Distances { get; set; } = [];
}

public class EventDistance
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public Event? Event { get; set; }
    public string Name { get; set; } = "";
    public decimal DistanceKm { get; set; }
    public int ElevationGainM { get; set; }
    /// File in Vasbyt.API/Routes/, exported from Strava. Null until the GPX lands.
    public string? GpxFileName { get; set; }
}

public class Order
{
    public int Id { get; set; }
    /// The anonymous browser's only handle on this order — it exists before any account does.
    public Guid PublicToken { get; set; } = Guid.NewGuid();
    /// How many places were paid for. Fixed once the order is Paid: getting this wrong means
    /// paying again, which is the rule the organisers were explicit about.
    public int EntrantCount { get; set; }
    /// Entry fee at the time of the order, times EntrantCount. Snapshotted so that a later change
    /// to the fee never rewrites what someone actually owed.
    public decimal AmountZar { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PaidUtc { get; set; }
    public string? PaymentReference { get; set; }
    /// Null until the first entrant's form creates or attaches an account.
    public Guid? UserId { get; set; }
    public AppUser? User { get; set; }
    public List<Entrant> Entrants { get; set; } = [];
}

public class Entrant
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    /// Which of the four events this person is running or riding. Chosen per person, after payment
    /// — the entry fee is flat, so the order does not need to know which one until now.
    public int EventDistanceId { get; set; }
    public EventDistance? EventDistance { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public DateOnly DateOfBirth { get; set; }
    public string Gender { get; set; } = "";
    public string ShirtSize { get; set; } = "";
    public string EmergencyName { get; set; } = "";
    public string EmergencyPhone { get; set; } = "";
    public string? MedicalNotes { get; set; }
    public string Town { get; set; } = "";
    /// Drives the homepage map. Aggregated to a count before it ever leaves the server (POPIA).
    public string Province { get; set; } = "";
    public string? ClubName { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}

public class Donation
{
    public int Id { get; set; }
    public Guid PublicToken { get; set; } = Guid.NewGuid();
    public string? DonorName { get; set; }
    public string? Email { get; set; }
    public decimal AmountZar { get; set; }
    public string? Message { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public string? PaymentReference { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
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
