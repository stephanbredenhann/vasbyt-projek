# Vasbyt

Registration and donations for **Vasbyt** — a three-day stage event in Orania, Karoo, with two
separate disciplines (running and cycling), each offering two distances. All proceeds go to
[Orania Helpmekaar](https://oraniahelpmekaar.co.za).

This is the skeleton the real project gets built on: the domain model, the enforced business rule,
the design system and the build pipeline. Body copy is lorem ipsum wherever the wording is not
settled, and image slots are empty aspect-ratio boxes waiting for photographs.

## The registration flow

The organisers were strict about the order, and the code enforces it rather than merely presenting
it that way:

1. **How many people** — a head count, nothing else.
2. **Pay** — one flat entry fee per person, so the total is known without anyone having chosen an
   event yet.
3. **One form per person** — each entrant picks their own event and distance here, and fills in
   their details. Entrant #1's form also creates the account, and offers a *use this address for
   everyone* toggle. A tab rail across the top shows one tab per place paid for, taking on each
   person's name as their form is submitted.
4. **Done.**

Nobody creates an account before paying, and nobody adds an entrant to an unpaid order. Once paid,
an order's head count is fixed — **the wrong number means paying again**. That rule lives in exactly
one place, `OrderEndpoints.Gate()`, which every entrant in the system is created through. Three tests
in `tests/Vasbyt.API.Tests/PaymentGateTests.cs` cover it.

The flat fee is what makes "pay before choosing" possible. It lives in `Pricing:EntryFeeZar`
(default R1,200) and is applied server-side — the client never says what anything costs.

## Running it

Prerequisites: .NET 8 SDK, Node 20+.

```bash
# terminal 1 — API on :5080, creates and migrates vasbyt.db on first run
dotnet run --project src/Vasbyt.API

# terminal 2 — Angular dev server on :4200, proxies /api to :5080
cd src/Vasbyt.Frontend && npm install && npm start
```

Swagger is at `http://localhost:5080/swagger` in Development.

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

## Configuration

Nothing below is required for the demo to run. Use user-secrets or environment variables — none of
these belong in `appsettings.json`.

| Key | Effect if unset |
|---|---|
| `Seed:AdminEmail` / `Seed:AdminPassword` | No admin account is created. Set both to get one. |
| `Resend:ApiKey` | Emails are logged to the console instead of sent. |
| `GoogleMaps:ApiKey` | The address field is plain Town + Province inputs, no autocomplete. |
| `Pricing:EntryFeeZar` | R1,200 per entrant. |

```bash
dotnet user-secrets --project src/Vasbyt.API set "Seed:AdminEmail" "you@example.com"
dotnet user-secrets --project src/Vasbyt.API set "Seed:AdminPassword" "..."
```

## Layout

```
src/Vasbyt.API/        ASP.NET Core 8. Minimal APIs, EF Core, Identity. Also serves the SPA.
  Domain/              Event, EventDistance, Order, Entrant, Donation, AppUser, AppRole
  Endpoints/           One file per area; OrderEndpoints.cs holds the payment gate
  Routes/              Strava GPX exports, served by /api/routes/{id}/gpx
src/Vasbyt.Frontend/   Angular 20, standalone components, signals, zoneless
  styles/              Design tokens and base CSS — no component library
  core/                API client, auth, guards, flow state
  i18n/                Afrikaans and English dictionaries + the runtime toggle
  shared/              Province map, route map, elevation profile, address input
tests/                 xUnit over an in-memory SQLite database
```

Auth is ASP.NET Core Identity with a **cookie** — the SPA ships inside `wwwroot`, so it is
same-origin and there is no CORS and no token in browser storage. Roles are `Admin` and
`Participant`; `/api/admin/*` requires `Admin`.

## Design

Colours are taken from oraniahelpmekaar.co.za: `#F26624` (their link and CTA orange) and `#2A3B90`
(their form-button blue), set alongside Karoo sandstone, clay and stone. Montserrat for UI, Roboto
Slab for headings — both already used by the parent site.

House rules: **no gradients, no glowing buttons, no emoji.** Flat fills, 2px radii, one shadow token,
generous whitespace. Tokens live in `src/Vasbyt.Frontend/src/styles/_tokens.scss`; change them there
and the whole site follows.

Afrikaans is the default; the EN toggle in the header switches at runtime through two flat
dictionaries in `src/app/i18n/`. Angular's built-in `$localize` needs one build per locale, which
cannot switch at runtime, so it is not used.

## Privacy (POPIA)

The homepage map is fed by `/api/registrations/by-province`, which returns nothing but a province
name and a count. No name, town or coordinate is exposed by it — by construction, not by filtering.
Town is collected on the entrant form for the organisers, and never leaves the server for the map.

With `GoogleMaps:ApiKey` set, what an entrant types into the address field is sent to Google. Leave
it unset and nothing leaves the page until the form is submitted.

## Known gaps

Each is marked with a `ponytail:` comment where it belongs in the code.

- **Payments are a demo button.** `pay-demo` sets `Paid` directly. Swap in the processor's redirect
  and a signed webhook; keep the `Paid` transition in that one method.
- **SQLite, not Postgres.** For the VPS: add `Npgsql.EntityFrameworkCore.PostgreSQL`, change the one
  `UseSqlite` in `Program.cs` to `UseNpgsql`, and regenerate the migrations. Entity configuration is
  already provider-agnostic. Note that `/api/admin/stats` aggregates money in memory *because*
  SQLite cannot translate a decimal `SUM`; on Postgres it can go back to SQL.
- **The route GPX is a placeholder.** `src/Vasbyt.API/Routes/hardloop-kort.gpx` is a synthetic loop
  around Orania so the routes page has something to draw. Replace the file, keep the name — or set
  `EventDistance.GpxFileName` for the other three.
- **Entrants cannot edit themselves.** A submitted entrant is read-only to the person who entered
  them; admins can edit via `PATCH /api/admin/entrants/{id}`. Add an owner-scoped endpoint when
  fixing a typo without phoning the organisers matters.
- **No refunds, transfers, waitlists or coupon codes.** Not asked for yet.
