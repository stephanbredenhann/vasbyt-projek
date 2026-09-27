using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Data;

public class VasbytDbContext(DbContextOptions<VasbytDbContext> options)
    : IdentityDbContext<AppUser, AppRole, Guid>(options)
{
    public DbSet<RouteCategory> RouteCategories => Set<RouteCategory>();
    public DbSet<RouteDay> RouteDays => Set<RouteDay>();
    public DbSet<PricingRule> PricingRules => Set<PricingRule>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<Entrant> Entrants => Set<Entrant>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Advert> Adverts => Set<Advert>();
    public DbSet<ProgrammeDay> ProgrammeDays => Set<ProgrammeDay>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Money is decimal(10,2) everywhere. Never double — SQLite and Postgres both honour this.
        foreach (var p in b.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            p.SetColumnType("decimal(10,2)");

        b.Entity<RouteCategory>(e =>
        {
            e.HasIndex(r => r.Code).IsUnique();
            e.HasMany(r => r.Days).WithOne(d => d.RouteCategory!).HasForeignKey(d => d.RouteCategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<RouteDay>().HasIndex(d => new { d.RouteCategoryId, d.DayNumber }).IsUnique();

        // The resolver reads by kind and window, so this is the only index it can use.
        b.Entity<PricingRule>().HasIndex(r => new { r.TariffKind, r.ValidFromUtc });

        b.Entity<Order>(e =>
        {
            e.HasIndex(o => o.PublicToken).IsUnique();
            e.HasIndex(o => o.Reference).IsUnique();
            e.Property(o => o.Version).IsRowVersion();
            e.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<OrderLine>(e =>
        {
            e.HasOne(l => l.Order).WithMany(o => o.Lines).HasForeignKey(l => l.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(l => l.RouteCategory).WithMany().HasForeignKey(l => l.RouteCategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(l => l.ProductVariant).WithMany().HasForeignKey(l => l.ProductVariantId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Entrant>(e =>
        {
            e.HasIndex(x => x.QrToken).IsUnique();
            e.HasOne(x => x.OrderLine).WithMany(l => l.Entrants).HasForeignKey(x => x.OrderLineId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RouteCategory).WithMany().HasForeignKey(x => x.RouteCategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Province);
            // Unique among the entrants that have one: a stub form has no number yet.
            e.HasIndex(x => x.EntryNumber).IsUnique().HasFilter("\"EntryNumber\" IS NOT NULL");
        });

        b.Entity<Product>().HasMany(p => p.Variants).WithOne(v => v.Product!)
            .HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<ProgrammeDay>(e =>
        {
            e.HasIndex(d => d.DayNumber).IsUnique();
            e.HasMany(d => d.Entries).WithOne(i => i.ProgrammeDay)
                .HasForeignKey(i => i.ProgrammeDayId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
