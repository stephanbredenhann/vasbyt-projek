using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Endpoints;

/// Invite is the token from an admin invite email; a valid one makes the new account an admin.
/// Claim is the token from an order's "create your account" link; a valid one proves the email.
public record RegisterRequest(string Email, string Password, string FirstName, string LastName, string? Invite = null, string? Claim = null);
public record LoginRequest(string Email, string Password, string? Claim = null);
public record CodeRequest(string Email, string? Code = null);
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
            SignInManager<AppUser> signIn, AdminInvite invite, AccountClaim claim, VasbytDbContext db) =>
        {
            if (!string.IsNullOrEmpty(req.Invite) && !invite.Matches(req.Invite, req.Email ?? ""))
                return RegistrationProblem("Die uitnodiging is ongeldig of het verval. Vra vir 'n nuwe een.", "registration.invitation_invalid");
            if (!string.IsNullOrEmpty(req.Claim) && !claim.Matches(req.Claim, req.Email ?? ""))
                return RegistrationProblem("Die skakel is ongeldig of het verval. Vra 'n nuwe een op jou bestelling.", "registration.claim_invalid");
            var user = new AppUser
            {
                UserName = req.Email, Email = req.Email,
                FirstName = req.FirstName, LastName = req.LastName,
            };
            var result = await users.CreateAsync(user, req.Password);
            if (!result.Succeeded)
            {
                var code = result.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName") ? "registration.email_duplicate"
                    : result.Errors.Any(e => e.Code == "InvalidEmail") ? "registration.email_invalid"
                    : result.Errors.Any(e => e.Code.StartsWith("Password", StringComparison.Ordinal)) ? "registration.password_requirements"
                    : "registration.failed";
                return RegistrationProblem(string.Join(" ", result.Errors.Select(e => e.Description)), code);
            }
            await users.AddToRoleAsync(user, Roles.Participant);
            if (!string.IsNullOrEmpty(req.Invite)) await users.AddToRoleAsync(user, Roles.Admin);
            if (!string.IsNullOrEmpty(req.Claim)) await ProveEmail(user, users, db);
            await signIn.SignInAsync(user, isPersistent: true);
            return Results.Ok(await Me(user, users));
        }).AllowAnonymous();

        g.MapPost("/login", async (LoginRequest req, UserManager<AppUser> users,
            SignInManager<AppUser> signIn, AccountClaim claim, VasbytDbContext db) =>
        {
            var user = await users.FindByEmailAsync(req.Email);
            if (user is null) return Results.Problem("Verkeerde e-pos of wagwoord.", statusCode: 401);

            var result = await signIn.PasswordSignInAsync(user, req.Password,
                isPersistent: true, lockoutOnFailure: true);
            if (result.IsLockedOut)
                return Results.Problem("Rekening tydelik gesluit. Probeer later weer.", statusCode: 423);
            if (!result.Succeeded) return Results.Problem("Verkeerde e-pos of wagwoord.", statusCode: 401);

            if (claim.Matches(req.Claim, user.Email!)) await ProveEmail(user, users, db);
            else await AccountClaim.LinkOrdersAsync(db, user);
            return Results.Ok(await Me(user, users));
        }).AllowAnonymous();

        // Sign-in by emailed code, beside the password. Same reply for unknown addresses.
        g.MapPost("/code", async (CodeRequest req, UserManager<AppUser> users,
            IEmailSender<AppUser> sender, IConfiguration cfg, ILogger<Program> log) =>
        {
            if (!ResendEmailSender.IsAvailable(cfg))
                return Results.Problem("Aanmelding met 'n kode is tans nie beskikbaar nie.", statusCode: 503);
            if (!string.IsNullOrWhiteSpace(req.Email) && await users.FindByEmailAsync(req.Email.Trim()) is { } user &&
                !await users.IsLockedOutAsync(user))
            {
                var code = await users.GenerateUserTokenAsync(user, TokenOptions.DefaultEmailProvider, SignInCode);
                try { await sender.SendPasswordResetCodeAsync(user, user.Email!, code); }
                catch (Exception e) when (e is HttpRequestException or TaskCanceledException or InvalidOperationException)
                {
                    log.LogError(e, "Sign-in code delivery failed");
                }
            }
            return Results.Ok(new { message = "As die rekening bestaan, is 'n kode gestuur." });
        }).AllowAnonymous();

        g.MapPost("/code/verify", async (CodeRequest req, UserManager<AppUser> users,
            SignInManager<AppUser> signIn, VasbytDbContext db) =>
        {
            var user = string.IsNullOrWhiteSpace(req.Email) ? null : await users.FindByEmailAsync(req.Email.Trim());
            if (user is null || string.IsNullOrWhiteSpace(req.Code)) return CodeProblem();
            if (await users.IsLockedOutAsync(user))
                return Results.Problem("Rekening tydelik gesluit. Probeer later weer.", statusCode: 423);
            if (!await users.VerifyUserTokenAsync(user, TokenOptions.DefaultEmailProvider, SignInCode, req.Code.Trim()))
            {
                await users.AccessFailedAsync(user);
                return CodeProblem();
            }
            await users.ResetAccessFailedCountAsync(user);
            // The code went to the inbox, so it proves the email exactly as the claim link does.
            await ProveEmail(user, users, db);
            await signIn.SignInAsync(user, isPersistent: true);
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
            IEmailSender<AppUser> sender, IConfiguration cfg, ILogger<Program> log) =>
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
                    // Same 200 as an unknown address, so a delivery failure does not reveal the account exists.
                    log.LogError(e, "Password reset email delivery failed");
                }
            }
            return Results.Ok(new { message = "As die rekening bestaan, is 'n herstelskakel gestuur." });
        }).AllowAnonymous();

        g.MapPost("/reset-password", async (ResetPasswordRequest req, UserManager<AppUser> users, VasbytDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Token) ||
                string.IsNullOrWhiteSpace(req.Password))
                return Results.Problem("E-pos, kode en nuwe wagwoord word vereis.", statusCode: 400);
            var user = await users.FindByEmailAsync(req.Email.Trim());
            if (user is null) return Results.Problem("Ongeldige of vervalde herstelskakel.", statusCode: 400);
            var result = await users.ResetPasswordAsync(user, req.Token, req.Password);
            if (!result.Succeeded) return Results.Problem("Ongeldige of vervalde herstelskakel of wagwoord.", statusCode: 400);
            await ProveEmail(user, users, db);
            return Results.Ok(new { message = "Wagwoord is verander." });
        }).AllowAnonymous();
    }

    private static async Task<object> Me(AppUser user, UserManager<AppUser> users) => new
    {
        user.Id, user.Email, user.FirstName, user.LastName,
        roles = await users.GetRolesAsync(user),
    };

    private const string SignInCode = "sign-in";

    /// Marks the email as proven and collects every guest order bought with it.
    private static async Task ProveEmail(AppUser user, UserManager<AppUser> users, VasbytDbContext db)
    {
        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await users.UpdateAsync(user);
        }
        await AccountClaim.LinkOrdersAsync(db, user);
    }

    private static IResult CodeProblem() => Results.Problem("Die kode is verkeerd of het verval.", statusCode: 400,
        extensions: new Dictionary<string, object?> { ["code"] = "signin.code_invalid" });

    private static IResult RegistrationProblem(string detail, string code) =>
        Results.Problem(detail, statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = code });
}
