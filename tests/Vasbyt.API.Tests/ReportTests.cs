using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

public class ReportTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public ReportTests(VasbytFactory factory) => _factory = factory;

    [Fact]
    public async Task Reports_cover_paid_orders_only_and_render_as_pdf()
    {
        var client = await _factory.AdminClientAsync("reports-admin@vasbyt.test");
        var variantId = await NewVariant();

        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toetser", Email = "koper@voorbeeld.co.za",
            Tickets = new[] { new { RouteCategoryId = _factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 2 } },
            Products = new[] { new { ProductVariantId = variantId, Quantity = 3 } },
            DonationZar = 75m,
        });
        var token = (await created.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        // Left unpaid: must not appear anywhere.
        (await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Nie", LastName = "Betaal", Email = "nie@voorbeeld.co.za",
            Products = new[] { new { ProductVariantId = variantId, Quantity = 9 } },
            DonationZar = 500m,
        })).EnsureSuccessStatusCode();

        var oorsig = await client.GetFromJsonAsync<ReportShape>("/api/admin/reports/oorsig");
        Assert.Equal("1", Tile(oorsig!, "Betaalde bestellings"));
        Assert.Equal("2", Tile(oorsig!, "Inskrywings"));
        Assert.Equal("R 75,00", Tile(oorsig!, "Donasies"));
        Assert.Contains(oorsig!.Blocks, b => b.Svg?.StartsWith("<svg") == true);

        var inskrywings = await client.GetFromJsonAsync<ReportShape>("/api/admin/reports/inskrywings?routeCode=ligtrap");
        Assert.Equal("2", Tile(inskrywings!, "Inskrywings"));
        var none = await client.GetFromJsonAsync<ReportShape>("/api/admin/reports/inskrywings?routeCode=vasbyt");
        Assert.Equal("0", Tile(none!, "Inskrywings"));

        var produkte = await client.GetFromJsonAsync<ReportShape>($"/api/admin/reports/produkte");
        Assert.Equal("R 75,00", Tile(produkte!, "Produkverkope"));
        var payers = produkte!.Blocks.Single(b => b.Title == "Besteding per betaler").Table!;
        Assert.Equal(["Koper Toetser", "koper@voorbeeld.co.za", "1", "3", "R 75,00"], payers.Rows.Single());

        var future = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)).ToString("yyyy-MM-dd");
        var later = await client.GetFromJsonAsync<ReportShape>($"/api/admin/reports/oorsig?from={future}");
        Assert.Equal("0", Tile(later!, "Betaalde bestellings"));

        foreach (var name in new[] { "oorsig", "inskrywings", "produkte" })
        {
            var pdf = await client.GetAsync($"/api/admin/reports/{name}.pdf");
            Assert.Equal(HttpStatusCode.OK, pdf.StatusCode);
            Assert.Equal("application/pdf", pdf.Content.Headers.ContentType?.MediaType);
            Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(await pdf.Content.ReadAsByteArrayAsync(), 0, 4));
        }
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/admin/reports/onbekend")).StatusCode);
    }

    [Fact]
    public async Task Reports_are_refused_without_the_admin_role()
    {
        var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/reports/oorsig")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/reports/oorsig.pdf")).StatusCode);
    }

    private static string Tile(ReportShape r, string label) => r.Tiles.Single(t => t.Label == label).Value;

    private async Task<int> NewVariant()
    {
        _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var product = new Product { Name = "Pet", Variants = [new ProductVariant { Label = "Blou", PriceZar = 25m }] };
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product.Variants[0].Id;
    }

    private record OrderShape(Guid Token);
    private record ReportShape(TileShape[] Tiles, BlockShape[] Blocks);
    private record TileShape(string Label, string Value);
    private record BlockShape(string Title, string? Svg, TableShape? Table);
    private record TableShape(string[] Headers, string[][] Rows);
}

public class ReportChartTests
{
    [Theory]
    [InlineData(0, 4)]
    [InlineData(3, 4)]
    [InlineData(7, 8)]
    [InlineData(9, 12)]
    [InlineData(4520, 6000)]
    [InlineData(13980, 16000)]
    public void Axis_top_is_four_whole_round_steps(double max, double top)
    {
        Assert.Equal(top, Vasbyt.API.Services.ReportCharts.Nice(max));
        Assert.Equal(0, top / 4 % 1);
    }
}
