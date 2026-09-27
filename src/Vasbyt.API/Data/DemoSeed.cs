using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;
using Vasbyt.API.Services;

namespace Vasbyt.API.Data;

public static class DemoSeed
{
    public static async Task InitialiseAsync(VasbytDbContext db, IConfiguration cfg, IWebHostEnvironment env)
    {
        if (!env.IsDevelopment() || !cfg.GetValue<bool>("Demo:Enabled")) return;
        var media = MediaStore.Root(cfg, env);
        Directory.CreateDirectory(media);
        string? Image(string source, string target)
        {
            var path = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), source);
            if (!File.Exists(path)) return null;
            var output = Path.Combine(media, target);
            if (!File.Exists(output)) File.Copy(path, output);
            return target;
        }

        Image("merk/vasbyt-logo-full.png", "demo-vasbyt-logo-full.png");
        Image("foto/vasbyt-saam.webp", "demo-ondersteuners.webp");
        Image("foto/helpmekaar-rivier.webp", "demo-verblyf.webp");

        if (!await db.Products.AnyAsync())
        {
            db.Products.AddRange(
                new Product
                {
                    Name = "Vasbyt-hemp", SortOrder = 1,
                    Description = "Vasbyt-hemp in groottes S tot XL.",
                    ImageFileName = Image("merk/vasbyt-logo-full.png", "demo-vasbyt-logo-full.png"),
                    Variants = [new() { Label = "S", PriceZar = 250, Stock = 25 },
                        new() { Label = "M", PriceZar = 250, Stock = 25 },
                        new() { Label = "L", PriceZar = 250, Stock = 25 },
                        new() { Label = "XL", PriceZar = 250, Stock = 25 }],
                },
                new Product
                {
                    Name = "Vasbyt-ondersteunerspak", SortOrder = 2,
                    Description = "Voeg 'n ondersteunerspak by jou Vasbyt-bestelling.",
                    ImageFileName = Image("foto/vasbyt-saam.webp", "demo-ondersteuners.webp"),
                    Variants = [new() { Label = "Standaard", PriceZar = 150, Stock = 40 }],
                });
            await db.SaveChangesAsync();
        }

        if (!await db.Adverts.AnyAsync())
        {
            db.Adverts.AddRange(
                new Advert
                {
                    Kind = AdvertKind.Accommodation, Name = "Karoo-gastehuis",
                    Blurb = "Verblyf in Orania. Besonderhede en besprekings word deur die aanbieder bevestig.",
                    ImageFileName = Image("foto/helpmekaar-rivier.webp", "demo-verblyf.webp"),
                },
                new Advert
                {
                    Kind = AdvertKind.Sponsor, Name = "Vasbyt-ondersteuner",
                    Blurb = "Saam maak ons die Vasbyt en Orania Helpmekaar se werk moontlik.",
                    ImageFileName = Image("merk/vasbyt-logo-full.png", "demo-vasbyt-logo-full.png"),
                });
            await db.SaveChangesAsync();
        }

        if (await db.Orders.AnyAsync()) return;
        var routes = await db.RouteCategories.Where(r => r.IsOpen).OrderBy(r => r.SortOrder).ToListAsync();
        var provinces = new[] { "Noord-Kaap", "Gauteng", "Wes-Kaap", "Vrystaat" };
        var names = new[] { "Johan", "Anika", "Pieter", "Marlie" };
        var price = (await Pricing.RuleAsync(db, TariffKind.Normal, DateTime.UtcNow))?.AmountZar ?? 440;
        var variant = await db.ProductVariants.OrderBy(v => v.Id).FirstAsync();
        for (var n = 0; n < routes.Count; n++)
        {
            var route = routes[n];
            var order = new Order
            {
                Reference = $"DEMO-2027-{n + 1:D6}", Status = OrderStatus.Paid,
                BuyerFirstName = names[n % names.Length], BuyerLastName = "Voorbeeld",
                BuyerEmail = $"demo{n + 1}@example.test", BuyerPhone = "0000000000",
                PaidUtc = DateTime.UtcNow, PaymentReference = $"DEMO-SEED-{n + 1}",
                Lines =
                [
                    new() { Kind = OrderLineKind.Ticket, RouteCategoryId = route.Id,
                        TariffKind = TariffKind.Normal, Description = $"{route.Name} - Normaal",
                        Quantity = n + 2, UnitPriceZar = price, LineTotalZar = price * (n + 2) },
                    new() { Kind = OrderLineKind.Product, ProductVariantId = variant.Id,
                        Description = "Vasbyt-hemp - S", Quantity = 1,
                        UnitPriceZar = variant.PriceZar, LineTotalZar = variant.PriceZar },
                    new() { Kind = OrderLineKind.Donation, Description = "Donasie aan Orania Helpmekaar",
                        Quantity = 1, UnitPriceZar = 100, LineTotalZar = 100 },
                ],
            };
            order.TotalZar = order.Lines.Sum(l => l.LineTotalZar);
            OrderEndpoints.Gate(order);
            db.Orders.Add(order);
            await db.SaveChangesAsync();
            foreach (var entrant in order.Lines.SelectMany(l => l.Entrants))
            {
                entrant.FirstName = names[n % names.Length]; entrant.LastName = $"Voorbeeld {entrant.Id}";
                entrant.Email = order.BuyerEmail; entrant.Phone = "0000000000";
                entrant.DateOfBirth = new(1990, 1, 1); entrant.Gender = "M"; entrant.ShirtSize = "M";
                entrant.Town = "Voorbeelddorp"; entrant.Province = provinces[n % provinces.Length];
                entrant.EmergencyName = "Voorbeeldnoodkontak"; entrant.EmergencyPhone = "0000000000";
                entrant.EmergencyRelationship = "Familie";
                entrant.TermsAcceptedUtc = DateTime.UtcNow; entrant.IsComplete = true;
                entrant.EntryNumber = $"VB2027-{entrant.Id:D4}";
            }
            await db.SaveChangesAsync();
        }
    }
}
