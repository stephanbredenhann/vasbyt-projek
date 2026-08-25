using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Endpoints;

public record RegisterRequest(string Email, string Password, string FirstName, string LastName);
public record LoginRequest(string Email, string Password);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth").WithTags("Auth");

        // Standalone registration exists for staff and for people who already entered; the paid-first
        // rule lives on the order, not here — an account with no order is harmless.
        g.MapPost("/register", async (RegisterRequest req, UserManager<AppUser> users,
            SignInManager<AppUser> signIn) =>
        {
            var user = new AppUser
            {
                UserName = req.Email, Email = req.Email,
                FirstName = req.FirstName, LastName = req.LastName,
            };
            var result = await users.CreateAsync(user, req.Password);
            if (!result.Succeeded)
                return Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description)),
                    statusCode: 400);
            await users.AddToRoleAsync(user, Roles.Participant);
            await signIn.SignInAsync(user, isPersistent: true);
            return Results.Ok(await Me(user, users));
        }).AllowAnonymous();

        g.MapPost("/login", async (LoginRequest req, UserManager<AppUser> users,
            SignInManager<AppUser> signIn) =>
        {
            var user = await users.FindByEmailAsync(req.Email);
            if (user is null) return Results.Problem("Verkeerde e-pos of wagwoord.", statusCode: 401);

            var result = await signIn.PasswordSignInAsync(user, req.Password,
                isPersistent: true, lockoutOnFailure: true);
            if (result.IsLockedOut)
                return Results.Problem("Rekening tydelik gesluit. Probeer later weer.", statusCode: 423);
            if (!result.Succeeded) return Results.Problem("Verkeerde e-pos of wagwoord.", statusCode: 401);

            return Results.Ok(await Me(user, users));
        }).AllowAnonymous();

        g.MapPost("/logout", async (SignInManager<AppUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).AllowAnonymous();

        g.MapGet("/me", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            return user is null ? Results.Unauthorized() : Results.Ok(await Me(user, users));
        }).AllowAnonymous();
    }

    private static async Task<object> Me(AppUser user, UserManager<AppUser> users) => new
    {
        user.Id, user.Email, user.FirstName, user.LastName,
        roles = await users.GetRolesAsync(user),
    };
}
