using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class PassEmailTests(VasbytFactory factory) : IClassFixture<VasbytFactory>, IDisposable
{
    public void Dispose() => _hosts.ForEach(h => h.Dispose());

    [Fact]
    public void Qr_png_is_a_png_for_the_scanner_payload()
    {
        var png = QrPng.Generate(QrPng.Payload(Guid.NewGuid()));
        Assert.True(png.Length > 100);
        Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, png[..8]);
        Assert.StartsWith("VASBYT:2027:", QrPng.Payload(Guid.NewGuid()));
    }

    [Fact]
    public async Task Completing_a_form_sends_the_pass_to_entrant_and_buyer()
    {
        var mail = new MailHandler();
        var (client, order) = await PaidOrder(mail, "buyer1@example.test");
        var id = order.GetProperty("entrants")[0].GetProperty("id").GetInt32();
        (await Complete(client, order, id, "entrant1@example.test")).EnsureSuccessStatusCode();
        await mail.WaitFor(2);
        Assert.Equal(["buyer1@example.test", "entrant1@example.test"], mail.Recipients.Order().ToArray());
        var token = order.GetProperty("token").GetString()!;
        for (var i = 0; i < mail.Recipients.Count; i++)
        {
            var html = JsonDocument.Parse(mail.Bodies[i]).RootElement.GetProperty("html").GetString()!;
            Assert.Equal(mail.Recipients[i] == "buyer1@example.test", html.Contains(token));
        }
        var first = JsonDocument.Parse(mail.Bodies[0]).RootElement;
        var attachment = first.GetProperty("attachments")[0];
        Assert.Equal(2, first.GetProperty("attachments").GetArrayLength());
        Assert.False(first.GetProperty("attachments")[1].TryGetProperty("content_id", out _));
        Assert.Equal("vasbyt-VB2027-" + id.ToString("D4") + ".png", first.GetProperty("attachments")[1].GetProperty("filename").GetString());
        Assert.Equal("vasbyt-qr", attachment.GetProperty("content_id").GetString());
        Assert.Contains("cid:vasbyt-qr", first.GetProperty("html").GetString());
        Assert.All(mail.Keys, k => Assert.StartsWith($"entrant-pass-{id}-", k));
    }

    [Fact]
    public async Task One_email_when_entrant_and_buyer_match_and_resubmit_does_not_resend()
    {
        var mail = new MailHandler();
        var (client, order) = await PaidOrder(mail, "same@example.test");
        var id = order.GetProperty("entrants")[0].GetProperty("id").GetInt32();
        (await Complete(client, order, id, "SAME@example.test")).EnsureSuccessStatusCode();
        await mail.WaitFor(1);
        (await Complete(client, order, id, "same@example.test")).EnsureSuccessStatusCode();
        await Task.Delay(500);
        Assert.Single(mail.Recipients);
    }

    [Fact]
    public void English_orders_get_english_copy_and_no_link_without_one()
    {
        var order = new Vasbyt.API.Domain.Order { Reference = "VB-2027-000001", Language = "en" };
        var entrant = new Vasbyt.API.Domain.Entrant { FirstName = "Anna", LastName = "Toets", EntryNumber = "VB2027-0001" };
        var (html, text) = PassEmail.Body(entrant, order, "29 April to 1 May 2027", null, false, "Anna Toets", true);
        Assert.Contains("here is your Vasbyt pass", html);
        Assert.DoesNotContain("href=", html);
        Assert.DoesNotContain("View:", text);
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, 3)]
    [InlineData(HttpStatusCode.ServiceUnavailable, 3)]
    [InlineData(HttpStatusCode.UnprocessableEntity, 1)]
    public async Task Resend_client_retries_429_and_5xx_but_not_4xx(HttpStatusCode status, int attempts)
    {
        var calls = new CountingHandler(status);
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Resend:ApiKey"] = "k", ["Resend:RetryDelayMs"] = "1" }).Build();
        var client = new ResendClient(new HttpClient(calls), cfg,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<ResendClient>.Instance);
        Assert.False(await client.SendAsync("a@example.test", "s", "<p>x</p>"));
        Assert.Equal(attempts, calls.Calls);
        Assert.False(calls.Body!.Contains("\"text\"") || calls.Body.Contains("attachments"));
    }

    private sealed class CountingHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        public string? Body { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++; Body = await request.Content!.ReadAsStringAsync(ct);
            return new(status) { Content = new StringContent("{}") };
        }
    }

    private readonly List<IDisposable> _hosts = [];

    private async Task<(HttpClient, JsonElement)> PaidOrder(MailHandler mail, string buyerEmail)
    {
        using var initial = factory.CreateClient();
        var host = factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Resend:ApiKey", "test-key");
            b.UseSetting("Public:BaseUrl", "https://vasbyt.example");
            b.ConfigureTestServices(s => s.AddHttpClient<ResendClient>().ConfigurePrimaryHttpMessageHandler(() => mail));
        });
        _hosts.Add(host);
        var client = host.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Anna", LastName = "Demo", Email = buyerEmail, Phone = "0000000000",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        });
        var token = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        var paid = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        return (client, await paid.Content.ReadFromJsonAsync<JsonElement>());
    }

    private static Task<HttpResponseMessage> Complete(HttpClient client, JsonElement order, int id, string email) =>
        client.PutAsJsonAsync($"/api/orders/{order.GetProperty("token").GetString()}/entrants/{id}", new
        {
            FirstName = "Anna", LastName = "Demo", IdNumber = "9001010000000", Email = email, Phone = "0000000000",
            DateOfBirth = "1990-01-01", Gender = "V", ShirtSize = "M", StreetAddress = "Demo", Town = "Orania",
            Province = "Noord-Kaap", PostalCode = "8752", EmergencyName = "Demo", EmergencyRelationship = "Familie",
            EmergencyPhone = "0000000000", AcceptTerms = true, PhotoConsent = false,
        });

    private sealed class MailHandler : HttpMessageHandler
    {
        private readonly object _gate = new();
        public List<string> Bodies { get; } = [];
        public List<string> Keys { get; } = [];
        public List<string> Recipients { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = await request.Content!.ReadAsStringAsync(ct);
            var to = JsonDocument.Parse(body).RootElement.GetProperty("to")[0].GetString()!;
            if (!body.Contains("\"attachments\"")) return new(HttpStatusCode.OK) { Content = new StringContent("{}") };
            lock (_gate)
            {
                Bodies.Add(body); Recipients.Add(to);
                if (request.Headers.TryGetValues("Idempotency-Key", out var k)) Keys.Add(k.Single());
            }
            return new(HttpStatusCode.OK) { Content = new StringContent("{}") };
        }

        public async Task WaitFor(int count)
        {
            for (var i = 0; i < 100; i++)
            {
                lock (_gate) if (Recipients.Count >= count) return;
                await Task.Delay(100);
            }
            throw new TimeoutException($"Expected {count} emails, got {Recipients.Count}.");
        }
    }
}
