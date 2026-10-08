# Shop and Registration Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development or superpowers:executing-plans, with user instructions taking precedence. Never mutate Git state. The user authorised execution on 2026-10-05 and selected planning/review here with Sol implementation.

**Goal:** Deliver a collection-only public shop, shared basket and checkout, natural optional accounts, and dependable registration and payment recovery.

**Architecture:** Keep the existing Angular signal basket and ASP.NET order lines. Add shared quote/checkout screens, token-addressed pending orders, authenticated ownership, and transaction-safe stock changes. Reuse the current payment simulation and paid-ticket gate.

**Tech Stack:** Angular 20, TypeScript, ASP.NET Core 8, Identity cookies, EF Core with PostgreSQL, xUnit, Karma/Jasmine and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-shop-registration-design.md`

## Global constraints

- Collection only; no delivery fields or shipping integrations. Existing event collection location copy is retained without inventing dates.
- Work in this checkout. Git is read-only. Never stage, commit, reset, restore, switch, push or create a worktree. No project tracker writes or AI attribution.
- Preserve concurrent edits. Use patches and make a filesystem backup before any replacement of existing modified content.
- Afrikaans default, English parity; existing visual tokens, no gradients or new UI libraries.
- Guest checkout remains available, participant forms require payment, and only tickets produce participant forms.
- Existing private links remain usable. Payment is the existing local simulation; no real processor integration or deployment.
- No em or en dashes in new prose; new code comments are one line unless necessary.

## Review focus

- Old receipt opened while a newer basket exists: neither the newer basket nor its pending-order pointer is cleared (Task 3).
- Double submit or a lost response: retry the same operation and return the same order (Tasks 1 and 3).
- Sign-in halfway through checkout with edited contact details: preserve edits and return locally (Tasks 2 and 3).
- Last tracked item bought concurrently: exactly one order pays, with no partial decrements (Task 1).
- Wrong or stale order token, cancelled order, or disabled demo payment: do not display success or redirect to a different order (Tasks 1 and 3).

## Task 1: Order, inventory and account server contracts

**Owner:** Sol backend implementer. Owns `src/Vasbyt.API/**` and `tests/Vasbyt.API.Tests/**`. Do not edit frontend or documents. No subagents.

**Files:** Order/auth/public/admin endpoints, entities, DbContext, additive migrations and snapshot, confirmation email and email sender; new focused checkout/ownership/stock tests.

**Interfaces to expose:**

```text
POST /api/orders/quote
  input: existing ticket/product/donation request fields (buyer may be blank for a quote)
  output: { lines: [{kind,description,quantity,unitPriceZar,lineTotalZar,productVariantId?,routeCategoryId?,tariffKind?}], totalZar }
  invalid lines: 400 Problem with useful detail; never omit or price them at zero

POST /api/orders
  input: existing CreateOrderRequest plus optional checkoutKey (UUID string)
  repeat of same key and same normalised payload returns same order; differing payload returns 409
  ownership comes from authenticated user, never a client userId

PUT /api/orders/{token}
  input: same buyer/cart fields plus version; optional expectedTotalZar
  only Pending editable, atomically version checked, retain reference
  output: Order

POST /api/orders/{token}/link (authenticated)
  explicit private-token claim to signed-in account; same owner is idempotent, other owner 409

POST /api/orders/{token}/pay-demo
  new UI sends {version,expectedTotalZar} from the displayed order
  stale Pending intent returns 409; already-Paid retries remain idempotent
  bodyless legacy calls remain compatible

Order response additions:
  buyerPhone, version, lines[].productVariantId, lines[].routeCategoryId,
  lines[].collectedQuantity (products only, default 0)

Product variant addition: trackStock: boolean (default false for legacy data)
Admin variant save addition: trackStock: boolean = false for old clients
Admin variant edits also carry the latest version to protect stock decrements from stale form saves.

POST /api/auth/forgot-password {email}
  generic response for known/unknown email when delivery is configured
  503 with useful detail when recovery delivery is unavailable; do not log tokens or private links
POST /api/auth/reset-password {email,token,password}
  expiring Identity token, reject reused/invalid tokens; successful reset does not silently change active user

PUT /api/admin/orders/{id}/collection
  {lines:[{orderLineId,collectedQuantity}]} ; validate paid product lines and bounds atomically
```

- [ ] Write focused failing integration tests for shop-only quote/order/payment, authenticated ownership, quote tampering, aggregate duplicate quantity limits, create idempotency, pending edits/version, atomic linking, stock race, collection limits and password reset token semantics.
- [ ] Run the new tests against the real throwaway PostgreSQL fixture; report infra blockers if Docker access requires escalation.
- [ ] Implement quote and order pricing from a shared routine. Group duplicate variant and route/tariff rows before enforcing quantity limits. Reject negative/invalid quantities; validate buyer contact at order creation. Prevent negative or invalid prices from reaching orders.
- [ ] Add checkout key and request fingerprint persisted on orders, uniquely indexed when non-null. Use deterministic normalised input and resolve concurrent unique-key races by loading the winner. Never disclose a keyed order to a different authenticated identity; the random key is a guest capability and must not be logged.
- [ ] Add pending-order edits with concurrency checks; do not permit mutation after payment. Revalidate totals before payment and explain catalog/price changes rather than silently charging another amount. Existing requests without new optional fields remain valid.
- [ ] Preserve existing Order.Version concurrency token. Explicit account linking uses authenticated identity, checks ownership, and handles simultaneous requests with a defined 409/idempotent result. Keep legacy claim usable, but apply normal password lockout semantics and never silently switch an already authenticated identity.
- [ ] Add TrackStock default false without changing legacy stock values. For tracked variants zero is unavailable. During first payment lock the order and relevant products in a deterministic order, validate everything, decrement stock, set Paid and create participant slots in one transaction. A failed line rolls all changes back; a repeated payment does nothing twice. Do not hold a transaction during email HTTP calls.
- [ ] Expose collection quantities and owner/admin views without leaking new sensitive participant fields. Paid-only collection updates must be bounded by purchased quantity.
- [ ] Implement password recovery with existing Identity/email infrastructure; disable delivery in Demo mode, validate configured HTTPS public origin, encode tokens safely and use no-store responses. Use a tested sender for provider failures.
- [ ] Change confirmation email action text for product-only/donation-only versus event orders; show collection instructions for products and preserve existing email idempotency behaviour.
- [ ] Run `dotnet test Vasbyt.sln`, including existing payment gate, QR, CMS and email tests. Write actual API contract and validation results to the task report.

Example race assertion the new tests must cover:

```csharp
var responses = await Task.WhenAll(buyers.Select(b => b.PayAsync()));
Assert.Single(responses.Where(r => r.IsSuccessStatusCode));
Assert.Equal(0, await StockAsync(variantId));
Assert.Equal(1, await PaidOrderCountAsync(variantId));
```

## Task 2: Public shop, basket and account UI

**Owner:** Fresh Sol frontend implementer, sequential after Task 1 review. Owns `src/Vasbyt.Frontend/**`. No backend/docs edits and no subagents.

**Files:** `core/order-flow.service.ts`, `api.models.ts`, `api.service.ts`, `auth.service.ts`, `guards.ts`, `app.routes.ts`, `app.ts`; `pages/shop.ts`, `register-products.ts`, new shared product chooser and basket page; `pages/sign-in.ts`, create-account and password recovery pages; AF/EN dictionaries; unit tests.

**Interfaces:** Consume Task 1's verified API contract from its report. Keep existing basket methods usable by event selection. Add an explicit pending-order snapshot with token/version/submitted revision, a stable checkout key per submitted revision, and scoped cleanup. Routes: `/winkel`, `/mandjie`, `/bestel`, `/bestel/:token/betaal`, `/bestel/:token/klaar`, `/skep-rekening`, `/wagwoord-vergeet`, `/herstel-wagwoord`.

- [ ] Write failing signal-state tests for corrupt storage, blocked storage fallback, shop-to-event persistence, duplicate variant additions, quantity boundaries, cross-tab refresh, sign-out privacy cleanup and old-receipt/new-basket coexistence.
- [ ] Evolve the current basket state, version/validate stored payloads and keep an in-memory token fallback when storage is blocked. Preserve the current `vasbyt.cart` contents through migration. Cart changes invalidate the quote and any reused creation key as appropriate, never the saved pending order itself.
- [ ] Add public shop and basket navigation. Use one reusable product selector for standalone shop and registration. Keep selected quantities visible, respect tracked stock, use explicit loading/error/empty states, and make selection accessible in both languages.
- [ ] Basket groups tickets and products with editable quantities, optional donation, quote total and collection note. Primary action opens checkout; secondary actions return to products or add event entries. Do not require tickets for a shop checkout.
- [ ] Create account and sign-in are clearly separate. Preserve return context through either and password recovery; validate local return paths to avoid open redirects. Add useful validation/errors and disable duplicate submissions. Refresh auth state after account creation.
- [ ] Sign-out clears private drafts/pointers and sensitive screens, preserves product/ticket choices, and never leaves account data visible.
- [ ] Keep navigation and visual design consistent with current tokens and responsive layouts. Update translation key types through existing dictionary conventions.
- [ ] Run frontend unit tests and build. Report interface additions for Task 3.

State test example:

```typescript
flow.setProduct(variantId, 2);
flow.setTicket(routeId, 'Normal', 1);
expect(flow.cart().products).toEqual([{ productVariantId: variantId, quantity: 2 }]);
flow.setTicket(routeId, 'Normal', 0);
expect(flow.productCount()).toBe(2);
```

## Task 3: Unified checkout, receipts and registration recovery

**Owner:** Fresh Sol frontend implementer, sequential after Task 2 review. Owns frontend checkout/registration/account/admin fulfilment and related tests. Adapt existing components instead of leaving conflicting copies.

**Files:** `pages/register-review.ts`, `register-pay.ts`, `register-done.ts`, `register-donation.ts`, `donate.ts`, `register-entrant.ts`, `entrant-tabs.ts`, `steps.ts`, `account.ts`, `admin/admin-products.ts`, `admin/admin-orders.ts`; new checkout components if responsibilities require them; API client/models, routes and AF/EN dictionaries as needed.

- [ ] Write failing tests for direct payment tokens overriding browser pointers, pending/cancelled confirmations, retries, signed-in prefill preserving edits, linking, and participant draft isolation.
- [ ] Checkout uses a shared server quote, buyer fields, compact guest/sign-in/create-account controls and explicit collection instructions. Prefill blank fields only. Save buyer edits before auth navigation.
- [ ] Create pending orders once using the basket submission key; on retries fetch/reuse them. Navigate directly to token-specific payment after saving, with order review and edit action there. Use versioned pending edits; show changed prices for review. Prevent a saved receipt or late request from clearing later cart changes.
- [ ] Payment reloads its route token; legacy tokenless route redirects using its stored pointer. Paid routes go to the appropriate receipt/forms; cancelled/error states show useful actions and preserve context. Respect the API's demoPayments configuration.
- [ ] Simplify optional products/donation into the shared basket journey and adapt step labels to order type. Preserve old registration routes and receipt URLs through compatible routing.
- [ ] Standalone donations enter the same reviewed basket and payment path. Existing basket contents are visible before continuing; no separate hidden create-and-pay chain.
- [ ] Receipts display truthful Pending/Paid/Cancelled state, collection instructions and product quantities. Show participant next steps only for tickets. Replace combined password claim with explicit create/sign-in and authenticated linking. Preserve order context until linking completes.
- [ ] Account shows loading/error/empty states, pending payment links, order receipts, collection status and outstanding forms only where appropriate.
- [ ] Participant drafts are scoped to token and entrant in memory. Save before switching tabs, restore on return, warn on leaving the flow/reloading with unsaved data, clear on successful save/logout. Shared address is scoped to order. Add deliberate buyer-to-participant contact copy.
- [ ] Admin products can set tracked/untracked stock explicitly; admin orders can record collected product quantities. Do not label shop orders as completed participant forms.
- [ ] Run frontend tests/build and the complete browser suite after adding the new journeys. Report results and remaining issues without claiming unrun checks.

## Task 4: Independent checks, corrections and documentation

**Owner:** Planner reviews; Sol handles implementation fixes. Planner owns design/plan/demo documentation and may add independent verification artifacts under `/tmp`.

- [ ] Review backend and frontend diffs against the approved design, not only implementer summaries. Resolve concrete findings before proceeding.
- [ ] Run isolated API tests, production frontend build, unit suite and Playwright suite. Use additive migrations and isolated demo data only; never reset existing databases.
- [ ] Add browser coverage for shop-only purchase, mixed basket in both directions, account-first and checkout auth, sign-out, failed payment/retry, donation, collection, and old-link/new-basket cases. Verify keyboard flow and screenshots at phone and desktop widths in AF/EN.
- [ ] Use a fresh final reviewer for substantive bugs across the entire working-tree diff. Send findings to Sol, rerun affected checks, and inspect final Git status/reflog for concurrent operations.
- [ ] Update `docs/DEMO.md` and README journey descriptions with actual implemented behaviour and payment limitations. Update this checklist with evidence, not assumptions.
- [ ] Leave all changes unstaged and report the outcome, checks and material limitations.
