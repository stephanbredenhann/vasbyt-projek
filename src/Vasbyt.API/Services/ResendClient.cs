using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Vasbyt.API.Services;

/// An attachment. Set ContentId to show it inline via a cid: reference.
public record EmailAttachment(string Filename, byte[] Content, string ContentType, string? ContentId = null);

/// The one place that talks to Resend: auth, User-Agent (Resend 403s without one), idempotency and retries.
public class ResendClient(HttpClient http, IConfiguration cfg, ILogger<ResendClient> log, IHostEnvironment? env = null)
{
    private static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    /// Keeps the domain out of the logs while still telling addresses apart.
    public static string Mask(string email) { var at = email.IndexOf('@'); return at < 1 ? "***" : email[0] + "***" + email[at..]; }
    public string From => cfg["Resend:From"] ?? "Vasbyt <geenantwoord@vasbyt.co.za>";

    /// False when the mail was not accepted. Never throws for delivery problems. Interactive callers pass maxAttempts 1.
    public async Task<bool> SendAsync(string to, string subject, string html, string? text = null,
        string? idempotencyKey = null, IReadOnlyList<EmailAttachment>? attachments = null, int maxAttempts = 3)
    {
        var key = cfg["Resend:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            if (env?.IsDevelopment() == true)
            {
                log.LogInformation("Resend:ApiKey not set, email not sent. To {To}, subject {Subject}", Mask(to), subject);
                return true;
            }
            log.LogError("Resend:ApiKey is not set, email to {To} was not sent", Mask(to));
            return false;
        }
        var payload = new
        {
            from = From, to = new[] { to }, subject, html, text,
            attachments = attachments?.Select(a => new
            {
                filename = a.Filename, content = Convert.ToBase64String(a.Content),
                content_type = a.ContentType, content_id = a.ContentId,
            }).ToArray(),
        };
        var baseDelay = TimeSpan.FromMilliseconds(cfg.GetValue("Resend:RetryDelayMs", 500));
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
                request.Headers.UserAgent.ParseAdd("vasbyt-api/1.0");
                if (idempotencyKey is not null) request.Headers.Add("Idempotency-Key", idempotencyKey);
                request.Content = JsonContent.Create(payload, options: Json);
                using var response = await http.SendAsync(request);
                if (response.IsSuccessStatusCode) return true;
                var retry = response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
                log.LogWarning("Resend returned {Status} (attempt {Attempt})", response.StatusCode, attempt);
                if (!retry) return false;
                if (response.Headers.RetryAfter?.Delta is { } wait && wait <= TimeSpan.FromSeconds(10) && attempt < maxAttempts)
                {
                    await Task.Delay(wait);
                    continue;
                }
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                log.LogWarning("Resend unreachable: {Error} (attempt {Attempt})", e.GetType().Name, attempt);
            }
            if (attempt < maxAttempts) await Task.Delay(baseDelay * Math.Pow(2, attempt - 1));
        }
        return false;
    }
}
