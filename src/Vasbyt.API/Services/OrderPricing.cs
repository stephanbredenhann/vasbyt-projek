using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;

namespace Vasbyt.API.Services;

public static class OrderPricing
{
    public static string Fingerprint(CreateOrderRequest req)
    {
        var tickets = (req.Tickets ?? []).GroupBy(t => (t.RouteCategoryId, t.TariffKind))
            .OrderBy(g => g.Key.RouteCategoryId).ThenBy(g => g.Key.TariffKind)
            .Select(g => new { g.Key.RouteCategoryId, TariffKind = (int)g.Key.TariffKind,
                Quantity = g.Sum(x => (long)x.Quantity) }).ToArray();
        var products = (req.Products ?? []).GroupBy(p => p.ProductVariantId)
            .OrderBy(g => g.Key).Select(g => new { ProductVariantId = g.Key,
                Quantity = g.Sum(x => (long)x.Quantity) }).ToArray();
        var input = JsonSerializer.Serialize(new
        {
            FirstName = req.FirstName?.Trim() ?? "", LastName = req.LastName?.Trim() ?? "",
            Email = req.Email?.Trim().ToLowerInvariant() ?? "", Phone = req.Phone?.Trim() ?? "",
            DonationZar = Math.Round(req.DonationZar ?? 0, 2).ToString("0.00", CultureInfo.InvariantCulture),
            Tickets = tickets, Products = products,
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
    }

    public static async Task<(Order? Order, string? Error)> QuoteAsync(
        VasbytDbContext db, CreateOrderRequest req, bool requireBuyer)
    {
        if (requireBuyer && (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName)))
            return (null, "Naam en van van die koper word vereis.");
        if (requireBuyer && (string.IsNullOrWhiteSpace(req.Email) ||
            !new EmailAddressAttribute().IsValid(req.Email.Trim())))
            return (null, "'n Geldige e-posadres van die koper word vereis.");
        if (req.DonationZar is < 0 || req.DonationZar is > 1_000_000m || req.DonationZar is > 0 and < 10)
            return (null, "Donasie moet minstens R10 wees en hoogstens R1 000 000.");
        if ((req.Tickets ?? []).Any(t => t.Quantity <= 0) || (req.Products ?? []).Any(p => p.Quantity <= 0))
            return (null, "Elke item benodig 'n positiewe hoeveelheid.");

        var tickets = (req.Tickets ?? []).GroupBy(t => (t.RouteCategoryId, t.TariffKind))
            .Select(g => new CartTicket(g.Key.RouteCategoryId, g.Key.TariffKind, checked((int)Math.Min(g.Sum(t => (long)t.Quantity), int.MaxValue)))).ToList();
        var products = (req.Products ?? []).GroupBy(p => p.ProductVariantId)
            .Select(g => new CartProduct(g.Key, checked((int)Math.Min(g.Sum(p => (long)p.Quantity), int.MaxValue)))).ToList();
        if (tickets.Any(t => t.Quantity > OrderEndpoints.MaxQuantity) ||
            products.Any(p => p.Quantity > OrderEndpoints.MaxQuantity) || tickets.Sum(t => (long)t.Quantity) > OrderEndpoints.MaxQuantity)
            return (null, $"Hoogstens {OrderEndpoints.MaxQuantity} per item en bestelling.");
        if (tickets.Count == 0 && products.Count == 0 && req.DonationZar is null or 0)
            return (null, "Kies asseblief ten minste een inskrywing, produk of 'n donasie.");

        var order = new Order
        {
            BuyerFirstName = req.FirstName?.Trim() ?? "", BuyerLastName = req.LastName?.Trim() ?? "",
            BuyerEmail = req.Email?.Trim() ?? "", BuyerPhone = req.Phone?.Trim() ?? "",
        };
        var now = DateTime.UtcNow;
        foreach (var ticket in tickets.OrderBy(t => t.RouteCategoryId).ThenBy(t => t.TariffKind))
        {
            if (!Enum.IsDefined(ticket.TariffKind)) return (null, "Ongeldige tarief vir inskrywing.");
            var route = await db.RouteCategories.AsNoTracking().FirstOrDefaultAsync(r => r.Id == ticket.RouteCategoryId);
            if (route is null || !route.IsOpen) return (null, $"Roete {ticket.RouteCategoryId} is nie beskikbaar nie.");
            var rule = await Pricing.RuleAsync(db, ticket.TariffKind, now);
            if (rule is null || rule.AmountZar <= 0) return (null, $"Tarief vir {route.Name} is nie beskikbaar nie.");
            order.Lines.Add(new OrderLine
            {
                Kind = OrderLineKind.Ticket, RouteCategoryId = route.Id, TariffKind = ticket.TariffKind,
                Description = $"{route.Name} - {rule.Label}", Quantity = ticket.Quantity,
                UnitPriceZar = rule.AmountZar, LineTotalZar = rule.AmountZar * ticket.Quantity,
            });
        }
        foreach (var product in products.OrderBy(p => p.ProductVariantId))
        {
            var variant = await db.ProductVariants.AsNoTracking().Include(v => v.Product)
                .FirstOrDefaultAsync(v => v.Id == product.ProductVariantId);
            if (variant is null || !variant.IsActive || variant.Product is not { IsActive: true } || variant.PriceZar < 0)
                return (null, $"Produkvariant {product.ProductVariantId} is nie beskikbaar nie.");
            if (variant.TrackStock && variant.Stock < product.Quantity)
                return (null, $"Onvoldoende voorraad vir {variant.Product.Name} - {variant.Label}.");
            order.Lines.Add(new OrderLine
            {
                Kind = OrderLineKind.Product, ProductVariantId = variant.Id,
                Description = $"{variant.Product.Name} - {variant.Label}", Quantity = product.Quantity,
                UnitPriceZar = variant.PriceZar, LineTotalZar = variant.PriceZar * product.Quantity,
            });
        }
        if (req.DonationZar is > 0)
            order.Lines.Add(new OrderLine
            {
                Kind = OrderLineKind.Donation, Description = "Donasie aan Orania Helpmekaar",
                Quantity = 1, UnitPriceZar = Math.Round(req.DonationZar.Value, 2),
                LineTotalZar = Math.Round(req.DonationZar.Value, 2),
            });
        order.TotalZar = order.Lines.Sum(l => l.LineTotalZar);
        if (order.TotalZar <= 0 || order.TotalZar > 99_999_999.99m)
            return (null, "Bestellingtotaal is ongeldig.");
        return (order, null);
    }
}
