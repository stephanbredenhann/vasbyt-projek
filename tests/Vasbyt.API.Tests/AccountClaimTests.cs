using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class AccountClaimTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    private const string Password = "Password2026!";

    [Fact]
    public async Task Claim_link_creates_a_verified_account_that_collects_every_guest_order_for_its_email()
    {
        var first = await PaidGuestOrder("claim@example.com");
        var second = await PaidGuestOrder("Claim@Example.com");
        var someoneElse = await PaidGuestOrder("else@example.com");

        var client = factory.CreateClient();
        await AssertCode(client, Register("wrong@example.com", Claim("claim@example.com")), "registration.claim_invalid");
        (await client.PostAsJsonAsync("/api/auth/register", Register("claim@example.com", Claim("claim@example.com"))))
            .EnsureSuccessStatusCode();

        var mine = await MyOrders(client);
        Assert.Contains(first, mine);
        Assert.Contains(second, mine);
        Assert.DoesNotContain(someoneElse, mine);
    }

    [Fact]
    public async Task Unverified_account_collects_nothing_until_the_claim_link_proves_the_email()
    {
        (await factory.CreateClient().PostAsJsonAsync("/api/auth/register", Register("old@example.com"))).EnsureSuccessStatusCode();
        var guest = await PaidGuestOrder("old@example.com");

        var plain = await SignIn("old@example.com");
        Assert.DoesNotContain(guest, await MyOrders(plain));

        var claimed = factory.CreateClient();
        (await claimed.PostAsJsonAsync("/api/auth/login", new { Email = "old@example.com", Password, Claim = Claim("old@example.com") }))
            .EnsureSuccessStatusCode();
        Assert.Contains(guest, await MyOrders(claimed));

        // Now confirmed, so a later guest purchase with the same address joins the account on payment.
        var later = await PaidGuestOrder("old@example.com");
        Assert.Contains(later, await MyOrders(claimed));
    }

    [Fact]
    public async Task Sign_in_code_proves_the_email_and_unknown_addresses_get_the_same_reply()
    {
        (await factory.CreateClient().PostAsJsonAsync("/api/auth/register", Register("code@example.com"))).EnsureSuccessStatusCode();
        var guest = await PaidGuestOrder("code@example.com");
        var sender = new CaptureSender();
        using var host = factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Demo:Enabled", "false");
            b.UseSetting("Resend:ApiKey", "test-key");
            b.UseSetting("Public:BaseUrl", "https://vasbyt.example");
            b.ConfigureTestServices(s => s.AddSingleton<IEmailSender<AppUser>>(sender));
        });
        var client = host.CreateClient();

        var known = await client.PostAsJsonAsync("/api/auth/code", new { Email = "code@example.com" });
        var unknown = await client.PostAsJsonAsync("/api/auth/code", new { Email = "nobody@example.com" });
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        var code = Assert.Single(sender.Codes);

        await AssertCode(client, "/api/auth/code/verify", new { Email = "code@example.com", Code = "000000" == code ? "111111" : "000000" },
            "signin.code_invalid");
        (await client.PostAsJsonAsync("/api/auth/code/verify", new { Email = "code@example.com", Code = code })).EnsureSuccessStatusCode();
        Assert.Contains(guest, await MyOrders(client));
    }

    private string Claim(string email)
    {
        using var scope = factory.Services.CreateScope();
        var link = scope.ServiceProvider.GetRequiredService<AccountClaim>().Link(new Uri("https://vasbyt.example"), email);
        return QueryHelpers.ParseQuery(new Uri(link).Query)["eis"]!;
    }

    private async Task<Guid> PaidGuestOrder(string email)
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Guest", LastName = "Buyer", Email = email,
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligdraf"), TariffKind = "Student", Quantity = 1 } },
        });
        created.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var token = doc.RootElement.GetProperty("token").GetGuid();
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        return token;
    }

    private async Task<HttpClient> SignIn(string email)
    {
        var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password })).EnsureSuccessStatusCode();
        return client;
    }

    private static async Task<Guid[]> MyOrders(HttpClient client)
    {
        using var doc = JsonDocument.Parse(await client.GetStringAsync("/api/my/orders"));
        return doc.RootElement.EnumerateArray().Select(o => o.GetProperty("token").GetGuid()).ToArray();
    }

    private static object Register(string email, string? claim = null) =>
        new { Email = email, Password, FirstName = "Test", LastName = "Buyer", Claim = claim };

    private static Task AssertCode(HttpClient client, object body, string code) =>
        AssertCode(client, "/api/auth/register", body, code);

    private static async Task AssertCode(HttpClient client, string path, object body, string code)
    {
        var response = await client.PostAsJsonAsync(path, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(code, doc.RootElement.GetProperty("code").GetString());
    }

    private sealed class CaptureSender : IEmailSender<AppUser>
    {
        public List<string> Codes { get; } = [];
        public Task SendConfirmationLinkAsync(AppUser user, string email, string link) => Task.CompletedTask;
        public Task SendPasswordResetLinkAsync(AppUser user, string email, string link) => Task.CompletedTask;
        public Task SendPasswordResetCodeAsync(AppUser user, string email, string code)
        {
            Codes.Add(code);
            return Task.CompletedTask;
        }
    }
}
