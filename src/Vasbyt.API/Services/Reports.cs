using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;
using static Vasbyt.API.Services.ReportCharts;

namespace Vasbyt.API.Services;

/// Dates are SAST days, inclusive on both ends.
public record ReportFilter(DateOnly? From, DateOnly? To, string? RouteCode, int? ProductId);

public record Tile(string Label, string Value);
/// The first TextColumns columns are words (left, wider); the rest are numbers (right aligned).
public record ReportTable(string[] Headers, List<string[]> Rows, string[]? Footer = null, int TextColumns = 1);

/// One titled piece of a report: any of a chart, a table and a picture. The browser and the PDF lay out the same blocks.
public record Block(string Title, string? Svg = null, ReportTable? Table = null, string? Image = null)
{
    public string? ImageUrl => MediaStore.Url(Image);
}

public record Report(string Title, string Filter, List<Tile> Tiles, List<Block> Blocks);

/// The three admin reports. Paid orders only, dated by when they were paid.
/// ponytail: rows are aggregated in memory, fine for one event's orders; push the grouping into SQL past tens of thousands.
public static class Reports
{
    private static readonly string[] Months = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
    private static readonly string[] AgeBands = ["Onder 18", "18 tot 29", "30 tot 39", "40 tot 49", "50 tot 59", "60+", "Onbekend"];

    public static Task<Report>? Build(string name, VasbytDbContext db, ReportFilter f) => name switch
    {
        "oorsig" => OorsigAsync(db, f),
        "inskrywings" => InskrywingsAsync(db, f),
        "produkte" => ProdukteAsync(db, f),
        _ => null,
    };

    public static async Task<Report> OorsigAsync(VasbytDbContext db, ReportFilter f)
    {
        var orders = await Paid(db, f).Select(o => new
        {
            At = o.PaidUtc ?? o.CreatedUtc,
            Lines = o.Lines.Select(l => new { l.Kind, l.Quantity, l.LineTotalZar }).ToList(),
        }).ToListAsync();

        var rows = orders.Select(o => new
        {
            Day = Sast(o.At),
            Entrants = o.Lines.Where(l => l.Kind == OrderLineKind.Ticket).Sum(l => l.Quantity),
            Entry = o.Lines.Where(l => l.Kind == OrderLineKind.Ticket).Sum(l => l.LineTotalZar),
            Product = o.Lines.Where(l => l.Kind == OrderLineKind.Product).Sum(l => l.LineTotalZar),
            Donation = o.Lines.Where(l => l.Kind == OrderLineKind.Donation).Sum(l => l.LineTotalZar),
        }).ToList();

        var days = Days(f, rows.Select(r => r.Day));
        var byDay = rows.ToLookup(r => r.Day);
        var labels = days.Select(Label).ToList();
        var entry = days.Select(d => (double)byDay[d].Sum(r => r.Entry)).ToArray();
        var product = days.Select(d => (double)byDay[d].Sum(r => r.Product)).ToArray();
        var donation = days.Select(d => (double)byDay[d].Sum(r => r.Donation)).ToArray();
        var entrants = days.Select(d => (double)byDay[d].Sum(r => r.Entrants)).ToArray();
        var running = 0d;
        var donationsToDate = donation.Select(v => running += v).ToArray();

        var donors = rows.Count(r => r.Donation > 0);
        var donationTotal = rows.Sum(r => r.Donation);
        return new Report("Oorsig", FilterLabel(f),
        [
            new("Betaalde bestellings", Count(rows.Count)),
            new("Inskrywings", Count(rows.Sum(r => r.Entrants))),
            new("Totale inkomste", Money(rows.Sum(r => r.Entry + r.Product + r.Donation))),
            new("Inskrywingsgeld", Money(rows.Sum(r => r.Entry))),
            new("Produkverkope", Money(rows.Sum(r => r.Product))),
            new("Donasies", Money(donationTotal)),
            new("Skenkers", Count(donors)),
            new("Gemiddelde donasie", Money(donors > 0 ? donationTotal / donors : 0)),
        ],
        [
            new("Aankope per dag", Bars(labels,
            [
                new("Inskrywings", Indigo, entry), new("Produkte", Orange, product), new("Donasies", River, donation),
            ], Rand)),
            new("Inskrywings per dag", Bars(labels, [new("Inskrywings", Indigo, entrants)])),
            new("Donasies oor tyd (lopende totaal)", Line(labels, donationsToDate, River, Rand)),
            new("Daaglikse opsomming", Table: new ReportTable(
                ["Dag", "Bestellings", "Inskrywings", "Inskrywingsgeld", "Produkte", "Donasies", "Totaal"],
                [.. rows.GroupBy(r => r.Day).OrderBy(g => g.Key).Select(g => new[]
                {
                    g.Key.ToString("yyyy-MM-dd"), Count(g.Count()), Count(g.Sum(r => r.Entrants)),
                    Money(g.Sum(r => r.Entry)), Money(g.Sum(r => r.Product)), Money(g.Sum(r => r.Donation)),
                    Money(g.Sum(r => r.Entry + r.Product + r.Donation)),
                })],
                ["Totaal", Count(rows.Count), Count(rows.Sum(r => r.Entrants)), Money(rows.Sum(r => r.Entry)),
                    Money(rows.Sum(r => r.Product)), Money(donationTotal), Money(rows.Sum(r => r.Entry + r.Product + r.Donation))])),
        ]);
    }

    public static async Task<Report> InskrywingsAsync(VasbytDbContext db, ReportFilter f)
    {
        var orderIds = Paid(db, f).Select(o => o.Id);
        var query = db.Entrants.AsNoTracking().Where(e => orderIds.Contains(e.OrderLine!.OrderId));
        if (!string.IsNullOrWhiteSpace(f.RouteCode)) query = query.Where(e => e.RouteCategory!.Code == f.RouteCode);
        var entrants = await query.Select(e => new
        {
            e.RouteCategory!.Code, e.RouteCategory.Name, e.RouteCategory.SortOrder,
            e.IsComplete, e.Gender, e.DateOfBirth, e.Town,
        }).ToListAsync();
        var start = await db.RouteDays.MinAsync(d => (DateOnly?)d.DateLocal) ?? new DateOnly(OrderEndpoints.EventYear, 1, 1);

        var people = entrants.Select(e => new
        {
            e.Code, e.Name, e.SortOrder,
            Gender = e.Gender switch { "M" => "Mans", "V" => "Vroue", _ => "Onbekend" },
            Age = e.IsComplete && e.DateOfBirth != default ? AgeOn(e.DateOfBirth, start) : (int?)null,
            Town = e.Town.Trim().ToLowerInvariant(),
        }).Select(p => new { p.Code, p.Name, p.SortOrder, p.Gender, p.Age, Band = Band(p.Age), p.Town }).ToList();

        var cats = people.GroupBy(p => (p.Code, p.Name, p.SortOrder)).OrderBy(g => g.Key.SortOrder).ToList();
        string[] genders = ["Mans", "Vroue", "Onbekend"];
        string[] genderColors = [Indigo, Orange, Reed];
        Series[] ByGender<T>(IReadOnlyList<T> keys, Func<T, string, double> count) =>
            [.. genders.Select((g, i) => new Series(g, genderColors[i], [.. keys.Select(k => count(k, g))]))];

        var towns = people.Where(p => p.Town.Length > 0).GroupBy(p => p.Town)
            .OrderByDescending(g => g.Count()).ThenBy(g => g.Key).ToList();
        var townItems = towns.Take(12)
            .Select(g => new Item(CultureInfo.InvariantCulture.TextInfo.ToTitleCase(g.Key), g.Count(), Willow)).ToList();
        if (towns.Count > 12) townItems.Add(new("Ander", towns.Skip(12).Sum(g => g.Count()), Reed));
        if (people.Count(p => p.Town.Length == 0) is > 0 and var blank) townItems.Add(new("Onbekend", blank, Reed));

        var ages = people.Where(p => p.Age is not null).Select(p => (double)p.Age!.Value).ToList();
        string AvgAge(IEnumerable<int?> a) => a.Where(x => x is not null).Select(x => (double)x!.Value).DefaultIfEmpty().Average() is var v && v > 0 ? v.ToString("0.0", Num) : "-";

        return new Report("Inskrywings", FilterLabel(f) + (string.IsNullOrWhiteSpace(f.RouteCode) ? "" : $", {cats.FirstOrDefault()?.Key.Name ?? f.RouteCode}"),
        [
            new("Inskrywings", Count(people.Count)),
            new("Vorms voltooi", Count(entrants.Count(e => e.IsComplete))),
            new("Mans", Count(people.Count(p => p.Gender == "Mans"))),
            new("Vroue", Count(people.Count(p => p.Gender == "Vroue"))),
            new("Gemiddelde ouderdom", AvgAge(people.Select(p => p.Age))),
            new("Jongste", ages.Count > 0 ? Count(ages.Min()) : "-"),
            new("Oudste", ages.Count > 0 ? Count(ages.Max()) : "-"),
            new("Tuisdorpe", Count(towns.Count)),
        ],
        [
            new("Inskrywings per kategorie", HBars([.. cats.Select(c => new Item(c.Key.Name, c.Count(), Category.GetValueOrDefault(c.Key.Code, Indigo)))])),
            new("Geslag per kategorie", Bars([.. cats.Select(c => c.Key.Name)], ByGender(cats, (c, g) => c.Count(p => p.Gender == g)))),
            new("Ouderdomsgroepe", Bars(AgeBands, ByGender(AgeBands, (b, g) => people.Count(p => p.Band == b && p.Gender == g)))),
            new("Tuisdorpe", HBars(townItems)),
            new("Kategorie volgens geslag en ouderdom", Table: new ReportTable(
                ["Kategorie", "Mans", "Vroue", "Onbekend", "Totaal", "Gem. ouderdom"],
                [.. cats.Select(c => new[]
                {
                    c.Key.Name, Count(c.Count(p => p.Gender == "Mans")), Count(c.Count(p => p.Gender == "Vroue")),
                    Count(c.Count(p => p.Gender == "Onbekend")), Count(c.Count()), AvgAge(c.Select(p => p.Age)),
                })],
                ["Totaal", Count(people.Count(p => p.Gender == "Mans")), Count(people.Count(p => p.Gender == "Vroue")),
                    Count(people.Count(p => p.Gender == "Onbekend")), Count(people.Count), AvgAge(people.Select(p => p.Age))])),
            new("Ouderdomsgroepe per kategorie", Table: new ReportTable(
                ["Kategorie", .. AgeBands],
                [.. cats.Select(c => (string[])[c.Key.Name, .. AgeBands.Select(b => Count(c.Count(p => p.Band == b)))])],
                ["Totaal", .. AgeBands.Select(b => Count(people.Count(p => p.Band == b)))])),
        ]);
    }

    public static async Task<Report> ProdukteAsync(VasbytDbContext db, ReportFilter f)
    {
        var query = Paid(db, f).SelectMany(o => o.Lines
            .Where(l => l.Kind == OrderLineKind.Product && l.ProductVariantId != null)
            .Select(l => new
            {
                At = o.PaidUtc ?? o.CreatedUtc, OrderId = o.Id, o.BuyerEmail, o.BuyerFirstName, o.BuyerLastName,
                l.ProductVariant!.ProductId, Product = l.ProductVariant.Product!.Name, l.ProductVariant.Product.ImageFileName,
                l.ProductVariant.Product.SortOrder, Variant = l.ProductVariant.Label, l.Quantity, l.LineTotalZar,
            }));
        if (f.ProductId is { } productId) query = query.Where(l => l.ProductId == productId);
        var lines = (await query.ToListAsync()).Select(l => new
        {
            Day = Sast(l.At), l.OrderId, l.BuyerEmail, l.BuyerFirstName, l.BuyerLastName, l.ProductId, l.Product,
            l.ImageFileName, l.SortOrder, l.Variant, l.Quantity, l.LineTotalZar,
        }).ToList();

        var days = Days(f, lines.Select(l => l.Day));
        var labels = days.Select(Label).ToList();
        var products = lines.GroupBy(l => l.ProductId).OrderBy(g => g.First().SortOrder).ThenBy(g => g.First().Product).ToList();

        // Latest order's name wins, same rule as the packing list.
        var payers = lines.GroupBy(l => l.BuyerEmail.Trim().ToLowerInvariant()).Select(g =>
        {
            var last = g.MaxBy(l => l.OrderId)!;
            return new
            {
                Name = $"{last.BuyerFirstName} {last.BuyerLastName}".Trim(), Email = last.BuyerEmail,
                Orders = g.Select(l => l.OrderId).Distinct().Count(), Units = g.Sum(l => l.Quantity), Spent = g.Sum(l => l.LineTotalZar),
            };
        }).OrderByDescending(p => p.Spent).ThenBy(p => p.Name).ToList();

        var blocks = new List<Block>
        {
            new("Eenhede verkoop per produk", HBars([.. products.Select(p => new Item(p.First().Product, p.Sum(l => l.Quantity), Orange))])),
        };
        foreach (var p in products)
        {
            var byDay = p.ToLookup(l => l.Day);
            var running = 0d;
            var toDate = days.Select(d => running += byDay[d].Sum(l => l.Quantity)).ToArray();
            blocks.Add(new(p.First().Product, Line(labels, toDate, Indigo, height: 170), new ReportTable(
                ["Variant", "Eenhede", "Bedrag"],
                [.. p.GroupBy(l => l.Variant).OrderByDescending(v => v.Sum(l => l.Quantity))
                    .Select(v => new[] { v.Key.Length > 0 ? v.Key : "Standaard", Count(v.Sum(l => l.Quantity)), Money(v.Sum(l => l.LineTotalZar)) })],
                ["Totaal", Count(p.Sum(l => l.Quantity)), Money(p.Sum(l => l.LineTotalZar))]), p.First().ImageFileName));
        }
        blocks.Add(new("Besteding per betaler", Table: new ReportTable(
            ["Betaler", "E-pos", "Bestellings", "Eenhede", "Bedrag"],
            [.. payers.Select(p => new[] { p.Name, p.Email, Count(p.Orders), Count(p.Units), Money(p.Spent) })],
            ["Totaal", "", Count(lines.Select(l => l.OrderId).Distinct().Count()), Count(lines.Sum(l => l.Quantity)), Money(lines.Sum(l => l.LineTotalZar))], TextColumns: 2)));

        return new Report("Produkte", FilterLabel(f) + (f.ProductId is null ? "" : $", {await db.Products.Where(p => p.Id == f.ProductId).Select(p => p.Name).FirstOrDefaultAsync()}"),
        [
            new("Produkverkope", Money(lines.Sum(l => l.LineTotalZar))),
            new("Eenhede verkoop", Count(lines.Sum(l => l.Quantity))),
            new("Kopers", Count(payers.Count)),
            new("Gemiddeld per koper", Money(payers.Count > 0 ? lines.Sum(l => l.LineTotalZar) / payers.Count : 0)),
        ], blocks);
    }

    private static IQueryable<Order> Paid(VasbytDbContext db, ReportFilter f)
    {
        var q = db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Paid);
        if (f.From is { } from)
        {
            var t = Utc(from);
            q = q.Where(o => (o.PaidUtc ?? o.CreatedUtc) >= t);
        }
        if (f.To is { } to)
        {
            var t = Utc(to.AddDays(1));
            q = q.Where(o => (o.PaidUtc ?? o.CreatedUtc) < t);
        }
        return q;
    }

    /// Every day in the filter (or in the data when open ended), so quiet days show as gaps on the axis.
    private static List<DateOnly> Days(ReportFilter f, IEnumerable<DateOnly> seen)
    {
        var list = seen.ToList();
        var first = f.From ?? (list.Count > 0 ? list.Min() : (DateOnly?)null);
        var last = f.To ?? (list.Count > 0 ? list.Max() : (DateOnly?)null);
        if (first is null || last is null || last < first) return [];
        // A runaway range (a From years back) would draw thousands of hairline bars, so cap it at a year.
        if (last.Value.DayNumber - first.Value.DayNumber > 366) first = last.Value.AddDays(-366);
        return [.. Enumerable.Range(0, last.Value.DayNumber - first.Value.DayNumber + 1).Select(first.Value.AddDays)];
    }

    private static DateOnly Sast(DateTime utc) => DateOnly.FromDateTime(utc.AddHours(2));
    private static DateTime Utc(DateOnly sastDay) => DateTime.SpecifyKind(sastDay.ToDateTime(TimeOnly.MinValue).AddHours(-2), DateTimeKind.Utc);
    private static string Label(DateOnly d) => $"{d.Day} {Months[d.Month - 1]}";
    private static string Money(decimal v) => "R " + v.ToString("#,0.00", Num);

    internal static int AgeOn(DateOnly dob, DateOnly day) => day.Year - dob.Year - (day < dob.AddYears(day.Year - dob.Year) ? 1 : 0);

    private static string Band(int? age) => age switch
    {
        null => "Onbekend",
        < 18 => "Onder 18",
        < 30 => "18 tot 29",
        < 40 => "30 tot 39",
        < 50 => "40 tot 49",
        < 60 => "50 tot 59",
        _ => "60+",
    };

    private static string FilterLabel(ReportFilter f) => (f.From, f.To) switch
    {
        (null, null) => "Alle datums",
        ({ } a, null) => $"Vanaf {a:yyyy-MM-dd}",
        (null, { } b) => $"Tot en met {b:yyyy-MM-dd}",
        ({ } a, { } b) => $"{a:yyyy-MM-dd} tot {b:yyyy-MM-dd}",
    };
}
