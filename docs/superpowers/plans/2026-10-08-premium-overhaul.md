# Premium overhaul plan (2026-10-08)

Branch `feature/premium-overhaul` off `main`. No co-author lines in any commit.
Audience: mostly older people. Ease of use beats spectacle everywhere.
Hard rules: do not change colours; no em/en dashes in copy or comments; one-line comments; no top-edge accent strips on cards; af and en i18n kept in sync.

## Decisions (from the user)
- Walk routes share the run routes: Ligstap uses Ligdraf's route, Vasstap uses Vasbyt's. Still separate events, prices and entrant lists. Walks open for sale. One card/page per shared route with a Run/Walk switch.
- QR emails: each entrant gets their own QR email when their form is submitted (if an email was given); the buyer gets a copy of each one; account page lists all passes.
- SEO: the API injects per-URL head tags (title, description, canonical, OG/Twitter, JSON-LD) and a crawlable summary into index.html; sitemap.xml and robots.txt. No Node server.
- User-side features: home countdown plus an "Add to calendar" (.ics) button. Nothing that gets in the way.

## Work packages
| WP | What | Implementer | Reviewer |
|----|------|-------------|----------|
| 1 | Shared walk/run routes | Sonnet | Opus |
| 2 | Shop stock on hand hides sold-out options | Haiku | Sonnet |
| 3 | Resend + server QR emails (entrant + buyer copy), My passes | Sonnet | Opus |
| 4 | Admin scan: full person view, order ref, items, same-order dropdown | Sonnet | Opus |
| 5 | SEO: head injection, JSON-LD, sitemap, robots, client Title/Meta | Sonnet | Opus |
| 6 | Countdown + add to calendar | Haiku | Sonnet |
| 7 | Premium visual + motion + mobile pass (Apple HIG, no colour change) | Sonnet | Opus |
| 8 | SA peer research write-up `docs/IMPROVEMENTS.md` | Haiku | Opus (me) |

Order: 1 and 2 in parallel (disjoint files), then 3, then 4, then 5 and 6, then 7 last (it touches every template), then 8. Commit after each WP passes review, build and tests.

### WP1 shared routes
Add nullable `SharesRouteWithId` (FK to RouteCategory) on RouteCategory. When set, public/admin route DTOs return the source's days, distances, climb, difficulty and GPX; admin edits route data only on the source. Migration also updates existing rows: ligstap -> ligdraf, vasstap -> vasbyt, IsOpen true, distances copied. Seed matches. GPX endpoints resolve through the source. Frontend: routes page and home show three route cards (Ligtrap, Vastrap, cycling unchanged; Ligdraf/Ligstap; Vasbyt/Vasstap) where shared routes get a Run/Walk segmented switch that changes name, blurb, price and the register deep link. Route detail for either code shows the pair with the switch. The 6x2 entry grid stays (still six events). Tests: shared GPX resolves, DTO returns source days.

### WP2 stock
Existing `Stock`/`TrackStock` on ProductVariant stays. Shop and product-chooser hide variants with TrackStock and Stock <= 0; hide a product whose active variants are all sold out. Server already rejects at payment; also reject at quote/create with a clear message. Admin: rename to "Quantity on hand" with hint "Hidden from the shop when it reaches 0. Leave off for unlimited." Public DTO: do not expose exact stock counts beyond the low-stock hint (keep "only N left" when <= 5).

### WP3 email + QR
QR PNG generated server-side (QRCoder NuGet, payload unchanged `VASBYT:{year}:{guid}`), sent as inline CID attachment (`content_id`) plus a downloadable attachment. One email per send (Resend batch drops attachments). Retry with backoff on 429/5xx, idempotency key `entrant-qr-{id}-{recipient}`. Triggered on entrant form completion: to the entrant email (if present and differs from buyer) and to the buyer. Existing order confirmation stays. Email HTML: table layout, inline styles, af/en by order language if known else af, brand colours. Config `Resend:ApiKey`, `Resend:From`; when ApiKey missing in Development log the email instead of failing. Admin "resend pass" action on an entrant. Account page "My passes": one card per entrant with QR, name, route, entry number, larger QR on tap. Docs: DNS (SPF, DKIM, DMARC) and env vars in README/deploy.

### WP4 scan
Scan response adds: order reference, buyer name/email/phone, every order line (products with variant, qty, collected qty; donation), and siblings (other entrants on the same order and, if the order has an owner account, on other paid orders of that account) as id + name + route + checked-in flag. Scanner UI: big result card, sibling dropdown switches the shown person (GET `/api/admin/entrants/{id}` details), check-in per person, mark products collected from the same screen. Mobile first, 44px targets.

### WP5 SEO
API: replace `MapFallbackToFile` with a handler that reads wwwroot/index.html once, and for known public paths (/, /roetes, /roetes/{code}, /program, /verblyf, /borge, /oor-helpmekaar, /vrae, /skenk, /winkel) injects title, meta description, canonical (`Public:BaseUrl`), og:*, twitter:*, JSON-LD (Organization + WebSite on home, SportsEvent with offers/location/organizer on home and route pages, Product list on shop, BreadcrumbList (FAQPage intentionally skipped: Google restricts FAQ rich results)), and a `<noscript>`/hidden summary inside app root that Angular replaces. Private routes get `noindex`. `/sitemap.xml` and `/robots.txt` endpoints. Frontend: a small SeoService setting Title/Meta per route on navigation so client nav stays correct; `html lang` follows language. Tests for injection and sitemap.

### WP6 countdown + calendar
Home: calm countdown (days, hours, minutes; no seconds ticking) to day 1 start from the programme/route data, hidden after start. "Add to calendar" button producing a .ics (all three days) generated client side; also on register-done. Respect reduced motion.

### WP7 premium pass
Apply anthropics frontend-design + Emil Kowalski motion rules + Apple HIG: motion tokens (`--ease-out: cubic-bezier(.23,1,.32,1)`, 120/200/320ms), 8pt spacing rhythm, type scale with 17-18px body for older readers, 44px targets, translucent blurred sticky nav, press-scale on buttons, card hover only on hover devices, View Transitions on route change (`withViewTransitions`), reduced-motion respected, consistent radii and soft shadows. Mobile pass at 375/390/768: no horizontal scroll, bottom-safe-area, readable forms. No colour token changes. Verify in the browser with screenshots.

### WP8 research write-up
`docs/IMPROVEMENTS.md`: peer platforms reviewed, what we adopted in this branch, prioritised backlog for the rest (substitutions, waitlist, saved profile prefill, Google Wallet, WhatsApp reminders, results), with source links.

## Verification gate per WP
`dotnet build`, `dotnet test`, `ng build`, `ng test`, browser check at mobile and desktop for UI WPs, reviewer pass with findings fixed.
