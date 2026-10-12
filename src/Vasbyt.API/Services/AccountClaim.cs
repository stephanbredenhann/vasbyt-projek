using System.Net;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Services;

/// Emailed "create your account" link. Like AdminInvite, the token is the buyer email signed and
/// time-limited, so opening it proves the inbox and no table is needed.
public class AccountClaim(IDataProtectionProvider dp, ResendClient resend, IConfiguration cfg)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(90);
    private ITimeLimitedDataProtector Protector => dp.CreateProtector("account-claim").ToTimeLimitedDataProtector();

    public string Link(Uri root, string email) =>
        new Uri(root, $"/skep-rekening?email={Uri.EscapeDataString(email)}&eis={Uri.EscapeDataString(
            Protector.Protect(email.Trim().ToLowerInvariant(), Lifetime))}").AbsoluteUri;

    /// False when the token is missing, forged, expired or was issued for another address.
    public bool Matches(string? token, string email)
    {
        if (string.IsNullOrEmpty(token)) return false;
        try { return string.Equals(Protector.Unprotect(token), email.Trim(), StringComparison.OrdinalIgnoreCase); }
        catch (CryptographicException) { return false; }
    }

    /// Ownership follows a proven email only: an unconfirmed account never collects anyone's orders.
    public static async Task LinkOrdersAsync(VasbytDbContext db, AppUser user)
    {
        if (!user.EmailConfirmed || user.NormalizedEmail is not { } email) return;
        await db.Orders.Where(o => o.UserId == null && o.BuyerEmail.ToUpper() == email)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.UserId, user.Id));
    }

    /// The confirmed account an order should join on payment, if its buyer already has one.
    public static Task<Guid?> OwnerForAsync(VasbytDbContext db, string buyerEmail)
    {
        var email = buyerEmail.Trim().ToUpperInvariant();
        return db.Users.Where(u => u.EmailConfirmed && u.NormalizedEmail == email).Select(u => (Guid?)u.Id).FirstOrDefaultAsync();
    }

    /// Resend from the receipt. The hourly idempotency key caps it at one email per order per hour.
    public async Task<bool> SendAsync(Order order)
    {
        if (!OrderConfirmationEmail.IsEnabled(cfg)) return false;
        var root = new Uri(cfg["Public:BaseUrl"]!);
        var link = Link(root, order.BuyerEmail);
        var en = order.Language == "en";
        string T(string af, string english) => en ? english : af;
        static string H(string v) => WebUtility.HtmlEncode(v);
        var title = T("Skep jou Vasbyt-rekening", "Create your Vasbyt account");
        var body = T("Met 'n rekening hou jy jou bestellings, deelnemersvorms en QR-passe op een plek. Bestellings met hierdie e-posadres word outomaties bygevoeg. Het jy reeds 'n rekening? Die skakel voeg dit daarby.",
            "An account keeps your orders, participant forms and QR passes in one place. Orders with this email address are added automatically. Already have an account? The link adds them to it.");
        var html = $"""
<!doctype html><html lang="{(en ? "en" : "af")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vasbyt</title></head>
<body style="margin:0;padding:16px;background:{PassEmail.Canvas};font-family:Arial,Helvetica,sans-serif;color:{PassEmail.Deep}">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:{PassEmail.Paper};border-radius:12px"><tr><td style="padding:24px">
<p style="margin:0;font-size:17px;font-weight:bold;color:{PassEmail.Indigo}">Orania Helpmekaar Vasbyt 2027</p>
<h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">{H(title)}</h1>
<p style="margin:12px 0 0;font-size:17px;line-height:1.5">{H(body)}</p>
<p style="margin:24px 0 0"><a href="{H(link)}" style="display:inline-block;padding:14px 24px;background:{PassEmail.Orange};color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;border-radius:8px">{H(title)}</a></p>
</td></tr></table></body></html>
""";
        return await resend.SendAsync(order.BuyerEmail, $"Vasbyt 2027: {title}", html, $"{body}\n{link}",
            idempotencyKey: $"vasbyt-account/{order.PublicToken:D}/{DateTime.UtcNow:yyyyMMddHH}", maxAttempts: 1);
    }
}
