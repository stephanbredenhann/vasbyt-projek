using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Vasbyt.API.Data;
using Vasbyt.API.Domain;
using Vasbyt.API.Endpoints;
using Vasbyt.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Postgres in every environment, including local development. Running one engine everywhere is
// the point: two providers means two migration sets that drift apart, and the differences surface
// as runtime failures rather than build errors.
builder.Services.AddDbContext<VasbytDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException(
            "ConnectionStrings:Default is not set. For local development run `docker compose up -d db`.")));

builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 8;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 10;
        o.SignIn.RequireConfirmedAccount = false;
    })
    .AddRoles<AppRole>()
    .AddEntityFrameworkStores<VasbytDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();
builder.Services.AddScoped<ISecurityStampValidator, SecurityStampValidator<AppUser>>();
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
builder.Services.Configure<DataProtectionTokenProviderOptions>(o =>
    o.TokenLifespan = TimeSpan.FromMinutes(30));

// The SPA is served from this app's wwwroot, so it is same-origin: a cookie is the whole auth story.
// No CORS, no bearer token sitting in browser storage.
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, o =>
    {
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.ExpireTimeSpan = TimeSpan.FromDays(30);
        o.SlidingExpiration = true;
        o.Events.OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync;
        // API-only: answer with a status code rather than redirecting to a login page that isn't there.
        o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    })
    .AddCookie(IdentityConstants.TwoFactorRememberMeScheme);

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Roles.Admin, p => p.RequireRole(Roles.Admin));

// Enums travel as their names both ways: "Student" reads the same in a request body, a response
// and a Swagger page, and an int would silently accept a wrong one.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddHttpClient<ResendClient>(client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddTransient<IEmailSender<AppUser>, ResendEmailSender>();
builder.Services.AddScoped<OrderConfirmationEmail>();
builder.Services.AddScoped<PassEmail>();
builder.Services.AddSingleton<PassQueue>();
// GPX only: Strava exports are up to 800 KB of repetitive XML. No secrets in them, so no BREACH angle.
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.MimeTypes = ["application/gpx+xml"];
});
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Caddy sits on the internal docker network, so any peer may set the forwarded headers.
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost };
forwarded.KnownNetworks.Clear();
forwarded.KnownProxies.Clear();
app.UseForwardedHeaders(forwarded);
app.UseResponseCompression();
// One canonical URL for the shell.
app.Use((ctx, next) =>
{
    if (ctx.Request.Path != "/index.html") return next();
    ctx.Response.Redirect("/", true);
    return Task.CompletedTask;
});
var hashed = new System.Text.RegularExpressions.Regex(@"-[A-Z0-9]{8}\.(js|css)$");
// HTML is never served stale; the SEO fallback below owns "/" so UseDefaultFiles is not used.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var name = ctx.File.Name;
        if (name.EndsWith(".html")) ctx.Context.Response.Headers.CacheControl = "no-cache";
        else if (hashed.IsMatch(name)) ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    },
});

// CMS uploads, served read only from their own root. Separate from wwwroot because wwwroot is
// rebuilt by every deploy and this directory is a Docker volume that outlives the image.
var mediaRoot = MediaStore.Root(builder.Configuration, app.Environment);
Directory.CreateDirectory(mediaRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = MediaStore.UrlPrefix,
});

app.UseAuthentication();
app.UseAuthorization();

// Cheap liveness probe for Docker's healthcheck and for Caddy. Deliberately touches nothing.
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.MapPublicEndpoints();
app.MapOrderEndpoints();
app.MapAuthEndpoints();
app.MapAdminEndpoints();
app.MapProgrammeEndpoints();
app.MapScanEndpoints();
app.MapPassEndpoints();

// Anything that is not /api/* is an Angular route: serve index.html with per-URL head tags injected.
app.MapSeoEndpoints();

await SeedData.InitialiseAsync(app.Services);

app.Run();

// Exposed so the test project's WebApplicationFactory can find the entry point.
public partial class Program;
