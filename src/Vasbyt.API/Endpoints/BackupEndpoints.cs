using System.ComponentModel;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

public static class BackupEndpoints
{
    public static void MapBackupEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/admin/backups").WithTags("Admin").RequireAuthorization(Roles.Admin);

        g.MapGet("/", (Backups backups) => backups.List().Select(Row));

        g.MapPost("/", async (Backups backups, ILogger<Backups> log) =>
        {
            try { return Results.Ok(Row(await backups.CreateAsync())); }
            catch (Exception e) when (e is Win32Exception or InvalidOperationException or IOException)
            {
                log.LogError(e, "Backup on demand failed");
                return Results.Problem("Die rugsteun kon nie gemaak word nie.", statusCode: 503);
            }
        });

        // Only a name that is in the listing, so no path ever reaches the disk from the URL.
        g.MapGet("/{name}", (string name, Backups backups) =>
            backups.List().FirstOrDefault(f => f.Name == name) is { } file
                ? Results.File(file.FullName, "application/octet-stream", file.Name)
                : Results.NotFound());
    }

    static object Row(FileInfo f) => new { f.Name, SizeBytes = f.Length, CreatedUtc = f.LastWriteTimeUtc };
}
