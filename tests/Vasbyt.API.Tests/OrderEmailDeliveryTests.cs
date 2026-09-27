using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class OrderEmailDeliveryTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Failed_confirmation_can_be_retried_and_success_is_not_sent_again()
    {
        using var initial = factory.CreateClient();
        var handler = new MailHandler();
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddScoped(_ => new OrderConfirmationEmail(new HttpClient(handler),
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                { ["Resend:ApiKey"] = "test-key", ["Public:BaseUrl"] = "https://vasbyt.example" }).Build(),
                NullLogger<OrderConfirmationEmail>.Instance))));
        using var client = host.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Anna", LastName = "Demo", Email = "retry@example.test", Phone = "0000000000",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        });
        var token = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        var paid = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        var id = (await paid.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("entrants")[0].GetProperty("id").GetInt32();
        var completed = await client.PutAsJsonAsync($"/api/orders/{token}/entrants/{id}", new
        {
            FirstName = "Anna", LastName = "Demo", IdNumber = "9001010000000", Email = "retry@example.test", Phone = "0000000000",
            DateOfBirth = "1990-01-01", Gender = "V", ShirtSize = "M", StreetAddress = "Demo", Town = "Orania",
            Province = "Noord-Kaap", PostalCode = "8752", EmergencyName = "Demo", EmergencyRelationship = "Familie",
            EmergencyPhone = "0000000000", AcceptTerms = true, PhotoConsent = false,
        });
        completed.EnsureSuccessStatusCode();
        Assert.Equal(JsonValueKind.Null, (await completed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("confirmationEmailSentUtc").ValueKind);
        handler.Status = HttpStatusCode.OK;
        var retry = await client.PostAsync($"/api/orders/{token}/confirmation-email", null);
        retry.EnsureSuccessStatusCode();
        var sent = (await retry.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("confirmationEmailSentUtc").GetString();
        Assert.NotNull(sent);
        var requests = handler.Requests;
        var repeat = await client.PostAsync($"/api/orders/{token}/confirmation-email", null);
        Assert.Equal(sent, (await repeat.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("confirmationEmailSentUtc").GetString());
        Assert.Equal(requests, handler.Requests);
    }

    private class MailHandler : HttpMessageHandler
    {
        public HttpStatusCode Status { get; set; } = HttpStatusCode.ServiceUnavailable;
        public int Requests { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            return Task.FromResult(new HttpResponseMessage(Status) { Content = new StringContent("{}") });
        }
    }
}
