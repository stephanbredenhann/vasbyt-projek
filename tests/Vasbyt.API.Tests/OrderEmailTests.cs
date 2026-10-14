using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Vasbyt.API.Domain;
using Vasbyt.API.Services;

namespace Vasbyt.API.Tests;

public class OrderEmailTests
{
    [Fact]
    public async Task Receipt_contains_summary_and_pass_link_but_no_medical_details_and_escapes_text()
    {
        var handler = new MailHandler(HttpStatusCode.OK);
        var sender = Sender(handler);
        var order = Order();
        Assert.True(await sender.SendAsync(order));
        Assert.Equal($"vasbyt-registration/{order.PublicToken:D}", handler.IdempotencyKey);
        using var document = JsonDocument.Parse(handler.Body!);
        var html = document.RootElement.GetProperty("html").GetString()!;
        Assert.Contains("VB-2027-000001", html);
        Assert.Contains("&lt;Anna&gt;", html);
        Assert.Contains("Ligtrap &amp; saam", html);
        Assert.Contains($"https://vasbyt.example/registreer/{order.PublicToken}/klaar", html);
        Assert.DoesNotContain("Private allergy", html);
        Assert.DoesNotContain("9001010000000", html);
        Assert.Equal("buyer@example.test", document.RootElement.GetProperty("to")[0].GetString());
    }

    [Fact]
    public async Task Receipt_has_a_button_and_a_plain_text_part()
    {
        var handler = new MailHandler(HttpStatusCode.OK);
        var order = Order();
        Assert.True(await Sender(handler).SendAsync(order));
        using var document = JsonDocument.Parse(handler.Body!);
        var html = document.RootElement.GetProperty("html").GetString()!;
        var text = document.RootElement.GetProperty("text").GetString()!;
        Assert.Contains("display:inline-block", html);
        Assert.Contains("font-size:17px", html);
        Assert.Contains("VB-2027-000001", text);
        Assert.Contains($"https://vasbyt.example/registreer/{order.PublicToken}/klaar", text);
        Assert.Contains("<Anna>", text);
        Assert.DoesNotContain("<p", text);
    }

    [Theory]
    [InlineData("", "https://vasbyt.example", false)]
    [InlineData("key", "", false)]
    [InlineData("key", "http://untrusted.example", false)]
    [InlineData("key", "https://vasbyt.example", true)]
    public async Task Missing_configuration_or_demo_mode_never_sends(string key, string url, bool demo)
    {
        var handler = new MailHandler(HttpStatusCode.OK);
        Assert.False(await Sender(handler, key, url, demo).SendAsync(Order()));
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task Provider_failure_is_reported_without_throwing_or_claiming_delivery()
    {
        var handler = new MailHandler(HttpStatusCode.ServiceUnavailable);
        Assert.False(await Sender(handler).SendAsync(Order()));
    }

    [Theory]
    [InlineData(OrderLineKind.Product, "Haal jou produkte", "Sien jou bestelling")]
    [InlineData(OrderLineKind.Donation, "Dankie vir jou donasie", "Sien jou kwitansie")]
    public async Task Non_event_receipt_uses_the_right_action(OrderLineKind kind, string message, string action)
    {
        var handler = new MailHandler(HttpStatusCode.OK);
        var order = Order();
        order.Lines = [new OrderLine { Kind = kind, Description = "Ondersteuning", Quantity = 1, LineTotalZar = 165 }];
        Assert.True(await Sender(handler).SendAsync(order));
        using var document = JsonDocument.Parse(handler.Body!);
        var html = document.RootElement.GetProperty("html").GetString()!;
        Assert.Contains(message, html);
        Assert.Contains(action, html);
        Assert.DoesNotContain("QR-passe", html);
        Assert.DoesNotContain("deelnemersvorms", html);
    }

    [Fact]
    public void Donation_only_receipt_has_no_next_steps_list_and_paid_date_is_long_form()
    {
        var order = Order();
        order.Lines = [new OrderLine { Kind = OrderLineKind.Donation, Description = "Donasie", Quantity = 1, LineTotalZar = 165 }];
        order.PaidUtc = new DateTime(2026, 10, 10, 12, 3, 0, DateTimeKind.Utc);
        var (html, text) = OrderConfirmationEmail.Body(order, "https://vasbyt.example/x");
        Assert.DoesNotContain("Wat om nou te doen", html);
        Assert.DoesNotContain("<ol", html);
        Assert.Contains("Dankie vir jou donasie", html);
        Assert.DoesNotContain("Wat om nou te doen", text);
        Assert.Contains("Dankie vir jou donasie", text);
        Assert.Contains("10 Oktober 2026, 14:03", html);
        order.Language = "en";
        Assert.Contains("10 October 2026, 14:03", OrderConfirmationEmail.Body(order, "https://vasbyt.example/x").Html);
    }

    [Fact]
    public void Account_link_appears_only_when_given()
    {
        var order = Order();
        Assert.DoesNotContain("Skep jou rekening", OrderConfirmationEmail.Body(order, "https://vasbyt.example/x").Html);
        var (html, text) = OrderConfirmationEmail.Body(order, "https://vasbyt.example/x", "https://vasbyt.example/skep-rekening?eis=t");
        Assert.Contains("Skep jou rekening", html);
        Assert.Contains("https://vasbyt.example/skep-rekening?eis=t", html);
        Assert.Contains("https://vasbyt.example/skep-rekening?eis=t", text);
    }

    private static OrderConfirmationEmail Sender(MailHandler handler, string key = "key", string url = "https://vasbyt.example", bool demo = false) =>
        Make(handler, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["Resend:ApiKey"] = key, ["Resend:From"] = "Vasbyt <sender@example.test>", ["Public:BaseUrl"] = url,
          ["Demo:Enabled"] = demo.ToString(), ["Resend:RetryDelayMs"] = "1" }).Build());

    private static OrderConfirmationEmail Make(MailHandler handler, IConfiguration cfg) =>
        new(new ResendClient(new HttpClient(handler), cfg, NullLogger<ResendClient>.Instance), cfg,
            NullLogger<OrderConfirmationEmail>.Instance);

    private static Order Order() => new()
    {
        Status = OrderStatus.Paid, Reference = "VB-2027-000001", BuyerFirstName = "<Anna>",
        BuyerEmail = "buyer@example.test", TotalZar = 165,
        Lines = [new() { Description = "Ligtrap & saam", Quantity = 1, LineTotalZar = 165,
            Entrants = [new() { FirstName = "Anna", LastName = "Toets", EntryNumber = "VB2027-0001",
                IsComplete = true, MedicalConditions = "Private allergy", IdNumber = "9001010000000" }] }],
    };

    private class MailHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public int Requests { get; private set; }
        public string? Body { get; private set; }
        public string? IdempotencyKey { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            IdempotencyKey = request.Headers.GetValues("Idempotency-Key").Single();
            Requests++; Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new(status) { Content = new StringContent("{}") };
        }
    }
}
