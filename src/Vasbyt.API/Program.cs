using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
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

// The SPA is served from this app's wwwroot, so it is same-origin: a cookie is the whole auth story.
// No CORS, no bearer token sitting in browser storage.
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, o =>
    {
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.ExpireTimeSpan = TimeSpan.FromDays(30);
        o.SlidingExpiration = true;
        // API-only: answer with a status code rather than redirecting to a login page that isn't there.
        o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Roles.Admin, p => p.RequireRole(Roles.Admin));

builder.Services.AddHttpClient<IEmailSender<AppUser>, ResendEmailSender>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

// Cheap liveness probe for Docker's healthcheck and for Caddy. Deliberately touches nothing.
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.MapPublicEndpoints();
app.MapOrderEndpoints();
app.MapAuthEndpoints();
app.MapAdminEndpoints();

// Anything that is not /api/* is an Angular route — hand it index.html and let the router decide.
app.MapFallbackToFile("index.html");

await SeedData.InitialiseAsync(app.Services);

app.Run();

// Exposed so the test project's WebApplicationFactory can find the entry point.
public partial class Program;
