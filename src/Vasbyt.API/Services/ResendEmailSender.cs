using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Implements Identity's email sender for account recovery.
public class ResendEmailSender(HttpClient http, IConfiguration cfg, ILogger<ResendEmailSender> log)
    : IEmailSender<AppUser>
{
    private string? ApiKey => cfg["Resend:ApiKey"];
    private string From => cfg["Resend:From"] ?? "Vasbyt <geenantwoord@vasbyt.co.za>";
    public static bool IsAvailable(IConfiguration cfg) => !cfg.GetValue<bool>("Demo:Enabled") &&
        !string.IsNullOrWhiteSpace(cfg["Resend:ApiKey"]) &&
        Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out var origin) && origin.Scheme == "https";

    public async Task SendEmailAsync(string to, string subject, string htmlMessage)
    {
        if (!IsAvailable(cfg)) throw new InvalidOperationException("Recovery delivery is unavailable.");
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
        request.Content = JsonContent.Create(
            new { from = From, to = new[] { to }, subject, html = htmlMessage });
        using var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            log.LogWarning("Recovery email delivery failed with status {Status}", response.StatusCode);
            throw new HttpRequestException("Recovery delivery failed.", null, response.StatusCode);
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
