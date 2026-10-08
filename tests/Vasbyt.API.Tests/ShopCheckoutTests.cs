using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;

namespace Vasbyt.API.Tests;

public class ShopCheckoutTests : IClassFixture<VasbytFactory>
{
    private readonly VasbytFactory _factory;
    public ShopCheckoutTests(VasbytFactory factory) => _factory = factory;

    [Fact]
    public async Task Quote_rejects_invalid_quantity_instead_of_omitting_the_line()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var response = await client.PostAsJsonAsync("/api/orders/quote", new
        {
            Products = new[] { new { ProductVariantId = variantId, Quantity = -1 } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Quote_and_order_group_duplicate_variants_and_reject_key_reuse_with_other_cart()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var cart = new
        {
            FirstName = " Ana ", LastName = "Buyer", Email = "ana@example.com",
            Products = new[] { new { ProductVariantId = variantId, Quantity = 2 }, new { ProductVariantId = variantId, Quantity = 3 } },
            CheckoutKey = Guid.NewGuid().ToString(),
        };
        var quote = await client.PostAsJsonAsync("/api/orders/quote", cart);
        quote.EnsureSuccessStatusCode();
        var quoted = await quote.Content.ReadFromJsonAsync<QuoteShape>();
        Assert.Equal(125m, quoted!.TotalZar);
        Assert.Single(quoted.Lines);
        Assert.Equal(5, quoted.Lines[0].Quantity);

        var first = await client.PostAsJsonAsync("/api/orders", cart);
        first.EnsureSuccessStatusCode();
        var order = await first.Content.ReadFromJsonAsync<OrderShape>();
        Assert.Equal("Ana", order!.BuyerFirstName);
        Assert.Equal(125m, order.TotalZar);
        var repeat = await client.PostAsJsonAsync("/api/orders", cart);
        Assert.Equal(order.Token, (await repeat.Content.ReadFromJsonAsync<OrderShape>())!.Token);
        var changed = await client.PostAsJsonAsync("/api/orders", new
        {
            cart.FirstName, cart.LastName, cart.Email, cart.CheckoutKey,
            Products = new[] { new { ProductVariantId = variantId, Quantity = 1 } },
        });
        Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
    }

    [Fact]
    public async Task Duplicate_variant_rows_cannot_bypass_the_quantity_limit()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var response = await client.PostAsJsonAsync("/api/orders/quote", new
        {
            Products = new[] { new { ProductVariantId = variantId, Quantity = 11 },
                new { ProductVariantId = variantId, Quantity = 10 } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Tracked_last_item_can_only_be_paid_once()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant(stock: 1, tracked: true);
        async Task<Guid> Create()
        {
            var result = await client.PostAsJsonAsync("/api/orders", Cart(variantId));
            result.EnsureSuccessStatusCode();
            return (await result.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        }
        var firstToken = await Create();
        var secondToken = await Create();
        var responses = await Task.WhenAll(
            client.PostAsync($"/api/orders/{firstToken}/pay-demo", null),
            client.PostAsync($"/api/orders/{secondToken}/pay-demo", null));
        Assert.Single(responses.Where(r => r.IsSuccessStatusCode));
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        Assert.Equal(0, db.ProductVariants.Single(v => v.Id == variantId).Stock);
        Assert.Equal(1, db.Orders.Count(o => o.Status == OrderStatus.Paid && o.Lines.Any(l => l.ProductVariantId == variantId)));
    }

    [Fact]
    public async Task Failed_mixed_stock_payment_rolls_back_all_inventory_and_order_state()
    {
        var client = _factory.CreateClient();
        var firstId = await NewVariant(stock: 1, tracked: true);
        var secondId = await NewVariant(stock: 1, tracked: true);
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
            Products = new[] { new { ProductVariantId = firstId, Quantity = 1 },
                new { ProductVariantId = secondId, Quantity = 1 } },
        });
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            db.ProductVariants.Single(v => v.Id == secondId).Stock = 0;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).StatusCode);
        using var check = _factory.Services.CreateScope();
        var state = check.ServiceProvider.GetRequiredService<VasbytDbContext>();
        Assert.Equal(1, state.ProductVariants.Single(v => v.Id == firstId).Stock);
        Assert.Equal(OrderStatus.Pending, state.Orders.Single(o => o.PublicToken == token).Status);
    }

    [Fact]
    public async Task Price_change_blocks_payment_until_pending_order_is_requoted()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var created = await client.PostAsJsonAsync("/api/orders", Cart(variantId));
        created.EnsureSuccessStatusCode();
        var order = (await created.Content.ReadFromJsonAsync<OrderShape>())!;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            db.ProductVariants.Single(v => v.Id == variantId).PriceZar = 30m;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsync($"/api/orders/{order.Token}/pay-demo", null)).StatusCode);
        var updated = await client.PutAsJsonAsync($"/api/orders/{order.Token}", new
        {
            FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
            Products = new[] { new { ProductVariantId = variantId, Quantity = 1 } },
            order.Version, ExpectedTotalZar = 30m,
        });
        updated.EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/orders/{order.Token}/pay-demo", null)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Pending_edit_checks_version_and_preserves_reference()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var created = await client.PostAsJsonAsync("/api/orders", Cart(variantId));
        created.EnsureSuccessStatusCode();
        var before = (await created.Content.ReadFromJsonAsync<OrderShape>())!;
        var edit = new
        {
            FirstName = "Bea", LastName = "Buyer", Email = "bea@example.com", Version = before.Version,
            Products = new[] { new { ProductVariantId = variantId, Quantity = 2 } },
            ExpectedTotalZar = 50m,
        };
        var updated = await client.PutAsJsonAsync($"/api/orders/{before.Token}", edit);
        updated.EnsureSuccessStatusCode();
        var after = (await updated.Content.ReadFromJsonAsync<OrderShape>())!;
        Assert.Equal(before.Reference, after.Reference);
        Assert.Equal(50m, after.TotalZar);
        Assert.NotEqual(before.Version, after.Version);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/orders/{before.Token}", edit)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync($"/api/orders/{before.Token}/pay-demo",
                new { Version = before.Version, ExpectedTotalZar = before.TotalZar })).StatusCode);
        (await client.PostAsJsonAsync($"/api/orders/{before.Token}/pay-demo",
            new { Version = after.Version, ExpectedTotalZar = after.TotalZar })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/orders/{before.Token}/pay-demo",
            new { Version = before.Version, ExpectedTotalZar = before.TotalZar })).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Legacy_duplicate_product_rows_pay_at_the_same_total_and_decrement_once_per_unit()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant(stock: 2, tracked: true);
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
            Products = new[] { new { ProductVariantId = variantId, Quantity = 2 } },
        });
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            var orderId = db.Orders.Single(o => o.PublicToken == token).Id;
            var line = db.OrderLines.Single(l => l.OrderId == orderId);
            line.Quantity = 1;
            line.LineTotalZar = 25m;
            db.OrderLines.Add(new OrderLine
            {
                OrderId = orderId, Kind = OrderLineKind.Product, ProductVariantId = variantId,
                Description = line.Description, Quantity = 1, UnitPriceZar = 25m, LineTotalZar = 25m,
            });
            await db.SaveChangesAsync();
        }
        var paid = await client.PostAsync($"/api/orders/{token}/pay-demo", null);
        paid.EnsureSuccessStatusCode();
        using var check = _factory.Services.CreateScope();
        var state = check.ServiceProvider.GetRequiredService<VasbytDbContext>();
        Assert.Equal(0, state.ProductVariants.Single(v => v.Id == variantId).Stock);
        Assert.Equal(OrderStatus.Paid, state.Orders.Single(o => o.PublicToken == token).Status);
    }

    [Fact]
    public async Task Legacy_duplicate_ticket_rows_create_the_purchased_number_of_entrants()
    {
        var client = _factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
            Tickets = new[] { new { RouteCategoryId = _factory.RouteId("ligdraf"), TariffKind = "Student", Quantity = 2 } },
        });
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
            var orderId = db.Orders.Single(o => o.PublicToken == token).Id;
            var line = db.OrderLines.Single(l => l.OrderId == orderId);
            line.Quantity = 1;
            line.LineTotalZar = line.UnitPriceZar;
            db.OrderLines.Add(new OrderLine
            {
                OrderId = orderId, Kind = OrderLineKind.Ticket,
                RouteCategoryId = line.RouteCategoryId, TariffKind = line.TariffKind,
                Description = line.Description, Quantity = 1,
                UnitPriceZar = line.UnitPriceZar, LineTotalZar = line.UnitPriceZar,
            });
            await db.SaveChangesAsync();
        }
        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        using var check = _factory.Services.CreateScope();
        var state = check.ServiceProvider.GetRequiredService<VasbytDbContext>();
        Assert.Equal(2, state.Entrants.Count(e => e.OrderLine!.Order!.PublicToken == token));
    }

    [Fact]
    public async Task Concurrent_pending_edit_and_versioned_payment_have_one_winner()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var created = await client.PostAsJsonAsync("/api/orders", Cart(variantId));
        created.EnsureSuccessStatusCode();
        var order = (await created.Content.ReadFromJsonAsync<OrderShape>())!;
        var edit = client.PutAsJsonAsync($"/api/orders/{order.Token}", new
        {
            FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
            Products = new[] { new { ProductVariantId = variantId, Quantity = 2 } },
            order.Version, ExpectedTotalZar = 50m,
        });
        var pay = client.PostAsJsonAsync($"/api/orders/{order.Token}/pay-demo",
            new { order.Version, ExpectedTotalZar = 25m });
        var responses = await Task.WhenAll(edit, pay);
        Assert.Single(responses.Where(r => r.IsSuccessStatusCode));
        Assert.Single(responses.Where(r => r.StatusCode == HttpStatusCode.Conflict));
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var saved = db.Orders.Single(o => o.PublicToken == order.Token);
        Assert.True(saved.Status == OrderStatus.Paid && saved.TotalZar == 25m ||
            saved.Status == OrderStatus.Pending && saved.TotalZar == 50m);
    }

    [Fact]
    public async Task Unknown_length_http2_payment_body_still_checks_stale_intent()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant();
        var created = await client.PostAsJsonAsync("/api/orders", Cart(variantId));
        created.EnsureSuccessStatusCode();
        var order = (await created.Content.ReadFromJsonAsync<OrderShape>())!;
        var observer = new UnknownLengthBodyObserver();
        using var host = _factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IStartupFilter>(new StripTransferEncodingFilter(observer))));
        using var paymentClient = host.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/orders/{order.Token}/pay-demo")
        {
            Version = HttpVersion.Version20,
            Content = new UnknownLengthJsonContent($"{{\"version\":{order.Version},\"expectedTotalZar\":1}}"),
        };
        var response = await paymentClient.SendAsync(request);
        Assert.True(observer.CanHaveBody);
        Assert.Null(observer.ContentLength);
        Assert.False(observer.HasTransferEncoding);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        Assert.Equal(OrderStatus.Pending, db.Orders.Single(o => o.PublicToken == order.Token).Status);
    }

    [Fact]
    public async Task Admin_stale_variant_form_cannot_restore_stock_after_sale()
    {
        var variantId = await NewVariant(stock: 2, tracked: true);
        var admin = await _factory.AdminClientAsync("variant-editor@example.com");
        var listed = await admin.GetFromJsonAsync<JsonElement>("/api/admin/products");
        var product = listed.EnumerateArray().Single(p => p.GetProperty("variants")
            .EnumerateArray().Any(v => v.GetProperty("id").GetInt32() == variantId));
        var productId = product.GetProperty("id").GetInt32();
        var oldVersion = product.GetProperty("variants").EnumerateArray()
            .Single(v => v.GetProperty("id").GetInt32() == variantId).GetProperty("version").GetUInt32();
        var buyer = _factory.CreateClient();
        var created = await buyer.PostAsJsonAsync("/api/orders", Cart(variantId));
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        (await buyer.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        var path = $"/api/admin/products/{productId}/variants/{variantId}";
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync(path, new
        {
            Label = "Updated", PriceZar = 25m, Stock = 2, IsActive = true,
            TrackStock = true, Version = oldVersion,
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync(path, new
        {
            Label = "Updated", PriceZar = 25m, Stock = 2, IsActive = true, TrackStock = true,
        })).StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        Assert.Equal(1, db.ProductVariants.Single(v => v.Id == variantId).Stock);
        var currentVersion = db.ProductVariants.Single(v => v.Id == variantId).Version;
        (await admin.PutAsJsonAsync(path, new
        {
            Label = "Updated", PriceZar = 25m, Stock = 1, IsActive = true,
            TrackStock = true, Version = currentVersion,
        })).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Signed_in_order_is_owned_and_private_guest_link_cannot_be_stolen()
    {
        var variantId = await NewVariant();
        var guest = _factory.CreateClient();
        var guestOrder = await guest.PostAsJsonAsync("/api/orders", Cart(variantId));
        guestOrder.EnsureSuccessStatusCode();
        var token = (await guestOrder.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        var owner = await Register("owner@example.com");
        var ownedOrder = await owner.PostAsJsonAsync("/api/orders", Cart(variantId));
        ownedOrder.EnsureSuccessStatusCode();
        var ownedToken = (await ownedOrder.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        var mine = await owner.GetFromJsonAsync<OrderShape[]>("/api/my/orders");
        Assert.Contains(mine!, o => o.Token == ownedToken);
        Assert.DoesNotContain(mine!, o => o.Token == token);

        (await owner.PostAsync($"/api/orders/{token}/link", null)).EnsureSuccessStatusCode();
        (await owner.PostAsync($"/api/orders/{token}/link", null)).EnsureSuccessStatusCode();
        var other = await Register("other@example.com");
        Assert.Equal(HttpStatusCode.Conflict,
            (await other.PostAsync($"/api/orders/{token}/link", null)).StatusCode);
    }

    [Fact]
    public async Task Collection_is_paid_only_and_cannot_exceed_purchased_quantity()
    {
        var variantId = await NewVariant();
        var buyer = _factory.CreateClient();
        var response = await buyer.PostAsJsonAsync("/api/orders", Cart(variantId));
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<OrderShape>())!.Token;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var order = db.Orders.Single(o => o.PublicToken == token);
        var lineId = db.OrderLines.Single(l => l.OrderId == order.Id).Id;
        var admin = await _factory.AdminClientAsync("collect@example.com");
        var path = $"/api/admin/orders/{order.Id}/collection";
        var valid = new { Lines = new[] { new { OrderLineId = lineId, CollectedQuantity = 1 } } };
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync(path, valid)).StatusCode);
        (await buyer.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.PutAsJsonAsync(path, new { Lines = new[] { new { OrderLineId = lineId, CollectedQuantity = 2 } } })).StatusCode);
        (await admin.PutAsJsonAsync(path, valid)).EnsureSuccessStatusCode();
        var loaded = await buyer.GetFromJsonAsync<OrderDetailShape>($"/api/orders/{token}");
        Assert.Equal(1, loaded!.Lines.Single().CollectedQuantity);
    }

    [Fact]
    public async Task Password_reset_token_expires_after_use_without_switching_active_account()
    {
        var active = await Register("active@example.com");
        var target = await Register("target@example.com");
        string token;
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = (await users.FindByEmailAsync("target@example.com"))!;
            token = await users.GeneratePasswordResetTokenAsync(user);
        }
        var body = new { Email = "target@example.com", Token = token, Password = "Changed2026!" };
        (await active.PostAsJsonAsync("/api/auth/reset-password", body)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest,
            (await target.PostAsJsonAsync("/api/auth/reset-password", body)).StatusCode);
        var me = await active.GetFromJsonAsync<UserShape>("/api/auth/me");
        Assert.Equal("active@example.com", me!.Email);
        Assert.Equal(HttpStatusCode.Unauthorized, (await target.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Password_recovery_reports_unavailable_delivery_without_creating_a_token_link()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { Email = "unknown@example.com" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    private async Task<HttpClient> Register(string email)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Email = email, Password = "Password2026!", FirstName = "Test", LastName = "Buyer",
        });
        response.EnsureSuccessStatusCode();
        return client;
    }

    [Fact]
    public async Task Sold_out_tracked_variant_is_hidden_from_shop_and_cannot_be_ordered_beyond_stock()
    {
        var client = _factory.CreateClient();
        var soldOutId = await NewVariant(stock: 0, tracked: true);
        var lowId = await NewVariant(stock: 2, tracked: true);
        var shop = (await client.GetFromJsonAsync<ShopProductShape[]>("/api/products"))!;
        var listed = shop.SelectMany(p => p.Variants).Select(v => v.Id).ToHashSet();
        Assert.DoesNotContain(soldOutId, listed);
        Assert.Contains(lowId, listed);

        var response = await client.PostAsJsonAsync("/api/orders/quote", new
        {
            Products = new[] { new { ProductVariantId = lowId, Quantity = 3 } },
        });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Product_with_only_sold_out_variants_is_absent_from_shop()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant(stock: 0, tracked: true);
        int productId;
        using (var scope = _factory.Services.CreateScope())
            productId = scope.ServiceProvider.GetRequiredService<VasbytDbContext>().ProductVariants.Single(v => v.Id == variantId).ProductId;
        var shop = (await client.GetFromJsonAsync<ShopProductShape[]>("/api/products"))!;
        Assert.DoesNotContain(shop, p => p.Id == productId);
    }

    [Fact]
    public async Task Untracked_variant_with_zero_stock_stays_on_sale()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant(stock: 0, tracked: false);
        var shop = (await client.GetFromJsonAsync<ShopProductShape[]>("/api/products"))!;
        Assert.Contains(shop.SelectMany(p => p.Variants), v => v.Id == variantId);
    }

    [Fact]
    public async Task Public_stock_is_capped_at_the_order_limit()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant(stock: 50, tracked: true);
        var shop = (await client.GetFromJsonAsync<ShopProductShape[]>("/api/products"))!;
        Assert.Equal(20, shop.SelectMany(p => p.Variants).Single(v => v.Id == variantId).Stock);
    }

    [Fact]
    public async Task Create_order_rejects_quantity_over_stock_with_conflict()
    {
        var client = _factory.CreateClient();
        var variantId = await NewVariant(stock: 2, tracked: true);
        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
            Products = new[] { new { ProductVariantId = variantId, Quantity = 3 } },
        });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private static object Cart(int variantId) => new
    {
        FirstName = "Ana", LastName = "Buyer", Email = "ana@example.com",
        Products = new[] { new { ProductVariantId = variantId, Quantity = 1 } },
    };

    private async Task<int> NewVariant(int stock = 0, bool tracked = false)
    {
        _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VasbytDbContext>();
        var product = new Product { Name = "Cap", Variants = [new ProductVariant { Label = "Blue", PriceZar = 25m, Stock = stock }] };
        db.Products.Add(product);
        if (tracked) db.Entry(product.Variants[0]).Property<bool>("TrackStock").CurrentValue = true;
        await db.SaveChangesAsync();
        return product.Variants[0].Id;
    }

    private record QuoteShape(QuoteLineShape[] Lines, decimal TotalZar);
    private record QuoteLineShape(int Quantity);
    private record OrderShape(Guid Token, string Reference, decimal TotalZar, uint Version, string BuyerFirstName);
    private record OrderDetailShape(OrderDetailLine[] Lines);
    private record OrderDetailLine(int CollectedQuantity);
    private record UserShape(string Email);
    private record ShopProductShape(int Id, ShopVariantShape[] Variants);
    private record ShopVariantShape(int Id, int Stock);

    private sealed class UnknownLengthJsonContent : HttpContent
    {
        private readonly string _json;
        public UnknownLengthJsonContent(string json)
        {
            _json = json;
            Headers.ContentType = new MediaTypeHeaderValue("application/json");
        }

        protected override bool TryComputeLength(out long length)
        {
            length = 0;
            return false;
        }

        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context)
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes(_json);
            await stream.WriteAsync(bytes);
        }

        protected override Task<Stream> CreateContentReadStreamAsync() =>
            Task.FromResult<Stream>(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(_json)));
    }

    private sealed class UnknownLengthBodyObserver
    {
        public bool CanHaveBody { get; set; }
        public long? ContentLength { get; set; }
        public bool HasTransferEncoding { get; set; }
    }

    private sealed class StripTransferEncodingFilter(UnknownLengthBodyObserver observer) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, following) =>
            {
                context.Request.Headers.Remove("Transfer-Encoding");
                context.Request.ContentLength = null;
                observer.CanHaveBody = context.Features.Get<IHttpRequestBodyDetectionFeature>()?.CanHaveBody == true;
                observer.ContentLength = context.Request.ContentLength;
                observer.HasTransferEncoding = context.Request.Headers.TransferEncoding.Count > 0;
                await following();
            });
            next(app);
        };
    }
}
