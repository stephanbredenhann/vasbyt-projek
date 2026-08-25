using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Implements Identity's own IEmailSender<AppUser> so confirm-email and reset-password work with no
/// extra abstraction. With no API key configured it logs instead of sending, so the demo runs offline.
public class ResendEmailSender(HttpClient http, IConfiguration cfg, ILogger<ResendEmailSender> log)
    : IEmailSender<AppUser>
{
    private string? ApiKey => cfg["Resend:ApiKey"];
    private string From => cfg["Resend:From"] ?? "Vasbyt <geenantwoord@vasbyt.co.za>";

    public async Task SendEmailAsync(string to, string subject, string htmlMessage)
    {
        if (string.IsNullOrWhiteSpace(ApiKey))
        {
            log.LogInformation("[e-pos nie gestuur — geen Resend sleutel] Aan: {To} | {Subject}\n{Body}",
                to, subject, htmlMessage);
            return;
        }

        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
        var response = await http.PostAsJsonAsync("https://api.resend.com/emails",
            new { from = From, to = new[] { to }, subject, html = htmlMessage });

        if (!response.IsSuccessStatusCode)
            log.LogError("Resend het {Status} teruggegee: {Body}",
                response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    // ponytail: plain wrappers until there is real copy to template.
    public Task SendConfirmationLinkAsync(AppUser user, string email, string link) =>
        SendEmailAsync(email, "Bevestig jou Vasbyt-rekening",
            $"<p>Klik om jou rekening te bevestig: <a href=\"{link}\">{link}</a></p>");

    public Task SendPasswordResetLinkAsync(AppUser user, string email, string link) =>
        SendEmailAsync(email, "Herstel jou Vasbyt-wagwoord",
            $"<p>Klik om jou wagwoord te herstel: <a href=\"{link}\">{link}</a></p>");

    public Task SendPasswordResetCodeAsync(AppUser user, string email, string code) =>
        SendEmailAsync(email, "Vasbyt wagwoordkode", $"<p>Jou kode is <strong>{code}</strong>.</p>");
}
