using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

/// Oorsig, Inskrywings and Produkte: JSON for the admin screen and the same report as a PDF.
public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/admin/reports").WithTags("Admin").RequireAuthorization(Roles.Admin);

        g.MapGet("/{name}", async (string name, [AsParameters] ReportFilter f, VasbytDbContext db) =>
            Reports.Build(name, db, f) is { } build ? Results.Ok(await build) : Results.NotFound());

        g.MapGet("/{name}.pdf", async (string name, [AsParameters] ReportFilter f, VasbytDbContext db,
            UserManager<AppUser> users, ClaimsPrincipal principal, IWebHostEnvironment env, IConfiguration cfg) =>
        {
            if (Reports.Build(name, db, f) is not { } build) return Results.NotFound();
            var report = await build;
            var logo = env.WebRootPath is { } web ? Path.Combine(web, "merk", "vasbyt-logo.png") : null;
            var pdf = ReportPdf.Render(report, await ReportPdf.ExportedByAsync(users, principal), logo,
                MediaStore.Root(cfg, env));
            return Results.File(pdf, "application/pdf", $"{name}-{OrderEndpoints.EventYear}.pdf");
        });
    }
}
