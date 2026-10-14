using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;
using static Vasbyt.API.Services.ReportCharts;

namespace Vasbyt.API.Services;

/// Lays a Report out as a branded A4 PDF: logo header, tinted tiles, the same SVG charts the browser shows.
public static class ReportPdf
{
    private const string Sand = "#f4efe7";
    private const float ContentWidth = 595 - 2 * 32;

    /// The admin's name for the "Uitgevoer deur" footer, falling back to their email.
    public static async Task<string> ExportedByAsync(UserManager<AppUser> users, ClaimsPrincipal principal)
    {
        var me = await users.GetUserAsync(principal);
        return $"{me?.FirstName} {me?.LastName}".Trim() is { Length: > 0 } n ? n
            : me?.Email ?? principal.FindFirstValue(ClaimTypes.Email) ?? "";
    }

    public static byte[] Render(Report report, string exportedBy, string? logoPath, string mediaRoot)
    {
        var logo = logoPath is not null && File.Exists(logoPath) ? File.ReadAllBytes(logoPath) : null;
        var exportedAt = DateTime.UtcNow.AddHours(2);

        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(32);
            page.DefaultTextStyle(t => t.FontSize(9).FontColor(Ink));

            page.Header().Column(h =>
            {
                h.Item().Row(r =>
                {
                    if (logo is not null) r.ConstantItem(64).Height(50).Image(logo).FitArea();
                    r.RelativeItem().PaddingLeft(logo is null ? 0 : 12).AlignMiddle().Column(c =>
                    {
                        c.Item().Text($"ORANIA HELPMEKAAR VASBYT {OrderEndpoints.EventYear}").FontSize(8).SemiBold().FontColor(Orange).LetterSpacing(0.08f);
                        c.Item().Text(report.Title).FontSize(22).Bold().FontColor(IndigoDeep);
                        c.Item().Text(report.Filter).FontColor(Muted);
                    });
                });
                h.Item().PaddingTop(10).LineHorizontal(1.5f).LineColor(Orange);
            });

            page.Content().PaddingTop(14).Column(col =>
            {
                col.Spacing(16);
                foreach (var row in report.Tiles.Chunk(4)) col.Item().Row(r =>
                {
                    r.Spacing(8);
                    foreach (var t in row) r.RelativeItem().Background(Sand).Padding(10).Column(c =>
                    {
                        c.Item().Text(t.Label.ToUpperInvariant()).FontSize(7).SemiBold().FontColor(Muted);
                        c.Item().PaddingTop(2).Text(t.Value).FontSize(14).Bold().FontColor(IndigoDeep);
                    });
                    for (var i = row.Length; i < 4; i++) r.RelativeItem();
                });

                // Keep a block's title with its chart, and a short table in one piece.
                foreach (var b in report.Blocks) col.Item().EnsureSpace(Math.Min(Needs(b), 600)).Column(c =>
                {
                    c.Spacing(6);
                    c.Item().Text(b.Title).FontSize(12).Bold().FontColor(Indigo);
                    // GetFileName: the stored name came from an admin request, so never let it walk out of the media root.
                    var image = b.Image is null ? null : Path.Combine(mediaRoot, Path.GetFileName(b.Image));
                    var pictured = image is not null && File.Exists(image);
                    if (pictured) c.Item().Row(r =>
                    {
                        r.ConstantItem(110).Height(110).Background(Sand).Padding(4).Image(image!).FitArea();
                        r.RelativeItem().PaddingLeft(12).Element(e => { if (b.Table is not null) Table(e, b.Table); });
                    });
                    // A fixed height moves the chart to the next page when it does not fit; FitArea keeps it inside that box.
                    if (b.Svg is not null) c.Item().Height(ContentWidth / Aspect(b.Svg)).Svg(SvgImage.FromText(b.Svg)).FitArea();
                    if (b.Table is not null && !pictured) Table(c.Item(), b.Table);
                });
            });

            page.Footer().PaddingTop(8).Row(r =>
            {
                r.RelativeItem().Text($"Uitgevoer deur {exportedBy} op {exportedAt:yyyy-MM-dd HH:mm}").FontColor(Muted);
                r.AutoItem().Text(t => { t.CurrentPageNumber(); t.Span(" / "); t.TotalPages(); });
            });
        })).GeneratePdf();
    }

    /// Rough height of a block, so a product's picture, table and chart stay on one page.
    private static int Needs(Block b) =>
        30 + (b.Svg is null ? 0 : (int)(ContentWidth / Aspect(b.Svg)))
        + (b.Table is null || (b.Svg is not null && b.Image is null) ? 0 : 20 + (b.Table.Rows.Count + 2) * 16);

    /// Width over height from the chart's viewBox.
    private static float Aspect(string svg)
    {
        var box = System.Text.RegularExpressions.Regex.Match(svg, "viewBox=\"0 0 ([0-9.]+) ([0-9.]+)\"");
        return float.Parse(box.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture)
            / float.Parse(box.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static void Table(IContainer container, ReportTable table) => container.Table(t =>
    {
        t.ColumnsDefinition(c =>
        {
            for (var i = 0; i < table.Headers.Length; i++) c.RelativeColumn(i >= table.TextColumns ? 1 : table.TextColumns > 1 ? 3 : 2.2f);
        });
        t.Header(h =>
        {
            for (var i = 0; i < table.Headers.Length; i++)
                Cell(h.Cell().Background(IndigoDeep), i < table.TextColumns, table.Headers[i], c => c.SemiBold().FontColor(Colors.White));
        });
        for (var r = 0; r < table.Rows.Count; r++)
            for (var i = 0; i < table.Rows[r].Length; i++)
                Cell(t.Cell().Background(r % 2 == 1 ? Sand : Colors.White), i < table.TextColumns, table.Rows[r][i]);
        if (table.Footer is not null)
            for (var i = 0; i < table.Footer.Length; i++)
                Cell(t.Cell().BorderTop(1).BorderColor(IndigoDeep), i < table.TextColumns, table.Footer[i], c => c.Bold());
    });

    private static void Cell(IContainer cell, bool text, string value, Func<TextSpanDescriptor, TextSpanDescriptor>? style = null)
    {
        var aligned = cell.PaddingVertical(3).PaddingHorizontal(5);
        aligned = text ? aligned.AlignLeft() : aligned.AlignRight();
        var span = aligned.Text(value);
        style?.Invoke(span);
    }
}
