using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

public static class PassEndpoints
{
    public static void MapPassEndpoints(this IEndpointRouteBuilder app)
    {
        // Resends the QR pass to the entrant and the buyer, bypassing the idempotency key.
        app.MapPost("/api/admin/entrants/{id:int}/resend-pass", async (int id, VasbytDbContext db, PassEmail pass) =>
        {
            var entrant = await db.Entrants.FindAsync(id);
            if (entrant is null) return Results.NotFound();
            if (!entrant.IsComplete)
                return Results.Problem("Die deelnemer se vorm is nog nie voltooi nie.", statusCode: 409);
            var sent = await pass.SendAsync(id, force: true, maxAttempts: 1);
            return sent == 0 ? Results.Problem("Die e-pos kon nie gestuur word nie.", statusCode: 502) : Results.Ok(new { sent });
        }).RequireAuthorization(Roles.Admin);
    }
}
