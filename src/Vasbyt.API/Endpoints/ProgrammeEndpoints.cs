using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record ProgrammeEntryBody(TimeOnly TimeLocal, string TitleAf, string TitleEn,
    string? DetailAf, string? DetailEn);
public record ProgrammeDayBody(int DayNumber, DateOnly DateLocal, string TitleAf, string TitleEn,
    string? NoteAf, string? NoteEn, ProgrammeEntryBody[] Entries);

public static class ProgrammeEndpoints
{
    public static void MapProgrammeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/programme", async (VasbytDbContext db) =>
            Results.Ok(await Read(db))).AllowAnonymous();

        app.MapPut("/api/admin/programme", async (ProgrammeDayBody[]? request, VasbytDbContext db) =>
        {
            if (Invalid(request) is { } problem)
                return Results.Problem(problem, statusCode: 400);

            var days = await db.ProgrammeDays.Include(d => d.Entries).ToListAsync();
            foreach (var body in request!.OrderBy(d => d.DayNumber))
            {
                var day = days.SingleOrDefault(d => d.DayNumber == body.DayNumber);
                if (day is null)
                {
                    day = new ProgrammeDay { DayNumber = body.DayNumber };
                    db.ProgrammeDays.Add(day);
                }
                day.DateLocal = body.DateLocal;
                day.TitleAf = body.TitleAf.Trim();
                day.TitleEn = body.TitleEn.Trim();
                day.NoteAf = body.NoteAf?.Trim() ?? "";
                day.NoteEn = body.NoteEn?.Trim() ?? "";
                day.Entries.Clear();
                day.Entries.AddRange(body.Entries.Select((e, index) => new ProgrammeEntry
                {
                    TimeLocal = e.TimeLocal, TitleAf = e.TitleAf.Trim(), TitleEn = e.TitleEn.Trim(),
                    DetailAf = e.DetailAf?.Trim() ?? "", DetailEn = e.DetailEn?.Trim() ?? "",
                    SortOrder = index,
                }));
            }
            await db.SaveChangesAsync();
            return Results.Ok(await Read(db));
        }).RequireAuthorization(Roles.Admin);
    }

    private static async Task<ProgrammeDayBody[]> Read(VasbytDbContext db) =>
        (await db.ProgrammeDays.Include(d => d.Entries).AsNoTracking().OrderBy(d => d.DayNumber)
            .ToListAsync()).Select(d => new ProgrammeDayBody(d.DayNumber, d.DateLocal, d.TitleAf,
                d.TitleEn, d.NoteAf, d.NoteEn, d.Entries.OrderBy(e => e.SortOrder)
                    .Select(e => new ProgrammeEntryBody(e.TimeLocal, e.TitleAf, e.TitleEn,
                        e.DetailAf, e.DetailEn)).ToArray())).ToArray();

    private static string? Invalid(ProgrammeDayBody[]? days)
    {
        if (days is null || days.Length != 3 || days.Any(d => d is null)
            || !days.Select(d => d.DayNumber).Order().SequenceEqual(new[] { 1, 2, 3 }))
            return "Die program moet dag 1, 2 en 3 elk een keer bevat.";
        var ordered = days.OrderBy(d => d.DayNumber).ToArray();
        if (ordered[0].DateLocal >= ordered[1].DateLocal || ordered[1].DateLocal >= ordered[2].DateLocal)
            return "Die programdatums moet in volgorde wees.";
        foreach (var day in days)
        {
            if (!Title(day.TitleAf) || !Title(day.TitleEn))
                return "Elke dag benodig 'n Afrikaanse en Engelse opskrif van hoogstens 160 karakters.";
            if (day.NoteAf?.Length > 1000 || day.NoteEn?.Length > 1000)
                return "Notas mag hoogstens 1000 karakters bevat.";
            if (day.Entries is null || day.Entries.Length is < 1 or > 40)
                return "Elke dag benodig tussen 1 en 40 aktiwiteite.";
            if (day.Entries.Any(e => e is null || !Title(e.TitleAf) || !Title(e.TitleEn)
                || e.DetailAf?.Length > 1000 || e.DetailEn?.Length > 1000))
                return "Elke aktiwiteit benodig twee opskrifte, en beskrywings mag hoogstens 1000 karakters bevat.";
        }
        return null;
    }

    private static bool Title(string? title) => !string.IsNullOrWhiteSpace(title) && title.Length <= 160;
}
