using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace Vasbyt.API.Tests;

public class PrelaunchFactory : VasbytFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Prelaunch:Key", "geheim");
    }
}

/// While PRELAUNCH_KEY is set every visitor gets the holding page with the real head tags, and the key unlocks the app.
public class PrelaunchTests : IClassFixture<PrelaunchFactory>
{
    private readonly PrelaunchFactory _factory;
    public PrelaunchTests(PrelaunchFactory factory) => _factory = factory;

    [Fact]
    public async Task Gated_page_keeps_seo_tags_and_shows_the_summary_visibly()
    {
        var response = await _factory.CreateClient().GetAsync("/roetes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var html = await response.Content.ReadAsStringAsync();
        Assert.Matches("<title>Roetes[^<]*</title>", html);
        Assert.Contains("rel=\"canonical\"", html);
        Assert.Contains("<vb-root><div><h1>Roetes</h1>", html);
        Assert.DoesNotContain("noindex", html);
    }

    [Fact]
    public async Task Preview_key_sets_a_cookie_that_unlocks_the_app()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/roetes?voorskou=geheim");
        Assert.Contains("<vb-root><div style=", html);
        Assert.Contains("<vb-root><div style=", await client.GetStringAsync("/program"));
    }

    [Fact]
    public async Task Wrong_preview_key_stays_gated()
    {
        var client = _factory.CreateClient();
        Assert.Contains("<vb-root><div><h1>", await client.GetStringAsync("/roetes?voorskou=nee"));
        Assert.Contains("<vb-root><div><h1>", await client.GetStringAsync("/roetes"));
    }
}
