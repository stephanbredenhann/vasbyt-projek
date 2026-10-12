using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class AdminInviteTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Existing_account_is_promoted_and_a_new_email_gets_a_working_invite()
    {
        var mail = new Capture();
        using var host = factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Public:BaseUrl", "https://vasbyt.example");
            b.ConfigureTestServices(s => s.AddSingleton(sp => new ResendClient(new HttpClient(mail),
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Resend:ApiKey"] = "k" }).Build(),
                NullLogger<ResendClient>.Instance)));
        });
        using (var scope = host.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var boss = new AppUser { UserName = "boss@example.com", Email = "boss@example.com", FirstName = "Baas" };
            await users.CreateAsync(boss, "Vasbyt!2026");
            await users.AddToRoleAsync(boss, Roles.Admin);
        }
        var admin = host.CreateClient();
        (await admin.PostAsJsonAsync("/api/auth/login", new { Email = "boss@example.com", Password = "Vasbyt!2026" })).EnsureSuccessStatusCode();

        var buyer = host.CreateClient();
        (await buyer.PostAsJsonAsync("/api/auth/register", new { Email = "buyer@example.com", Password = "Vasbyt!2026", FirstName = "B", LastName = "C" })).EnsureSuccessStatusCode();
        Assert.Equal("promoted", await Status(await admin.PostAsJsonAsync("/api/admin/admins", new { Email = "Buyer@example.com" })));
        Assert.Contains("Admin", await buyer.GetStringAsync("/api/auth/me"));
        Assert.Empty(mail.Bodies);

        Assert.Equal("invited", await Status(await admin.PostAsJsonAsync("/api/admin/admins", new { Email = "new@example.com" })));
        var token = Uri.UnescapeDataString(Regex.Match(Assert.Single(mail.Bodies), @"uitnodiging=([^""&\\]+)").Groups[1].Value);

        var stranger = await host.CreateClient().PostAsJsonAsync("/api/auth/register",
            new { Email = "other@example.com", Password = "Vasbyt!2026", FirstName = "O", LastName = "X", Invite = token });
        Assert.Equal(HttpStatusCode.BadRequest, stranger.StatusCode);

        var invited = await host.CreateClient().PostAsJsonAsync("/api/auth/register",
            new { Email = "NEW@example.com", Password = "Vasbyt!2026", FirstName = "N", LastName = "W", Invite = token });
        invited.EnsureSuccessStatusCode();
        Assert.Contains("Admin", await invited.Content.ReadAsStringAsync());
    }

    private static async Task<string?> Status(HttpResponseMessage r)
    {
        r.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("status").GetString();
    }

    private sealed class Capture : HttpMessageHandler
    {
        public List<string> Bodies { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Bodies.Add(await request.Content!.ReadAsStringAsync(ct));
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }
}
