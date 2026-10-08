using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

/// Social scrapers and many crawlers do not run JS, so the server writes the head tags into index.html.
public static partial class SeoEndpoints
{
    const string Site = "Orania Helpmekaar Vasbyt";
    const string DefaultImage = "/foto/og.jpg";
    const string Tagline = "Drie dae se stap, draf en fietsry in die Bo-Karoo. ’n Lekker avontuur, met ’n groter doel.";
    const string Fallback = "<!doctype html><html lang=\"af\"><head><meta charset=\"utf-8\"><title>" + Site
        + "</title><meta name=\"description\" content=\"\"></head><body><vb-root></vb-root></body></html>";
    static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    static readonly string[] PrivateRoots =
        ["rekening", "admin", "mandjie", "bestel", "teken-aan", "skep-rekening", "wagwoord-vergeet", "herstel-wagwoord"];
    static string? _shell;

    record Page(string Path, string H1, string Description);

    // To add a public page: add a row here (and its route in app.routes.ts).
    static readonly Page[] Pages =
    [
        new("/", $"{Site} {OrderEndpoints.EventYear}", Tagline),
        new("/roetes", "Roetes", "Kyk na al die roetes, afstande en klim vir stap, draf en fietsry oor drie dae in die Bo-Karoo."),
        new("/program", "Program", "Die program vir al drie dae van die Vasbyt in Orania."),
        new("/verblyf", "Verblyf", "Slaapplek in en om Orania vir deelnemers en hul gesinne."),
        new("/borge", "Borge", "Die borge wat die Vasbyt moontlik maak."),
        new("/oor-helpmekaar", "Oor Helpmekaar", "Leer meer oor Orania Helpmekaar en die doel waarvoor die Vasbyt gehou word."),
        new("/vrae", "Gereelde vrae", "Antwoorde op die mees gestelde vrae oor inskrywing, tariewe, roetes en die geleentheid."),
        new("/skenk", "Donasies", "Skenk aan Orania Helpmekaar en ondersteun die doel agter die Vasbyt."),
        new("/winkel", "Winkel", "Bestel Vasbyt-produkte aanlyn."),
        new("/registreer", "Skryf in", "Skryf in vir die Orania Helpmekaar Vasbyt. Kies jou roete en tarief en betaal aanlyn."),
    ];

    public static void MapSeoEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/robots.txt", (HttpContext c, IConfiguration cfg) => Results.Text(
            "User-agent: *\nAllow: /\nDisallow: /api\n"
            + $"Sitemap: {Base(c, cfg)}/sitemap.xml\n", "text/plain")).AllowAnonymous();

        app.MapGet("/sitemap.xml", async (HttpContext c, IConfiguration cfg, VasbytDbContext db) =>
        {
            var b = Base(c, cfg);
            var codes = await db.RouteCategories.Where(r => r.IsOpen).OrderBy(r => r.SortOrder).Select(r => r.Code).ToListAsync();
                        var paths = Pages.Select(p => p.Path).Concat(codes.Select(x => $"/roetes/{x}"));
            var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"
                + string.Concat(paths.Select(p => $"<url><loc>{Enc(b + (p == "/" ? "/" : p))}</loc></url>"))
                + "</urlset>";
            return Results.Text(xml, "application/xml");
        }).AllowAnonymous();

        app.MapFallback(Serve);
    }

    static async Task Serve(HttpContext c, IConfiguration cfg, IWebHostEnvironment env, VasbytDbContext db, IMemoryCache cache)
    {
        var path = c.Request.Path.Value!.TrimEnd('/').ToLowerInvariant();
        if (path == "") path = "/";
        var segs = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        // Missing assets and API paths are real 404s, not the SPA shell.
        if (!HttpMethods.IsGet(c.Request.Method) && !HttpMethods.IsHead(c.Request.Method)
            || path.StartsWith("/api/") || path == "/api" || path.Contains('.'))
        {
            c.Response.StatusCode = 404;
            return;
        }

        var shell = Shell(env);
        var b = Base(c, cfg);
        var status = 200;
        string head = "", summary = "";

        if (PrivateRoots.Contains(segs.FirstOrDefault() ?? "") || segs is ["registreer", _, ..])
        {
            head = "<meta name=\"robots\" content=\"noindex\">";
        }
        else
        {
            // ponytail: 60s per-path cache, so a price or route edit shows up within a minute; add invalidation if that is too slow.
            (status, head, summary) = await cache.GetOrCreateAsync($"seo:{b}{path}", async e =>
            {
                e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60);
                return await Resolve(path, segs, b, db);
            });
        }

        if (head.Contains("<title>")) shell = TitleRx().Replace(shell, "");
        if (head.Contains("name=\"description\"")) shell = DescRx().Replace(shell, "");
        shell = shell.Replace("</head>", head + "</head>");
        if (summary != "") shell = shell.Replace("<vb-root></vb-root>", $"<vb-root>{summary}</vb-root>");

        c.Response.StatusCode = status;
        c.Response.ContentType = "text/html; charset=utf-8";
        c.Response.Headers.CacheControl = "no-cache";
        await c.Response.WriteAsync(shell);
    }

    static (int, string, string) Wrap((string H, string S) x) => (200, x.H, x.S);

    static async Task<(int Status, string Head, string Summary)> Resolve(string path, string[] segs, string b, VasbytDbContext db)
    {
        if (Pages.FirstOrDefault(p => p.Path == path) is { } page)
            return Wrap(await Build(page, null, b, db));
        if (segs is ["roetes", var code]
            && await db.RouteCategories.Include(r => r.Days).AsNoTracking().FirstOrDefaultAsync(r => r.Code == code) is { } route)
            return Wrap(await Build(Pages.First(p => p.Path == "/roetes"), route, b, db, path));
        return (404, "<meta name=\"robots\" content=\"noindex\"><title>Bladsy nie gevind | " + Site + "</title>", "");
    }

    static async Task<(string Head, string Summary)> Build(Page page, RouteCategory? route, string b, VasbytDbContext db, string? path = null)
    {
        path ??= page.Path;
        var all = await db.RouteCategories.Include(r => r.Days).AsNoTracking().OrderBy(r => r.SortOrder).ToListAsync();
        var byId = all.ToDictionary(r => r.Id);
        RouteCategory Src(RouteCategory r) => r.SharesRouteWithId is { } id && byId.TryGetValue(id, out var s) ? s : r;

        var title = page.Path == "/" ? page.H1 : $"{page.H1} | {Site}";
        var desc = page.Description;
        var ld = new List<object>();
        var crumbs = new List<(string Name, string Url)> { ("Tuis", b + "/") };
        var extra = "";

        if (page.Path == "/")
        {
            ld.Add(O(("@context", "https://schema.org"), ("@type", "Organization"), ("name", "Orania Helpmekaar"),
                ("url", "https://oraniahelpmekaar.co.za"), ("logo", b + "/merk/orania-helpmekaar.png")));
            ld.Add(O(("@context", "https://schema.org"), ("@type", "WebSite"), ("name", Site), ("url", b + "/"), ("inLanguage", "af")));
            if (await Event($"{Site} {OrderEndpoints.EventYear}", desc, all.SelectMany(Src_).Distinct(), b, DefaultImage, b + "/",
                all.Any(r => r.IsOpen), db) is { } ev) ld.Add(ev);
        }
        else if (route is not null)
        {
            var src = Src(route);
            var km = src.TotalDistanceKm.ToString("0.#", Inv);
            title = $"{route.Name} | Roetes | {Site}";
            desc = $"{route.Blurb} {src.Days.Count} dae, {km} km in totaal, {src.ElevationGainM} m klim.";
            if (await Event($"{route.Name} | {Site} {OrderEndpoints.EventYear}", desc, src.Days, b, DefaultImage, b + path, route.IsOpen, db) is { } ev)
                ld.Add(ev);
            crumbs.Add(("Roetes", b + "/roetes"));
            crumbs.Add((route.Name, b + path));
            extra = $"<ul>{string.Concat(src.Days.OrderBy(d => d.DayNumber).Select(d => $"<li>Dag {d.DayNumber}: {Enc(d.Description)} ({d.DistanceKm.ToString("0.#", Inv)} km)</li>"))}</ul>";
        }
        else
        {
            if (page.Path == "/roetes")
                extra = $"<ul>{string.Concat(all.Select(r => $"<li><a href=\"/roetes/{Enc(r.Code)}\">{Enc(r.Name)}</a>: {Enc(r.Blurb)}</li>"))}</ul>";
            if (page.Path == "/winkel")
            {
                var products = await db.Products.Include(p => p.Variants).AsNoTracking().Where(p => p.IsActive)
                    .OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();
                products = products.Where(p => p.Variants.Any(v => v.IsActive && (!v.TrackStock || v.Stock > 0))).ToList();
                if (products.Count > 0)
                {
                    object Product(Product p, int i) => O(("@type", "ListItem"), ("position", i + 1), ("item", O(
                        ("@type", "Product"), ("name", p.Name), ("description", p.Description),
                        ("image", Abs(b, MediaStore.Url(p.ImageFileName) ?? DefaultImage)),
                        ("offers", p.Variants.Where(v => v.IsActive && (!v.TrackStock || v.Stock > 0)).Select(v => O(
                            ("@type", "Offer"), ("name", v.Label), ("price", v.PriceZar.ToString("0.00", Inv)),
                            ("priceCurrency", "ZAR"), ("availability", "https://schema.org/InStock"), ("url", b + "/winkel"))))))
                    );
                    ld.Add(O(("@context", "https://schema.org"), ("@type", "ItemList"),
                        ("itemListElement", products.Select(Product))));
                    extra = $"<ul>{string.Concat(products.Select(p => $"<li>{Enc(p.Name)}</li>"))}</ul>";
                }
            }
            if (page.Path != "/") crumbs.Add((page.H1, b + path));
        }

        if (crumbs.Count > 1)
            ld.Add(O(("@context", "https://schema.org"), ("@type", "BreadcrumbList"),
                ("itemListElement", crumbs.Select((c, i) => O(("@type", "ListItem"), ("position", i + 1), ("name", c.Name), ("item", c.Url))))));

        var url = b + (path == "/" ? "/" : path);
        var img = b + DefaultImage;
        var sb = new StringBuilder();
        sb.Append($"<title>{Enc(title)}</title><meta name=\"description\" content=\"{Enc(desc)}\">");
        sb.Append($"<link rel=\"canonical\" href=\"{Enc(url)}\">");
        sb.Append($"<meta property=\"og:type\" content=\"website\"><meta property=\"og:title\" content=\"{Enc(title)}\">");
        sb.Append($"<meta property=\"og:description\" content=\"{Enc(desc)}\"><meta property=\"og:url\" content=\"{Enc(url)}\">");
        sb.Append($"<meta property=\"og:image\" content=\"{Enc(img)}\"><meta property=\"og:site_name\" content=\"{Site}\">");
        sb.Append("<meta property=\"og:image:width\" content=\"1200\"><meta property=\"og:image:height\" content=\"630\"><meta property=\"og:image:type\" content=\"image/jpeg\">");
        sb.Append($"<meta property=\"og:image:alt\" content=\"{Site}\"><meta name=\"twitter:image:alt\" content=\"{Site}\">");
        sb.Append("<meta property=\"og:locale\" content=\"af_ZA\"><meta name=\"twitter:card\" content=\"summary_large_image\">");
        sb.Append($"<meta name=\"twitter:title\" content=\"{Enc(title)}\"><meta name=\"twitter:description\" content=\"{Enc(desc)}\">");
        sb.Append($"<meta name=\"twitter:image\" content=\"{Enc(img)}\">");
        // Default encoding escapes < > & so the payload cannot close the script tag.
        foreach (var o in ld) sb.Append($"<script type=\"application/ld+json\">{JsonSerializer.Serialize(o)}</script>");

        var nav = string.Concat(Pages.Skip(1).Select(p => $"<a href=\"{p.Path}\">{Enc(p.H1)}</a> "));
        var summary = "<div style=\"position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap\">"
            + $"<h1>{Enc(route?.Name ?? page.H1)}</h1><p>{Enc(desc)}</p>{extra}<nav>{nav}</nav></div>";
        return (sb.ToString(), summary);

        IEnumerable<RouteDay> Src_(RouteCategory r) => Src(r).Days;
    }

    static async Task<Dictionary<string, object?>?> Event(string name, string desc, IEnumerable<RouteDay> days, string b,
        string image, string url, bool open, VasbytDbContext db)
    {
        var d = days.OrderBy(x => x.DateLocal).ThenBy(x => x.StartTimeLocal).ToList();
        if (d.Count == 0) return null;
        var offers = new List<object>();
        foreach (var kind in new[] { TariffKind.Student, TariffKind.Normal })
            if (await Pricing.RuleAsync(db, kind, DateTime.UtcNow) is { } r)
                offers.Add(O(("@type", "Offer"), ("name", r.Label), ("price", r.AmountZar.ToString("0.00", Inv)),
                    ("priceCurrency", "ZAR"), ("url", b + "/registreer"),
                    ("availability", open ? "https://schema.org/InStock" : null),
                    ("validFrom", DateTime.SpecifyKind(r.ValidFromUtc, DateTimeKind.Utc).ToString("yyyy-MM-ddTHH:mm:ssZ", Inv))));
        return O(("@context", "https://schema.org"), ("@type", "SportsEvent"), ("name", name), ("description", desc),
            ("startDate", Local(d[0].DateLocal, d[0].StartTimeLocal)),
            ("endDate", Local(d[^1].DateLocal, new TimeOnly(23, 59))),
            ("eventStatus", "https://schema.org/EventScheduled"),
            ("eventAttendanceMode", "https://schema.org/OfflineEventAttendanceMode"),
            ("location", O(("@type", "Place"), ("name", "Orania"), ("address", O(("@type", "PostalAddress"),
                ("addressLocality", "Orania"), ("addressRegion", "Noord-Kaap"), ("addressCountry", "ZA"))))),
            ("organizer", O(("@type", "Organization"), ("name", "Orania Helpmekaar"), ("url", "https://oraniahelpmekaar.co.za"))),
            ("image", Abs(b, image)), ("url", url), ("offers", offers.Count > 0 ? offers : null));
    }

    static string Local(DateOnly d, TimeOnly t) => $"{d.ToString("yyyy-MM-dd", Inv)}T{t.ToString("HH:mm", Inv)}:00+02:00";
    static string Abs(string b, string p) => p.StartsWith("http") ? p : b + p;
    static string Enc(string s) => WebUtility.HtmlEncode(s);
    static Dictionary<string, object?> O(params (string K, object? V)[] p) => p.Where(x => x.V is not null).ToDictionary(x => x.K, x => x.V);

    static string Base(HttpContext c, IConfiguration cfg) =>
        (cfg["Public:BaseUrl"] is { Length: > 0 } b ? b : $"{c.Request.Scheme}://{c.Request.Host}").TrimEnd('/');

    static string Shell(IWebHostEnvironment env)
    {
        if (!env.IsDevelopment() && _shell is not null) return _shell;
        var f = env.WebRootFileProvider.GetFileInfo("index.html");
        var html = f.Exists && f.PhysicalPath is { } p ? File.ReadAllText(p) : Fallback;
        return _shell = html;
    }

    [GeneratedRegex("<title>.*?</title>", RegexOptions.Singleline)] private static partial Regex TitleRx();
    [GeneratedRegex("<meta\\s+name=\"description\"[^>]*>", RegexOptions.Singleline)] private static partial Regex DescRx();
}
