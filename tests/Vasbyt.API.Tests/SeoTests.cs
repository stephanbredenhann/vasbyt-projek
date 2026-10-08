using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

/// Server-injected head tags, noindex rules, sitemap and robots. Works with or without a built wwwroot.
public class SeoTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public SeoTests(VasbytFactory factory) => _factory = factory;

    [Fact]
    public async Task Home_has_sportsevent_json_ld_and_open_graph()
    {
        var html = await _factory.CreateClient().GetStringAsync("/");
        Assert.Contains("\"@type\":\"SportsEvent\"", html);
        Assert.Contains("\"@type\":\"Organization\"", html);
        Assert.Contains("property=\"og:title\"", html);
        Assert.Contains("<vb-root><div", html);
    }

    [Fact]
    public async Task Route_page_names_the_route_in_title_and_canonical()
    {
        var html = await _factory.CreateClient().GetStringAsync("/roetes/ligdraf");
        Assert.Matches("<title>[^<]*Ligdraf[^<]*</title>", html);
        Assert.Contains("rel=\"canonical\" href=\"http://localhost/roetes/ligdraf\"", html);
        Assert.Contains("BreadcrumbList", html);
        Assert.Equal(1, html.Split("<title>").Length - 1);
    }

    [Fact]
    public async Task Unknown_route_is_a_404_with_noindex()
    {
        var response = await _factory.CreateClient().GetAsync("/roetes/bogus");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("noindex", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Private_routes_are_noindex_and_the_register_landing_is_not()
    {
        var client = _factory.CreateClient();
        Assert.Contains("name=\"robots\" content=\"noindex\"", await client.GetStringAsync("/rekening"));
        Assert.DoesNotContain("noindex", await client.GetStringAsync("/registreer"));
    }

    [Fact]
    public async Task Sitemap_lists_open_routes_and_robots_points_at_it()
    {
        var client = _factory.CreateClient();
        Assert.Contains("/roetes/ligstap</loc>", await client.GetStringAsync("/sitemap.xml"));
        var robots = await client.GetStringAsync("/robots.txt");
        Assert.Contains("Sitemap: http://localhost/sitemap.xml", robots);
        Assert.Contains("Disallow: /api", robots);
        Assert.DoesNotContain("Disallow: /admin", robots);
    }

    [Fact]
    public async Task Route_text_is_escaped_in_html_and_json_ld()
    {
        var evil = "</script><img src=x onerror=alert(1)>";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            db.RouteCategories.Add(new RouteCategory { Code = "boosaardig", Name = "Boos", Blurb = evil, Difficulty = "x" });
            await db.SaveChangesAsync();
        }
        var html = await _factory.CreateClient().GetStringAsync("/roetes/boosaardig");
        Assert.DoesNotContain("<img src=x", html);
        Assert.DoesNotContain("</script><img", html);
        Assert.Contains("&lt;/script&gt;", html);
    }

    [Theory]
    [InlineData("/bestel/abc/klaar")]
    [InlineData("/registreer/produkte")]
    public async Task Deep_links_serve_the_shell_as_noindex(string path)
    {
        var response = await _factory.CreateClient().GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("noindex", await response.Content.ReadAsStringAsync());
    }
}
