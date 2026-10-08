using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

public record RegisterRequest(string Email, string Password, string FirstName, string LastName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string Password);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth").WithTags("Auth");
        g.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });

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

        g.MapPost("/forgot-password", async (ForgotPasswordRequest req, UserManager<AppUser> users,
            IEmailSender<AppUser> sender, IConfiguration cfg) =>
        {
            if (!ResendEmailSender.IsAvailable(cfg))
                return Results.Problem("Wagwoordherstel is tans nie beskikbaar nie. Kontak die organiseerders.",
                    statusCode: 503);
            if (!string.IsNullOrWhiteSpace(req.Email) && await users.FindByEmailAsync(req.Email.Trim()) is { } user)
            {
                var token = await users.GeneratePasswordResetTokenAsync(user);
                var root = new Uri(cfg["Public:BaseUrl"]!);
                var link = new Uri(root, $"/herstel-wagwoord?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(token)}");
                try { await sender.SendPasswordResetLinkAsync(user, user.Email!, link.AbsoluteUri); }
                catch (Exception e) when (e is HttpRequestException or TaskCanceledException or InvalidOperationException)
                {
                    return Results.Problem("Wagwoordherstel kon nie afgelewer word nie. Probeer later weer.", statusCode: 503);
                }
            }
            return Results.Ok(new { message = "As die rekening bestaan, is 'n herstelskakel gestuur." });
        }).AllowAnonymous();

        g.MapPost("/reset-password", async (ResetPasswordRequest req, UserManager<AppUser> users) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Token) ||
                string.IsNullOrWhiteSpace(req.Password))
                return Results.Problem("E-pos, kode en nuwe wagwoord word vereis.", statusCode: 400);
            var user = await users.FindByEmailAsync(req.Email.Trim());
            if (user is null) return Results.Problem("Ongeldige of vervalde herstelskakel.", statusCode: 400);
            var result = await users.ResetPasswordAsync(user, req.Token, req.Password);
            return result.Succeeded ? Results.Ok(new { message = "Wagwoord is verander." })
                : Results.Problem("Ongeldige of vervalde herstelskakel of wagwoord.", statusCode: 400);
        }).AllowAnonymous();
    }

    private static async Task<object> Me(AppUser user, UserManager<AppUser> users) => new
    {
        user.Id, user.Email, user.FirstName, user.LastName,
        roles = await users.GetRolesAsync(user),
    };
}
