using System.Diagnostics;
using Npgsql;

namespace Vasbyt.API.Services;

/// pg_dump into Backups:Root, a Docker volume in production: nightly at 02:00 SAST and on demand, newest 14 kept.
public class Backups(IConfiguration cfg, IHostEnvironment env, ILogger<Backups> log) : BackgroundService
{
    public const int Keep = 14;
    readonly SemaphoreSlim _one = new(1, 1);

    public string Root => Path.GetFullPath(cfg["Backups:Root"] is { Length: > 0 } configured
        ? configured
        : Path.Combine(env.ContentRootPath, "backups"));

    /// Newest first. The timestamp in the name sorts as text; a .tmp still being written never matches.
    public FileInfo[] List() => Directory.Exists(Root)
        ? new DirectoryInfo(Root).GetFiles("vasbyt-*.dump").OrderByDescending(f => f.Name, StringComparer.Ordinal).ToArray()
        : [];

    public async Task<FileInfo> CreateAsync(CancellationToken ct = default)
    {
        await _one.WaitAsync(ct);
        try
        {
            Directory.CreateDirectory(Root);
            var cs = new NpgsqlConnectionStringBuilder(cfg.GetConnectionString("Default"));
            var path = Path.Combine(Root, $"vasbyt-{DateTime.UtcNow:yyyyMMdd-HHmmss}.dump");
            var tmp = path + ".tmp";
            // -Fc is compressed and restores with pg_restore. The password goes in the environment, never on the command line.
            var psi = new ProcessStartInfo("pg_dump")
            {
                ArgumentList = { "-Fc", "-h", cs.Host!, "-p", cs.Port.ToString(), "-U", cs.Username!, "-d", cs.Database!, "-f", tmp },
                RedirectStandardError = true,
                Environment = { ["PGPASSWORD"] = cs.Password },
            };
            using var p = Process.Start(psi)!;
            var err = await p.StandardError.ReadToEndAsync(ct);
            await p.WaitForExitAsync(ct);
            if (p.ExitCode != 0)
            {
                File.Delete(tmp);
                throw new InvalidOperationException($"pg_dump exited {p.ExitCode}: {err}");
            }
            File.Move(tmp, path, overwrite: true);
            foreach (var old in List().Skip(Keep)) old.Delete();
            return new FileInfo(path);
        }
        finally { _one.Release(); }
    }

    /// The hour from 00:00 UTC is 02:00 to 03:00 SAST, which has no daylight saving. Once per night.
    public static bool Due(DateTime utcNow, string? newest) =>
        utcNow.Hour == 0 && (newest is null || string.CompareOrdinal(newest, $"vasbyt-{utcNow:yyyyMMdd}") < 0);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(20));
        do
        {
            try
            {
                if (Due(DateTime.UtcNow, List().FirstOrDefault()?.Name))
                    log.LogInformation("Nightly backup written to {Path}", (await CreateAsync(stop)).FullName);
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Nightly backup failed"); }
        } while (await timer.WaitForNextTickAsync(stop));
    }
}
