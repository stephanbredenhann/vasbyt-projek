using System.Net;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace Vasbyt.API.Services;

/// Signup link for someone an admin wants to promote who has no account yet. The token is the email
/// itself, signed and time-limited, so no table is needed and nobody else can claim the promotion.
public class AdminInvite(IDataProtectionProvider dp, ResendClient resend, IConfiguration cfg)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    private ITimeLimitedDataProtector Protector => dp.CreateProtector("admin-invite").ToTimeLimitedDataProtector();

    /// False when the token is forged, expired or was issued for another address.
    public bool Matches(string token, string email)
    {
        try { return string.Equals(Protector.Unprotect(token), email.Trim(), StringComparison.OrdinalIgnoreCase); }
        catch (CryptographicException) { return false; }
    }

    public async Task<bool> SendAsync(string email, string invitedBy)
    {
        if (!Uri.TryCreate(cfg["Public:BaseUrl"], UriKind.Absolute, out var root)) return false;
        var token = Protector.Protect(email.Trim().ToLowerInvariant(), Lifetime);
        var link = new Uri(root, $"/skep-rekening?email={Uri.EscapeDataString(email)}&uitnodiging={Uri.EscapeDataString(token)}").AbsoluteUri;
        static string H(string v) => WebUtility.HtmlEncode(v);
        var html = $"""
<!doctype html><html lang="af"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vasbyt</title></head>
<body style="margin:0;padding:16px;background:{PassEmail.Canvas};font-family:Arial,Helvetica,sans-serif;color:{PassEmail.Deep}">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:{PassEmail.Paper};border-radius:12px"><tr><td style="padding:24px">
<p style="margin:0;font-size:17px;font-weight:bold;color:{PassEmail.Indigo}">Orania Helpmekaar Vasbyt</p>
<h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">Jy is genooi as administrateur</h1>
<p style="margin:12px 0 0;font-size:17px;line-height:1.5">{H(invitedBy)} het jou genooi om die Vasbyt-webwerf te help bestuur. Skep 'n rekening met die skakel hieronder.</p>
<p style="margin:12px 0 0;font-size:17px;line-height:1.5">Gebruik hierdie e-posadres: <strong>{H(email)}</strong></p>
<p style="margin:24px 0 0"><a href="{H(link)}" style="display:inline-block;padding:14px 24px;background:{PassEmail.Orange};color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;border-radius:8px">Skep jou rekening</a></p>
<p style="margin:24px 0 0;font-size:16px;color:{PassEmail.Muted}">Die skakel verval oor 7 dae.</p>
</td></tr></table></body></html>
""";
        var text = $"{invitedBy} het jou genooi as Vasbyt-administrateur.\nSkep 'n rekening met hierdie e-posadres: {email}\n{link}\nDie skakel verval oor 7 dae.";
        return await resend.SendAsync(email, "Vasbyt: jy is genooi as administrateur", html, text, maxAttempts: 1);
    }
}
