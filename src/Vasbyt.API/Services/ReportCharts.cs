using System.Globalization;
using System.Security;
using System.Text;

namespace Vasbyt.API.Services;

/// Report charts as SVG strings. Drawn once here so the browser view and the PDF show the same picture.
public static class ReportCharts
{
    public const string Indigo = "#2c3991", IndigoDeep = "#1d1e58", Orange = "#f1531c", River = "#2f6f73",
        Willow = "#7f9a5a", Reed = "#c9b98f", Clay = "#a86a4a", Ink = "#1c1b19", Muted = "#55514b", Rule = "#e6ded1";

    /// Same hues as the --ev-* tokens in _tokens.scss.
    public static readonly Dictionary<string, string> Category = new()
    {
        ["ligtrap"] = "#3e8e8a", ["vastrap"] = "#1f5f63", ["ligstap"] = "#7f9a5a",
        ["vasstap"] = "#4f6b3a", ["ligdraf"] = "#c98a3a", ["vasbyt"] = "#a8502e",
    };

    public record Series(string Name, string Color, double[] Values);
    public record Item(string Label, double Value, string Color);

    private const int W = 720, Left = 56, Right = 16, Top = 14;
    private const string Font = "font-family=\"Lato, Helvetica, Arial, sans-serif\"";
    public static readonly NumberFormatInfo Num = new() { NumberGroupSeparator = " ", NumberDecimalSeparator = "," };

    public static string Count(double v) => v.ToString("#,0", Num);
    public static string Rand(double v) => "R" + v.ToString("#,0", Num);

    /// Vertical bars. More than one series stacks them and draws a legend; one series labels each bar.
    public static string Bars(IReadOnlyList<string> labels, IReadOnlyList<Series> series, Func<double, string>? fmt = null, int height = 260)
    {
        fmt ??= Count;
        var n = labels.Count;
        var totals = Enumerable.Range(0, n).Select(i => series.Sum(s => s.Values[i])).ToArray();
        var max = Nice(totals.DefaultIfEmpty(0).Max());
        var bottom = series.Count > 1 ? 52 : 34;
        var plotH = height - Top - bottom;
        var sb = Open(height);
        Grid(sb, max, fmt, height - bottom, plotH);

        var slot = (W - Left - Right) / (double)Math.Max(n, 1);
        var bw = Math.Max(1, Math.Min(slot * 0.72, 56));
        var every = Math.Max(1, (int)Math.Ceiling(n / 12.0));
        for (var i = 0; i < n; i++)
        {
            var x = Left + slot * i + (slot - bw) / 2;
            var y = (double)(height - bottom);
            foreach (var s in series)
            {
                var h = s.Values[i] / max * plotH;
                if (h <= 0) continue;
                y -= h;
                sb.Append($"<rect x=\"{F(x)}\" y=\"{F(y)}\" width=\"{F(bw)}\" height=\"{F(h)}\" fill=\"{s.Color}\"/>");
            }
            if (series.Count == 1 && n <= 16 && totals[i] > 0)
                Text(sb, x + bw / 2, y - 4, fmt(totals[i]), "middle", 10, Ink);
            if (i % every == 0)
                Text(sb, x + bw / 2, height - bottom + 14, labels[i], "middle", 10, Muted);
        }
        if (series.Count > 1) Legend(sb, series.Select(s => (s.Name, s.Color)), height - 12);
        return Close(sb);
    }

    /// Horizontal bars with the label on the left, for long names like towns and categories.
    public static string HBars(IReadOnlyList<Item> items, Func<double, string>? fmt = null)
    {
        fmt ??= Count;
        const int row = 24, labelW = 170;
        var height = Math.Max(1, items.Count) * row + 8;
        var max = Math.Max(items.Select(i => i.Value).DefaultIfEmpty(0).Max(), 1);
        var span = W - labelW - 70;
        var sb = Open(height);
        for (var i = 0; i < items.Count; i++)
        {
            var y = 4 + i * row;
            var w = Math.Max(items[i].Value / max * span, items[i].Value > 0 ? 2 : 0);
            Text(sb, labelW - 8, y + 16, items[i].Label.Length > 26 ? items[i].Label[..25].TrimEnd() + "…" : items[i].Label, "end", 11, Ink);
            sb.Append($"<rect x=\"{labelW}\" y=\"{y + 4}\" width=\"{F(w)}\" height=\"{row - 8}\" fill=\"{items[i].Color}\"/>");
            Text(sb, labelW + w + 6, y + 16, fmt(items[i].Value), "start", 11, Ink);
        }
        return Close(sb);
    }

    /// A line with a soft fill under it, for running totals over time.
    public static string Line(IReadOnlyList<string> labels, double[] values, string color, Func<double, string>? fmt = null, int height = 220)
    {
        fmt ??= Count;
        const int bottom = 34;
        var n = labels.Count;
        var max = Nice(values.DefaultIfEmpty(0).Max());
        var plotH = height - Top - bottom;
        var sb = Open(height);
        Grid(sb, max, fmt, height - bottom, plotH);
        if (n == 0) return Close(sb);

        var step = n > 1 ? (W - Left - Right) / (double)(n - 1) : 0;
        double X(int i) => n > 1 ? Left + step * i : Left + (W - Left - Right) / 2.0;
        double Y(int i) => height - bottom - values[i] / max * plotH;
        var points = string.Join(" ", Enumerable.Range(0, n).Select(i => $"{F(X(i))},{F(Y(i))}"));
        sb.Append($"<polygon points=\"{F(X(0))},{height - bottom} {points} {F(X(n - 1))},{height - bottom}\" fill=\"{color}\" fill-opacity=\"0.14\"/>");
        sb.Append($"<polyline points=\"{points}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/>");
        if (n <= 31)
            for (var i = 0; i < n; i++) sb.Append($"<circle cx=\"{F(X(i))}\" cy=\"{F(Y(i))}\" r=\"3\" fill=\"{color}\"/>");
        Text(sb, X(n - 1), Y(n - 1) - 8, fmt(values[n - 1]), n > 1 ? "end" : "middle", 11, Ink);

        var every = Math.Max(1, (int)Math.Ceiling(n / 10.0));
        for (var i = 0; i < n; i += every) Text(sb, X(i), height - bottom + 14, labels[i], "middle", 10, Muted);
        return Close(sb);
    }

    /// Axis top as four even steps, each a round number; whole steps only, so counts never read "2,5".
    public static double Nice(double max)
    {
        var raw = max / 4;
        if (raw <= 1) return 4;
        var mag = Math.Pow(10, Math.Floor(Math.Log10(raw)));
        double[] steps = mag >= 10 ? [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] : [1, 2, 3, 4, 5, 6, 8, 10];
        return steps.First(m => m * mag >= raw) * mag * 4;
    }

    private static void Grid(StringBuilder sb, double max, Func<double, string> fmt, int baseY, int plotH)
    {
        for (var k = 0; k <= 4; k++)
        {
            var y = baseY - plotH * k / 4.0;
            // A rect, not a <line>: QuestPDF draws a dark dot at the end of an SVG line.
            sb.Append($"<rect x=\"{Left}\" y=\"{F(y - 0.5)}\" width=\"{W - Left - Right}\" height=\"1\" fill=\"{Rule}\"/>");
            Text(sb, Left - 6, y + 4, fmt(max * k / 4), "end", 10, Muted);
        }
    }

    private static void Legend(StringBuilder sb, IEnumerable<(string Name, string Color)> keys, int y)
    {
        var x = (double)Left;
        foreach (var (name, color) in keys)
        {
            sb.Append($"<rect x=\"{F(x)}\" y=\"{y - 9}\" width=\"10\" height=\"10\" fill=\"{color}\"/>");
            Text(sb, x + 14, y, name, "start", 11, Ink);
            x += 28 + name.Length * 6.5;
        }
    }

    private static StringBuilder Open(int height) =>
        new($"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {W} {height}\" width=\"{W}\" height=\"{height}\" {Font}>");

    private static string Close(StringBuilder sb) => sb.Append("</svg>").ToString();

    private static void Text(StringBuilder sb, double x, double y, string text, string anchor, int size, string color) =>
        sb.Append($"<text x=\"{F(x)}\" y=\"{F(y)}\" text-anchor=\"{anchor}\" font-size=\"{size}\" fill=\"{color}\">{SecurityElement.Escape(text)}</text>");

    private static string F(double v) => v.ToString("0.#", CultureInfo.InvariantCulture);
}
