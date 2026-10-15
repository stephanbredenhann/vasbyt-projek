using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

public record AuditChange(string Entity, string Key, string State, Dictionary<string, object?[]> Fields);

/// The admin behind this request and what their SaveChanges calls wrote. Empty outside /api/admin.
public class AuditScope
{
    public string? ActorEmail { get; set; }
    public List<AuditChange> Changes { get; } = [];
    internal List<(EntityEntry Entry, string State, Dictionary<string, object?[]> Fields)> Pending { get; } = [];
}

/// Records old and new values of every row an admin request changes. ExecuteUpdate bypasses it.
public class AuditInterceptor(AuditScope scope) : SaveChangesInterceptor
{
    // POPIA and credentials: the log shows that these changed, never what they say.
    static readonly HashSet<string> Masked = ["IdNumber", "MedicalConditions", "Medication", "MedicalFund",
        "MedicalFundNumber", "Draft", "PasswordHash", "SecurityStamp", "ConcurrencyStamp"];

    public override InterceptionResult<int> SavingChanges(DbContextEventData e, InterceptionResult<int> result)
    {
        Capture(e.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e,
        InterceptionResult<int> result, CancellationToken ct = default)
    {
        Capture(e.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData e, int result)
    {
        Commit();
        return result;
    }

    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData e, int result,
        CancellationToken ct = default)
    {
        Commit();
        return ValueTask.FromResult(result);
    }

    public override void SaveChangesFailed(DbContextErrorEventData e) => scope.Pending.Clear();

    public override Task SaveChangesFailedAsync(DbContextErrorEventData e, CancellationToken ct = default)
    {
        scope.Pending.Clear();
        return Task.CompletedTask;
    }

    void Capture(DbContext? db)
    {
        if (scope.ActorEmail is null || db is null) return;
        scope.Pending.Clear();
        foreach (var entry in db.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;
            var fields = new Dictionary<string, object?[]>();
            foreach (var p in entry.Properties)
            {
                var name = p.Metadata.Name;
                object? before = entry.State == EntityState.Added ? null : p.OriginalValue;
                object? after = entry.State == EntityState.Deleted ? null : p.CurrentValue;
                if (entry.State == EntityState.Modified && (!p.IsModified || Equals(before, after))) continue;
                if (p.Metadata.IsPrimaryKey()) continue;
                fields[name] = Masked.Contains(name)
                    ? [before is null ? null : "***", after is null ? null : "***"]
                    : [before, after];
            }
            if (fields.Count > 0) scope.Pending.Add((entry, entry.State.ToString(), fields));
        }
    }

    // Keys are read after the save so new rows show their generated id.
    void Commit()
    {
        foreach (var (entry, state, fields) in scope.Pending)
        {
            var key = string.Join(",", entry.Metadata.FindPrimaryKey()!.Properties
                .Select(p => entry.Property(p.Name).CurrentValue));
            scope.Changes.Add(new AuditChange(entry.Metadata.ClrType.Name.Split('`')[0], key, state, fields));
        }
        scope.Pending.Clear();
    }
}

public static class Audit
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    /// GETs that read ID numbers, medical fields or the whole database. Spec 11.
    static bool SensitiveRead(PathString path) =>
        path.StartsWithSegments("/api/admin/entrants") ||
        (path.StartsWithSegments("/api/admin/backups", out var rest) && rest.HasValue && rest != "/");

    /// One row per admin write or sensitive read, written from a fresh scope so a failed request cannot lose it.
    public static async Task Middleware(HttpContext ctx, RequestDelegate next)
    {
        if (!ctx.Request.Path.StartsWithSegments("/api/admin") || !ctx.User.IsInRole(Roles.Admin))
        {
            await next(ctx);
            return;
        }
        var scope = ctx.RequestServices.GetRequiredService<AuditScope>();
        scope.ActorEmail = ctx.User.FindFirstValue(ClaimTypes.Email) ?? ctx.User.Identity?.Name ?? "?";
        var record = !HttpMethods.IsGet(ctx.Request.Method) || SensitiveRead(ctx.Request.Path);
        var status = 500;
        try
        {
            await next(ctx);
            status = ctx.Response.StatusCode;
        }
        finally
        {
            if (record)
            {
                try
                {
                    using var fresh = ctx.RequestServices.GetRequiredService<IServiceScopeFactory>().CreateScope();
                    var db = fresh.ServiceProvider.GetRequiredService<VasbytDbContext>();
                    db.AuditEntries.Add(new AuditEntry
                    {
                        ActorEmail = scope.ActorEmail,
                        Method = ctx.Request.Method,
                        Path = ctx.Request.Path + ctx.Request.QueryString,
                        StatusCode = status,
                        Changes = JsonSerializer.Serialize(scope.Changes, Json),
                    });
                    await db.SaveChangesAsync();
                }
                catch (Exception e)
                {
                    ctx.RequestServices.GetRequiredService<ILogger<AuditScope>>().LogError(e, "Audit row lost");
                }
            }
        }
    }
}
