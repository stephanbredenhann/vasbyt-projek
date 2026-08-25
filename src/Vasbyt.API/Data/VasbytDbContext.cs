using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Data;

public class VasbytDbContext(DbContextOptions<VasbytDbContext> options)
    : IdentityDbContext<AppUser, AppRole, Guid>(options)
{
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventDistance> EventDistances => Set<EventDistance>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Entrant> Entrants => Set<Entrant>();
    public DbSet<Donation> Donations => Set<Donation>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Money is decimal(10,2) everywhere. Never double — SQLite and Postgres both honour this.
        foreach (var p in b.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            p.SetColumnType("decimal(10,2)");

        b.Entity<Order>(e =>
        {
            e.HasIndex(o => o.PublicToken).IsUnique();
            e.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Entrant>(e =>
        {
            e.HasOne(x => x.Order).WithMany(o => o.Entrants).HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.EventDistance).WithMany().HasForeignKey(x => x.EventDistanceId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Province);
        });

        b.Entity<EventDistance>()
            .HasOne(d => d.Event).WithMany(x => x.Distances).HasForeignKey(d => d.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Donation>().HasIndex(d => d.PublicToken).IsUnique();
    }
}
