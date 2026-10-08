# Shop, registration and account experience

Status: Approved for implementation on 2026-10-05. Source audit completed; implementation and runtime verification in progress.

Date: 2026-10-05

## Intent and confirmed requirements

The shop must work as an independent place to buy products and as part of event registration. A single basket must carry selections between both experiences. Account creation should fit naturally into either journey. The user confirmed that "its own signout" means standalone checkout, not a separate authentication session.

The current agent plans and checks the work. Implementation uses available GPT-6 Sol, disclosed before execution because the requested "6.1 Sol" is not available. The user authorised building after reviewing the draft.

Keep all work in the current working tree. Read Git state only. Do not stage, commit, switch branches, create worktrees, publish, or update project trackers. Preserve existing changes before editing them. User-facing writing must avoid em and en dashes; new code comments should be one line unless the explanation requires more.

## Agreed scope

- Guest checkout remains supported. Signing in and creating an account are optional conveniences.
- Collection only is confirmed by the user. Retain the existing event collection information; do not add delivery.
- Preserve payment before participant forms and one form per paid ticket, as required by the existing project specification.
- The first implementation uses the existing payment simulation. Real payment processing is a separate release dependency, not implied by a working checkout demonstration.
- Saved orders belong to accounts; cross-device synchronisation of an unsubmitted basket is outside this first release. Same-browser navigation and reload persistence are required.

## Source audit

Paths below are relative to the repository root. These are source findings, not claims of observed browser behaviour. Neither localhost:5080 nor localhost:4200 was reachable during the audit.

| Finding | User impact | Evidence | Required response |
| --- | --- | --- | --- |
| Shop component exists but has no route or navigation entry | Visitors cannot discover or use a standalone shop | `src/Vasbyt.Frontend/src/app/app.routes.ts`, `app.ts`, `pages/shop.ts` | Add a public shop and basket to desktop and mobile navigation |
| Existing shop only lists variants and links to event entry | Buying a shirt appears to require entering the event | `pages/shop.ts`, `pages/register-choose.ts` | Products must be purchasable without tickets |
| Product selection already exists in registration | Two separate selectors would drift in behaviour | `pages/register-products.ts` | Reuse one product selection component in both entry points |
| Basket already supports tickets, products and donation | A second cart model is unnecessary | `core/order-flow.service.ts` | Evolve the existing shared state |
| Basket is cleared on order creation, before payment, and review state is only in memory | Refreshing or going back can strand the buyer on an empty review page | `pages/register-review.ts` | Explicit editable basket and saved pending-order states with resume/edit actions |
| Payment route reads one localStorage token; the paid-order guard drops the URL token when redirecting | A private link can lead to a missing or different order's payment page | `pages/register-pay.ts`, `core/guards.ts` | Token-specific payment URLs, with the route token authoritative |
| Login always navigates to account/admin | Signing in interrupts shopping or checkout | `pages/sign-in.ts`, `core/guards.ts` | Validated internal return destination |
| Standalone account creation exists only in the API | New visitors have no normal create-account screen | `src/Vasbyt.API/Endpoints/AuthEndpoints.cs`, frontend routes and API client | Add an explicit create-account experience and password recovery |
| Creating an order does not use the authenticated principal | Signed-in purchases are absent from account history until separately claimed | `src/Vasbyt.API/Endpoints/OrderEndpoints.cs` | Attach new orders to the authenticated purchaser on the server |
| Claim combines login and creation after payment, even for signed-in visitors | Users re-enter passwords and cannot tell whether they are signing in or creating an account | `pages/register-done.ts`, `OrderEndpoints.cs` | Separate account actions from linking an owned private order |
| Claim checks a password directly and assigns ownership without an explicit concurrency check | Claiming needs the same authentication and race protections as login | `OrderEndpoints.cs` | Reuse normal authentication and make linking atomic |
| Account page has no pending-payment action or error/loading distinction | Returning buyers have no clear recovery path | `pages/account.ts` | Status-specific actions and explicit loading, empty and error states |
| Completion page and email use entry/participant wording for product-only orders | Shoppers receive misleading instructions | `pages/register-done.ts`, `i18n/en/registreer.ts`, `src/Vasbyt.API/Services/OrderConfirmationEmail.cs` | Order-specific confirmation and email content |
| Completion page can render a non-paid order without a status branch | An unfinished order can look successful | `pages/register-done.ts` | Render authoritative payment status before success copy |
| Confirmation can clear the global token without checking whether it belongs to this order | Viewing an older completed order can remove a newer order's resume pointer | `pages/register-done.ts` | Scope cleanup to the exact order and submitted basket revision |
| Standalone donation creates and pays in successive calls without retaining the order | Retrying a failed payment can create another order | `pages/donate.ts` | Use the shared pending-order and payment path |
| Stock zero means unlimited in the picker; the API neither checks nor decrements stock | Availability shown to buyers is unreliable | `pages/register-products.ts`, `OrderEndpoints.cs` | Define explicit tracked/untracked stock and enforce it server-side |
| Product estimate omits the donation; missing catalogue entries can disappear or show zero | Totals may disagree across steps | `pages/register-products.ts`, `pages/register-review.ts` | Shared quote and explicit invalid-line feedback |
| Basket deserialisation checks JSON syntax but not its shape | Old or corrupted storage can break the journey | `core/order-flow.service.ts` | Versioned, validated persistence and a recoverable fallback |
| Participant navigation resets unsaved fields; shared address is global module state | Switching forms loses work, and address carry-over is not scoped to an order | `pages/register-entrant.ts` | Per-order in-memory drafts, navigation protection, scoped address reuse |
| Account and admin show participant sections for shop orders | Shop orders look like incomplete event records | `pages/account.ts`, `pages/admin/admin-orders.ts` | Only show participant status when tickets exist |

## Approach decision

Recommended: one basket, one order system, and one checkout with context-sensitive screens. Shopping and event registration are different entrances to the same purchase. Existing order lines and the payment gate already support this.

Alternative: separate shop and registration checkouts sharing a basket. This offers more visual separation but duplicates validation, payment recovery, confirmation and account logic. It creates unnecessary places for totals and state to disagree.

Alternative: keep the current registration wizard and add shortcuts. This is smaller initially, but leaves shop customers inside registration terminology and retains most of the recovery problems. It does not meet the intended experience.

## Proposed customer journeys

| Starting intent | Journey | Completion |
| --- | --- | --- |
| Buy merchandise | Shop, choose variant and quantity, basket, buyer details and review, payment | Order receipt and collection instructions |
| Enter the event | Route/tariff selection, optional products, basket with optional donation, buyer details and review, payment | Paid receipt, participant forms, then passes |
| Shop first, then enter | Shop basket, "Add event entries", route/tariff selection, return to combined basket | One payment, products retained, forms only for tickets |
| Enter first, then shop | Entry selection, browse products, return to combined basket | Same order and same quantities |
| Donate | Donation selection, shared buyer/review/payment flow | Donation receipt; existing basket contents remain visible and included only through explicit review |
| Create an account first | Create account, return to initiating page or account welcome screen | Shop and event actions available without creating an order |
| Sign in during checkout | Preserve buyer edits and basket, authenticate, return to checkout | Prefill only blank fields and attach order to authenticated account |
| Guest later wants an account | Receipt, optional create account or sign in, explicit link of this order | This order appears in account history |
| Return to unpaid order | Account or private order link, review saved order, resume payment | No duplicate order or lost items |

Do not show a modal asking every visitor whether they are a shopper or entrant. Let their navigation choice establish intent. Event registration and account creation must have distinct labels in Afrikaans and English.

## Screens and navigation

- Public navigation: Shop, Basket with item count, Account/sign in, and the existing event entry action. Keep the basket accessible on a phone without opening the full menu.
- Shop: useful product images, descriptions, variant choices, prices, availability and quantity controls. A successful addition announces the variant and quantity with a link to the basket. Do not auto-navigate away on every addition.
- Reuse the current product detail dialog where appropriate, with keyboard focus restoration and a full-page route only if needed for useful shareable product links. Search/category tooling should follow actual catalogue size, not be invented for a handful of products.
- Basket: editable tickets and products grouped clearly, optional donation, subtotals and grand total, collection note, one primary checkout action, and secondary "Continue shopping" and "Add event entries" actions. Removing the final ticket must turn the order into a normal shop purchase without clearing products.
- Checkout: buyer contact details and review together. Guest remains the default path, with compact sign-in/create-account actions. Show the full authoritative amount and fulfilment information before payment.
- Replace the seven-step rail with phases appropriate to the order. Shop: Basket, Details, Payment, Confirmation. Event: Selection, Details, Payment, Participants, Confirmation. Products and donation are optional sections, not obligatory separate hurdles.
- Payment uses a private order URL, not a browser-global token alone. Revisit and refresh must show this exact saved order and its current status.
- Confirmation adapts to shop, donation, event or mixed orders. Products have collection details; only tickets have participant forms and passes. Payment received and participant details outstanding are separate statements.
- Account lists all linked purchases, pending payments, incomplete entries and completed passes. Empty history offers both shopping and event entry. Shop orders have no empty participant warning.
- Existing registration URLs and private receipt links must remain usable through compatible redirects or shared components, preserving their token and meaningful context.

## Basket and order lifecycle

1. Draft basket: shared selections, buyer draft and a revision/idempotency identity. Persist only the necessary cart and contact state; never passwords or medical/identity fields.
2. Review: ask the server for prices, totals and unavailable-line feedback. Missing prices must not become R0, and missing products must not silently disappear. Client amounts are estimates until the server confirms them.
3. Submit: create one pending order from the reviewed revision using an idempotency key. Repeating the same request returns the same order. Reusing the key with different content is rejected. Display price changes for explicit review before payment.
4. Pending: retain a snapshot and a visible resume action. Editing is allowed only before payment has started. Prefer updating the existing pending order with version checks and the same reference, rather than silently creating replacements.
5. Payment in progress: freeze the payable snapshot. A timeout is an unknown outcome until the server is checked; it is not permission to create another order or charge.
6. Paid: remove only the submitted basket revision or its exact submitted quantities. Never clear another tab's later additions or a newer basket while viewing an old receipt. The paid order stays immutable.
7. Cancelled/expired: explain the state and offer to restore selections into a draft after rechecking current availability and prices. Never mark success or resume a cancelled payment.

For the initial browser basket, synchronise storage changes between tabs and treat the latest valid revision as authoritative. Do not attempt an invisible merge of conflicting edits. Order submission, linking and payment remain safe under concurrent requests independently of browser coordination.

Signing in must preserve selections and entered buyer details. Signing out clears private buyer drafts, private order resume pointers and participant drafts while retaining product/ticket selections. Account-owned information must not remain visible after logout. A deliberate visit to a saved private link retains the existing bearer-link access semantics.

## Account behaviour and ownership

- Add dedicated sign-in, create-account and forgotten-password journeys with actionable field errors and a safe internal return URL. Never permit an external redirect from a query parameter.
- Use the existing cookie and Identity system. Preserve lockout handling in every authentication path; remove password authentication from the order-claim endpoint once the normal auth flow replaces it.
- Creating an order while signed in sets ownership from the authenticated principal. Buyer email is a contact address, not proof of account ownership.
- Linking a guest order requires authenticated identity plus possession of its private token and an explicit action. Never attach historical orders merely because their buyer email matches an account email.
- Linking is atomic. Repeating a link to the same account is harmless; linking an order owned by a different account is refused. Never change the active account silently from an order form.
- Password recovery uses expiring, single-use Identity reset tokens and existing email infrastructure. Preserve the basket and return context without exposing private order tokens in third-party URLs. Do not claim an email was delivered when delivery failed or is disabled.
- Keep private order responses uncached. Avoid leaking private tokens into analytics, logs or external referrers from the new pages.

## Inventory and collection

Confirmed first release: collection only, with an explicit statement that a product purchase does not require an event ticket. Retain the current event collection copy; do not invent dates or addresses.

Replace ambiguous zero stock with an explicit tracked/untracked inventory mode. For tracked products zero means sold out; for untracked products display no finite-stock promise. Preserve existing stock values and require an explicit migration policy for old records rather than interpreting every zero as sold out or unlimited without review.

For the current simulated payment, check and decrement tracked stock atomically in the same transaction as the first Paid transition. If any line fails, neither payment state nor any stock changes persist. Concurrent payment retries must not decrement twice. Pending orders do not reserve stock and the UI must state that availability is checked again at payment.

A real payment provider requires an additional reservation/expiry/release design before charging: reserve before redirect, consume on verified success, release safely on cancellation/expiry, and reconcile late or repeated callbacks. Do not deploy the demo stock approach unchanged for asynchronous real charges.

Collection needs a minimal admin view of product quantities by variant and order, with outstanding/collected status separate from payment and participant completion. If partial collection is required, record collected quantities per product line; do not overload registration QR check-in as merchandise collection. Confirm the operational requirement before expanding fulfilment tooling.

## Registration usability and recovery

- Keep route and tariff bound to paid tickets; create no entrant forms for products or donations.
- Explain before payment that each event ticket needs participant details afterward, and show the number of forms remaining after payment.
- Offer "I am this participant" to copy buyer contact details deliberately. Do not assume the buyer is the first entrant or copy personal/medical fields to everyone.
- Scope temporary drafts and shared address data to the order and participant. Preserve drafts across participant tabs in memory and warn before navigation that discards unsaved work. Do not store sensitive drafts in localStorage. Server-side save-for-later of partial forms can be separately specified if required.
- Show invalid fields next to the inputs, focus the first error, preserve values after a failed request, and give clear saved feedback. Submitted forms retain their existing edit policy until explicitly expanded.
- Distinguish loading, empty content, unavailable products, offline/fetch failure, validation rejection, cancelled order and payment retry. Give each state an appropriate next action.
- Check Afrikaans and English at every step, keyboard-only use, dialog focus, screen-reader announcements, reduced motion, touch targets, zoom and small screens. Avoid colour-only status indicators.

## Proposed implementation sequence and review points

This is the release breakdown for design review, not yet the detailed implementation task plan.

| Slice | Responsibility and main files | Review condition |
| --- | --- | --- |
| 1. Shared basket and quoting | `core/order-flow.service.ts`, `core/api.models.ts`, `core/api.service.ts`, `OrderEndpoints.cs`; new basket/quote tests | Valid persistence, one price calculation, grouped quantities, no silent invalid-line loss |
| 2. Public shop and basket | `pages/shop.ts`, `pages/register-products.ts`, new shared product selector and basket page, `app.ts`, `app.routes.ts`, AF/EN dictionaries | Shop-only and both shop/registration directions preserve all selections |
| 3. Checkout and payment recovery | `pages/register-review.ts`, `pages/register-pay.ts`, `pages/donate.ts`, `core/guards.ts`, `pages/steps.ts`, `OrderEndpoints.cs`, additive schema changes if needed | Idempotent order creation, explicit order URLs, safe editing/retries and concurrency |
| 4. Accounts and ownership | `AuthEndpoints.cs`, order linking, auth service/guards, sign-in/create-account/recovery pages, `pages/account.ts` | Context restored, existing/new/guest users work, ownership cannot be stolen |
| 5. Completion and registration | `pages/register-done.ts`, `pages/register-entrant.ts`, `pages/entrant-tabs.ts`, confirmation email service, AF/EN copy | Honest status, no event forms for shoppers, safe draft navigation and correct emails |
| 6. Stock and collection | Product entities/contracts, public/admin product endpoints and UI, payment transaction, admin order view | Last-item races cannot oversell; fulfilment is distinct from payment and entry status |
| 7. Full journey review | Existing and new API, unit and browser tests; demo documentation | Whole journey passes on phone and desktop in both languages |

The planner reviews each implemented slice before the next dependent slice proceeds, then performs the final walkthrough. The implementer must accommodate concurrent user edits and leave all changes unstaged.

## Acceptance checks

1. Guest buys only merchandise, with no event ticket or participant form required.
2. Guest buys products, adds event tickets, and pays once for the unchanged combined basket.
3. Entrant adds products through either shop entrance; quantities are shared, not duplicated.
4. Removing all tickets preserves products and removes participant steps.
5. Creating an account before shopping creates no order and returns to the initiating page.
6. Sign-in or account creation midway through checkout preserves basket, buyer edits, language and destination.
7. Signed-in checkout automatically appears in account history, including pending payment.
8. Guest receipt can be linked through both new and existing accounts; an existing owner's order cannot be reassigned.
9. Refresh, browser back, multiple tabs, failed requests and a blocked/corrupt storage environment have recoverable behaviour.
10. Repeated submit creates one pending order; repeated payment creates one paid transition and one set of forms.
11. Opening an old private order link never pays another order or clears a newer basket/resume state.
12. Cancelled and pending orders never render as successful purchases, including direct confirmation URLs.
13. Price changes, deleted/inactive variants and stock changes are explained before payment, preserving unaffected lines.
14. Concurrent buyers of the last tracked item cannot both pay; failed mixed-item orders leave stock unchanged.
15. Product-only, donation-only, ticket-only and mixed confirmations and emails use the correct instructions.
16. Participant tab changes preserve in-memory drafts; leaving warns appropriately; address reuse cannot cross orders.
17. Logout removes private account data from current screens and drafts while retaining non-private basket selections.
18. Mobile and desktop navigation, checkout and recovery work in Afrikaans and English, with keyboard and screen-reader checks.
19. Existing payment-gate, QR, order-email, admin and programme tests continue to pass.

Validation commands after implementation: `dotnet test Vasbyt.sln`; frontend `npm run build`; frontend `npm test -- --watch=false --browsers=ChromeHeadless`; frontend `npm run test:e2e` against the isolated demo. Record actual results and any environment blockers. Do not report these checks as run during this planning audit.

## Execution decisions

1. The user confirmed collection only and authorised building on 2026-10-05.
2. Implement the proposed guest-friendly shared checkout and preserve payment before participant details.
3. Retain the local payment simulation. A production payment release still requires a chosen provider and complete reservation/callback lifecycle.
4. Use available GPT-6 Sol for implementation, with planning and review in the parent session, as disclosed at the start of execution.

The implementation plan is `docs/superpowers/plans/2026-10-05-shop-registration.md`. Its file ownership, tests and review gates apply to this build.
