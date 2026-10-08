using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class RecoveryDeliveryTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Configured_recovery_gives_the_same_response_for_known_and_unknown_email()
    {
        using var bootstrap = factory.CreateClient();
        (await bootstrap.PostAsJsonAsync("/api/auth/register", new
        {
            Email = "known@example.com", Password = "Password2026!", FirstName = "Known", LastName = "Buyer",
        })).EnsureSuccessStatusCode();
        var sender = new CaptureSender();
        using var host = ConfiguredHost(sender);
        using var client = host.CreateClient();
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new { Email = "known@example.com" });
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new { Email = "unknown@example.com" });
        known.EnsureSuccessStatusCode();
        unknown.EnsureSuccessStatusCode();
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Single(sender.Links);
        Assert.StartsWith("https://vasbyt.example/herstel-wagwoord?", sender.Links[0]);
        Assert.Contains("token=", sender.Links[0]);
        Assert.Equal("no-store", known.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Failed_recovery_delivery_returns_unavailable()
    {
        using var bootstrap = factory.CreateClient();
        (await bootstrap.PostAsJsonAsync("/api/auth/register", new
        {
            Email = "failed@example.com", Password = "Password2026!", FirstName = "Failed", LastName = "Buyer",
        })).EnsureSuccessStatusCode();
        using var host = ConfiguredHost(new CaptureSender { Fail = true });
        using var client = host.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { Email = "failed@example.com" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Resend_provider_failure_throws_without_reporting_success()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Resend:ApiKey"] = "test-key", ["Public:BaseUrl"] = "https://vasbyt.example", ["Resend:RetryDelayMs"] = "1",
        }).Build();
        var resend = new ResendClient(new HttpClient(new FailureHandler()), cfg, NullLogger<ResendClient>.Instance);
        var sender = new ResendEmailSender(resend, cfg, NullLogger<ResendEmailSender>.Instance);
        await Assert.ThrowsAsync<HttpRequestException>(() => sender.SendPasswordResetLinkAsync(
            new AppUser(), "known@example.com", "https://vasbyt.example/herstel-wagwoord?token=secret"));
    }

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> ConfiguredHost(CaptureSender sender) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Demo:Enabled", "false");
            builder.UseSetting("Resend:ApiKey", "test-key");
            builder.UseSetting("Public:BaseUrl", "https://vasbyt.example");
            builder.ConfigureTestServices(services => services.AddSingleton<IEmailSender<AppUser>>(sender));
        });

    private sealed class CaptureSender : IEmailSender<AppUser>
    {
        public List<string> Links { get; } = [];
        public bool Fail { get; set; }
        public Task SendConfirmationLinkAsync(AppUser user, string email, string link) => Task.CompletedTask;
        public Task SendPasswordResetCodeAsync(AppUser user, string email, string code) => Task.CompletedTask;
        public Task SendPasswordResetLinkAsync(AppUser user, string email, string link)
        {
            if (Fail) throw new HttpRequestException("Provider failure");
            Links.Add(link);
            return Task.CompletedTask;
        }
    }

    private sealed class FailureHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
    }
}
