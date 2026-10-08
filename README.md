# Vasbyt

For the finished local demonstration, including editable programme and QR check-in, see [the demo guide](docs/DEMO.md). Start it with `./scripts/run-demo.sh`.

Registration, shop and donations for **Vasbyt**. A three-day stage event in Orania, Karoo, across
three disciplines (running, cycling and walking) in six route categories. All proceeds go to
[Orania Helpmekaar](https://oraniahelpmekaar.co.za).

Built against the organisers' own documents in `sources/`: the functional description, the
developer diagram, the 2026 management report and the 2026 brochure. Route names, distances,
per-day breakdowns, the programme, the terms and the photographs all come from the brochure.

## Shop and registration

The standalone shop and event registration share one basket. Buyers can purchase products without
event tickets, add tickets to a shop basket, or add products during registration. Products are
collection only. Shipping and a real payment provider are outside this build.

Checkout supports guests, with optional sign-in or account creation. A signed-in buyer owns new
orders automatically. A guest can explicitly link an order from its private receipt after signing
in. Password recovery requires configured email delivery and a trusted HTTPS public origin.

Saved pending orders have their own private payment links. They can be edited before payment,
with version checks to prevent an older page from overwriting newer changes. Retrying the same
submission reuses its order. Payment checks the reviewed order version and total, as well as current
prices and tracked stock.

## The registration flow

One buyer can combine several participants, routes and tariff groups in a single order:

1. **Choose.** A 6 x 2 grid, six route categories against the student/scholar and normal tariff
   groups, with a quantity per cell. The spec is explicit that nobody should pick their tariff on a
   separate screen first.
2. **Products and basket.** Products and a donation are optional and appear as separate order lines.
3. **Checkout.** Buyer contact details and the full cart. The order is created *here*, before the
   payment portal, so an interrupted payment can be resumed rather than rebuilt. It gets a
   reference like `VB-2027-000123`.
4. **Pay.**
5. **One form per ticket.** Payment creates one participant form per ticket bought, each already
   bound to its route and tariff. A tab rail shows one tab per ticket, taking on each person's name
   as their form is submitted.
6. **Done.** Each participant gets a unique entry number. Product-only and donation-only orders
   go directly to their receipt without participant forms.

Nobody adds a participant to an unpaid order, no order can hold more participants than it paid for,
and **a form can never change its own route or tariff**. A paid R165 student ticket cannot be
walked up to a R560 route afterwards. That rule lives in exactly one place,
`OrderEndpoints.Gate()`, the only method in the codebase that constructs an `Entrant`.
`tests/Vasbyt.API.Tests/PaymentGateTests.cs` covers it.

An order paid with its forms still blank is a normal state, not an error: the order is marked paid
and the participant profiles incomplete, and admin can follow them up.

Prices are resolved server-side from `PricingRule` rows by tariff kind and today's date. The client
never says what anything costs. Admin edits the rules, so a fee change needs no redeploy.

## Running it

Prerequisites: .NET 8 SDK, Node 20+, Docker (for the Postgres database).

```bash
# terminal 0 — Postgres on 127.0.0.1:5432, same image as the VPS
docker compose up -d

# terminal 1 — API on :5080, runs migrations and the seed on first start
dotnet run --project src/Vasbyt.API

# terminal 2 — Angular dev server on :4200, proxies /api to :5080
cd src/Vasbyt.Frontend && npm install && npm start
```

Swagger is at `http://localhost:5080/swagger` in Development.

If the API starts with `relation "AspNetRoles" already exists`, your database predates the current
migration set. The domain was rebuilt against the organisers' functional description and the
migrations were regenerated from scratch, so an older database cannot be migrated forward. Drop it
and let the API recreate it. There is nothing in it but seed and test data:

```bash
docker compose down -v && docker compose up -d
```

To run it as one process the way production does:

```bash
dotnet publish src/Vasbyt.API -c Release -o out
cd out && dotnet Vasbyt.API.dll        # serves the API and the SPA on the same origin
```

`dotnet publish` builds the Angular app into `src/Vasbyt.API/wwwroot` automatically. Skip that with
`-p:SkipFrontend=true`. `dotnet run` and `dotnet test` never wait on npm.

```bash
dotnet test
```

### Payments (Kwik)

The pay button redirects to a [Kwik hosted checkout](https://docs.kwik.co.za/v2/money-in/checkout-link).
Kwik sends the buyer back to `/bestel/{token}/betaal?kwik=terug` and also calls
`/api/payments/kwik/webhook`. Neither is trusted: both only make the API look the transaction up at Kwik
by the order reference and mark it paid when it is `PAID` for the full total. Keys stay out of the repo:

```bash
dotnet user-secrets --project src/Vasbyt.API set "Kwik:ApiKey" "<key>"
dotnet user-secrets --project src/Vasbyt.API set "Kwik:ApiSecret" "<secret>"
dotnet user-secrets --project src/Vasbyt.API set "Public:BaseUrl" "https://<public host>"
```

`Public:BaseUrl` must be reachable by Kwik for the webhook; locally the redirect back still verifies.
Receipts go out through Resend once `Resend:ApiKey` is set and `Public:BaseUrl` is https.

## Configuration

The admin console needs an admin account, so `Seed:AdminEmail` and `Seed:AdminPassword` are worth
setting before a demo. The rest are optional. Use user-secrets or environment variables, none of
these belong in `appsettings.json`.

| Key | Effect if unset |
|---|---|
| `Seed:AdminEmail` / `Seed:AdminPassword` | No admin account is created. Set both to get one. |
| `Resend:ApiKey` | Email delivery and password recovery are unavailable. Private recovery links are never logged. |
| `Resend:From` | Set a verified sender for email delivery. |
| `Public:BaseUrl` | Set the trusted HTTPS website origin for email links and password recovery. |
| `GoogleMaps:ApiKey` | The address field is plain Town + Province inputs, no autocomplete. |
| `Content:Root` | Uploads land in `<contentroot>/content-media` and are served at `/media`. |

### Email (Resend)

All mail goes through one client (`Services/ResendClient.cs`): account recovery, order confirmations and the
QR pass emails. Each entrant gets their pass when their form is completed, with a copy to the buyer when the
address differs, and admins can resend from the entrants list. Retries cover 429 and 5xx (3 attempts).

- Environment variables: `Resend__ApiKey` and `Resend__From` (compose: `RESEND_API_KEY`, `RESEND_FROM`), plus `Public__BaseUrl` for links (compose: `PUBLIC_BASE_URL`, required: compose refuses to start without it).
- Without an API key, Development logs the recipient and subject and carries on; other environments log an error and send nothing.
- In Resend, add and verify the sending domain, then publish the SPF and DKIM records it shows. Send from a
  subdomain such as `mail.vasbyt.co.za` to keep the root domain's reputation separate, and set `RESEND_FROM`
  to an address on that verified domain (the default `geenantwoord@vasbyt.co.za` only works if that exact domain is verified).
- Add DMARC: a TXT record at `_dmarc` with `v=DMARC1; p=none; rua=mailto:dmarc@your-domain`, and tighten `p` once reports look clean.
- Test delivery without a real inbox using `delivered@resend.dev` as the entrant or buyer email.

```bash
dotnet user-secrets --project src/Vasbyt.API set "Seed:AdminEmail" "you@example.com"
dotnet user-secrets --project src/Vasbyt.API set "Seed:AdminPassword" "..."
```

The account is created on the next start, and only if that email does not already exist. Two things
will silently leave you without one:

- **User-secrets only load in Development.** `dotnet run` picks up `Properties/launchSettings.json`,
  which sets `ASPNETCORE_ENVIRONMENT=Development`. Add `--no-launch-profile`, or run the published
  build, and you are in Production: the secret store is not read, no admin is created, and sign-in
  answers `401` with no hint as to why. In production set real environment variables instead.
- **The password must satisfy Identity.** At least 8 characters with an uppercase, a lowercase and a
  digit. `Program.cs` only relaxes `RequireNonAlphanumeric`. A rejected password fails silently at
  seed time, because `SeedData` does not throw on a failed `CreateAsync`.

To confirm it worked:

```bash
curl -s -X POST http://localhost:5080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'
```

A `200` returns the user with `"roles":["Admin"]`.

## Layout

```
src/Vasbyt.API/        ASP.NET Core 8. Minimal APIs, EF Core, Identity. Also serves the SPA.
  Domain/              RouteCategory, RouteDay, PricingRule, Order, OrderLine, Entrant,
                       Product, ProductVariant, Advert, AppUser, AppRole
  Endpoints/           One file per area; OrderEndpoints.cs holds the payment gate
  Routes/              Strava GPX exports, served by /api/routes/{id}/gpx
src/Vasbyt.Frontend/   Angular 20, standalone components, signals, zoneless
  styles/              Design tokens and base CSS — no component library
  core/                API client, auth, guards, flow state
  i18n/                Afrikaans and English dictionaries, split per page area, + the toggle
  shared/              Province map, route map, elevation profile, address input
tests/                 xUnit over a throwaway Postgres container (Testcontainers)
```

Auth is ASP.NET Core Identity with a **cookie** — the SPA ships inside `wwwroot`, so it is
same-origin and there is no CORS and no token in browser storage. Roles are `Admin` and
`Participant`; `/api/admin/*` requires `Admin`.

## Design

Colours come from the official 2026 brochure, not from the parent site: indigo `#4F54A6` with
`#3C439F` and `#1D1E58`, orange `#F0511A`, over Karoo sandstone, clay and stone. Oswald for
headings, which is the condensed uppercase the VASBYT wordmark is set in, and Montserrat for body.

Note that `#F0511A` is only 3.6:1 on white. It is a **fill that carries dark text**, never a
background for white text, and `--orange-ink` is the darkened version for orange text on a light
ground.

House rules: **no gradients, no glowing buttons, no emoji.** Flat fills only. The natural, unboxy
feel comes from tone, radius, whitespace and soft shadow instead:

- The page ground is `--canvas`, a warm off-white, **not** white. That is the whole trick: a white
  card separates from it by tone, so cards need no border. A card never gets one.
- A radius scale, not one value, ending in `--r-pill` for chips and buttons.
- A shadow scale tinted with `--indigo-deep` rather than black, which is what reads as natural
  rather than grey.
- `.torn` draws the brochure's organic section edge as a flat-fill `mask-image`. It is only visible
  where two flat fills meet, so sections alternate canvas, sand, canvas.
- `.badge` is the brochure's filled circle around a figure; `.chip` is its pill.
- Hairline borders survive in exactly four places, all earning it: form controls, table rows and
  data lists, `.btn--ghost`, and the mobile nav's group divider.

Tokens live in `src/Vasbyt.Frontend/src/styles/_tokens.scss`; change them there and the whole site
follows. There are no SCSS variables or mixins anywhere, only CSS custom properties, so a token
swap propagates at runtime.

Afrikaans is the default; the EN toggle in the header switches at runtime through dictionaries in
`src/app/i18n/`, split one file per page area so parallel work does not collide. Angular's built-in
`$localize` needs one build per locale, which cannot switch at runtime, so it is not used.

## Privacy (POPIA)

The homepage map is fed by `/api/registrations/by-province`, which returns nothing but a province
name and a count. No name, town or coordinate is exposed by it — by construction, not by filtering.
Town is collected on the entrant form for the organisers, and never leaves the server for the map.

With `GoogleMaps:ApiKey` set, what an entrant types into the address field is sent to Google. Leave
it unset and nothing leaves the page until the form is submitted.

## Known gaps

Each is marked with a `ponytail:` comment where it belongs in the code.

- **Kwik and the demo button live side by side.** Kwik turns on when `Kwik:ApiKey`, `Kwik:ApiSecret`
  and `Public:BaseUrl` are set; `Payments:DemoEnabled=false` removes the demo button. Each pay click
  makes a fresh checkout link, so a buyer paying two tabs is refunded by hand.
- **The route GPX is a placeholder.** `src/Vasbyt.API/Routes/hardloop-kort.gpx` is a synthetic loop
  around Orania so the routes page has something to draw. Replace the file, keep the name, or set
  `RouteCategory.GpxFileName` for the other five. The brochure's own route maps sit in
  `src/Vasbyt.Frontend/public/roetes/` as the fallback until real exports arrive.
- **Walks share the run routes.** Ligstap uses the Ligdraf route and Vasstap the Vasbyt route
  (`RouteCategory.SharesRouteWithId`): same days, figures and GPX, but separate events with their own entries and entrant lists (the price is per tariff, so run and walk cost the same).
  Edit the days on the run category.
- **The 2027 dates are unknown.** The sources only give 30 April to 2 May 2026. Anywhere a 2027 date
  is shown it is marked as to be confirmed.
- **Tracked stock is deducted at simulated payment.** Existing variants stay untracked until an
  admin enables tracking. Payment prevents two buyers from taking the last tracked item, and stale
  admin edits cannot restore sold stock. A real asynchronous payment provider will need stock
  reservation, expiry and reconciliation before charging buyers.
- **Entrants cannot edit themselves.** A submitted entrant is read-only to the person who entered
  them; admins can edit via `PATCH /api/admin/entrants/{id}`. Add an owner-scoped endpoint when
  fixing a typo without phoning the organisers matters.
- **No refunds, transfers, waitlists or coupon codes.** Not asked for yet.

## SEO

No Node SSR. `src/Vasbyt.API/Endpoints/SeoEndpoints.cs` serves every non-API, non-file path from `wwwroot/index.html` (cached, reloaded in Development) and injects per URL into `<head>`: title, description, canonical (`Public:BaseUrl`, else the request host), Open Graph and Twitter tags, and JSON-LD (Organization and WebSite on home, SportsEvent with offers on home and route pages, ItemList of Products on `/winkel`, BreadcrumbList). A hidden summary goes inside `<vb-root>` and Angular replaces it on boot. Private routes get `noindex`; unknown route codes and paths return 404 with the shell. `/sitemap.xml` and `/robots.txt` are generated. FAQPage is intentionally not emitted (Google restricts FAQ rich results).

To add a public page: add its route in `app.routes.ts`, a row in `Pages` in `SeoEndpoints.cs` (it then appears in the sitemap), and its title and `seo.*` description keys in `core/seo.service.ts` and the `nav.ts` i18n files. To make a new route private, add its first segment to `PrivateRoots`.
