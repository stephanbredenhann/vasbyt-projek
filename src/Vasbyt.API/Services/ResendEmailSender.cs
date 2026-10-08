using System.Net;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Implements Identity's email sender for account recovery.
public class ResendEmailSender(ResendClient resend, IConfiguration cfg, ILogger<ResendEmailSender> log)
    : IEmailSender<AppUser>
{
    public static bool IsAvailable(IConfiguration cfg) => !cfg.GetValue<bool>("Demo:Enabled") &&
        !string.IsNullOrWhiteSpace(cfg["Resend:ApiKey"]) &&
        Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out var origin) && origin.Scheme == "https";

    public async Task SendEmailAsync(string to, string subject, string htmlMessage)
    {
        if (!IsAvailable(cfg)) throw new InvalidOperationException("Recovery delivery is unavailable.");
        if (!await resend.SendAsync(to, subject, htmlMessage, maxAttempts: 1))
        {
            log.LogWarning("Recovery email delivery failed");
            throw new HttpRequestException("Recovery delivery failed.");
        }
    }

    // ponytail: plain wrappers until there is real copy to template.
    public Task SendConfirmationLinkAsync(AppUser user, string email, string link) =>
        SendEmailAsync(email, "Bevestig jou Vasbyt-rekening",
            $"<p>Klik om jou rekening te bevestig: <a href=\"{WebUtility.HtmlEncode(link)}\">{WebUtility.HtmlEncode(link)}</a></p>");

    public Task SendPasswordResetLinkAsync(AppUser user, string email, string link) =>
        SendEmailAsync(email, "Herstel jou Vasbyt-wagwoord",
            $"<p>Klik om jou wagwoord te herstel: <a href=\"{WebUtility.HtmlEncode(link)}\">{WebUtility.HtmlEncode(link)}</a></p>");

    public Task SendPasswordResetCodeAsync(AppUser user, string email, string code) =>
        SendEmailAsync(email, "Vasbyt wagwoordkode", $"<p>Jou kode is <strong>{code}</strong>.</p>");
}
