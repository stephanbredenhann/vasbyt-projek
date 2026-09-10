using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// The single place a ticket price is decided. Everything that needs a price asks this, so a client
/// never sends one and there is no second answer to argue with.
///
/// ponytail: static over an injected service. It has no state and no second implementation, so an
/// interface would only add a constructor argument to every endpoint that needs a number.
public static class Pricing
{
    /// The rule that governs this moment: the first window for that tariff that has not yet closed.
    /// Contiguous windows make that the containing one, and before entries open it is the first one
    /// coming, which is what the price teaser on the homepage should be showing anyway.
    public static Task<PricingRule?> RuleAsync(VasbytDbContext db, TariffKind kind, DateTime utcNow) =>
        db.PricingRules.AsNoTracking()
            .Where(r => r.IsActive && r.TariffKind == kind && r.ValidToUtc > utcNow)
            .OrderBy(r => r.ValidFromUtc)
            .FirstOrDefaultAsync()!;
}
