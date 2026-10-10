# Order View and Admin Ease of Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make everything a buyer sees after paying readable at a glance by an older person, and make the admin console quicker to use for organisers on and before event day.

**Architecture:** Mostly template and style work in existing Angular standalone components, plus three small API additions (paid time on the receipt, search and filters on the admin order and participant lists). No new dependencies, no new pages, no new shared components.

**Tech Stack:** Angular (standalone components, signals, Karma and Jasmine), ASP.NET Core minimal APIs, EF Core, xUnit.

**Spec:** the audit in the "Audit findings" section of this file. Each task names the findings it closes (P1 to P10 for the post-purchase view, A1 to A12 for admin).

## Model assignment

Each task carries a **Model** line. Dispatch it with the Agent tool as `model: "sonnet"` or `model: "haiku"` and `effort: "high"`.

- **Sonnet 5.5, high:** tasks that restructure a page, touch money, email or time zones, or change API queries.
- **Haiku 5.5, high:** tasks that are mechanical once the code is given: adding a field, copy, CSS sizes, small template swaps.

Run the tasks in the listed order, one at a time. They share the i18n files, so parallel runs would collide.

## Global Constraints

- **Never run any git command that changes state.** No `git add`, `commit`, `stash`, `checkout`, `restore`, `reset`. Reading (`git status`, `git diff`) is fine. Every task ends with the changes left in the working tree and a list of changed files reported back.
- No em dashes or en dashes anywhere: copy, comments, commit text. Use a comma, a period, or "to".
- Code comments are one line.
- Never put a coloured strip on the top edge of a card (no top border, no inset top shadow, no accent bar). Colour a card with a tint or its contents.
- Every new copy key goes into both `src/Vasbyt.Frontend/src/app/i18n/af/<area>.ts` and `src/Vasbyt.Frontend/src/app/i18n/en/<area>.ts`. Afrikaans is the source of truth; the build fails if an English key is missing.
- Body text on buyer-facing pages is never below `1rem`. Key facts (reference, status, totals, entry numbers) are never in `.muted` grey.
- Touch targets for primary actions are at least `48px` high on buyer pages, `44px` (`var(--touch)`) in admin.
- No new npm or NuGet packages.
- Frontend commands run from `src/Vasbyt.Frontend`. Backend tests run from the repo root.
  - Unit tests: `npx ng test --watch=false --browsers=ChromeHeadless`
  - Build: `npx ng build`
  - API tests: `dotnet test tests/Vasbyt.API.Tests`

## Review Focus

1. **Search text with mixed case** (an admin types `anna` for `Anna`, or a lowercase reference). Expect a match. Pinned in Task 6.
2. **A receipt for an order that is not paid yet** has no paid time. Expect `paidUtc: null` and no "Paid on" line. Pinned in Task 1 and handled in Task 2's template.
3. **Tariff times around midnight** (22:00 UTC is the next day in South Africa). Expect the SA date shown and saved back to the same instant. Pinned in Task 10.
4. **A stored timestamp with no zone suffix** (SQLite returns `2027-01-31T22:00:00`). Expect it read as UTC, not browser local time. Pinned in Task 10.
5. **An order with only a donation**: no forms, no passes, no collection. Expect the "What to do next" list to be hidden, not empty. Handled in Task 2 with an explicit `@if`.

---

## Audit findings

### Post-purchase: receipt page `pages/register-done.ts`, account page `pages/account.ts`, pass `shared/qr-pass.ts`, confirmation email `Services/OrderConfirmationEmail.cs`

| # | Finding | Why it hurts an older buyer |
|---|---------|-----------------------------|
| P1 | The receipt has no single summary. Reference, status, total, event dates and where the email went are spread over five blocks. | They have to scroll and assemble the picture themselves. |
| P2 | The QR passes, the thing they need on the day, sit at the bottom, below the receipt, the outstanding forms and a separate entry number card. | The most important item is the hardest to find. |
| P3 | No "what to do next" list. Forms, passes, collecting products and the calendar are separate scattered blocks with no order. | No clear sequence; easy to miss a step. |
| P4 | The page never says *when* it was paid, and the API does not return `PaidUtc`. | "Did my payment go through, and when?" is the first question. |
| P5 | The reference is set in Oswald, a condensed display face. | Condensed digits are hard to read and copy over the phone. |
| P6 | Key info is `0.9375rem` (15px) and `.muted` grey: line items, route names, collection note, pass hint, account line notes. | Small grey text is the first thing to become unreadable. |
| P7 | Dates are ISO (`2026-10-10`) on the account page; the event dates appear nowhere on the receipt. | ISO dates are not how most people read a date. |
| P8 | The entry number card duplicates the number already on each pass. | Duplication adds scroll and confusion. |
| P9 | Account page: "View receipt" is a plain text link; orders needing action are not first; status is plain text. | Actions hide; a pending payment can sit below old paid orders. |
| P10 | The confirmation email is unstyled default HTML with a text link and no plain-text alternative. The pass email is already well styled. | Small default type, no button to tap, worse deliverability without a text part. |

The email retry error also reuses the "pending" sentence (`register-done.ts:40`), so a failure looks like nothing happened.

### Admin: `pages/admin.ts` and `pages/admin/*`

| # | Finding |
|---|---------|
| A1 | The open tab lives only in memory. Refresh drops you on Overview and the back button leaves admin. |
| A2 | Nine tabs in one flat row mixing event-day jobs (Scan, Orders, Participants) with setup jobs (Programme, Products, Adverts, Tariffs, Routes). |
| A3 | Tabs use `aria-selected` on plain buttons, which is invalid without `role="tab"`. |
| A4 | Orders cannot be searched or filtered. Finding "the order Mrs X phoned about" means paging 25 at a time. |
| A5 | The orders tab counts blank forms by fetching 200 participants and grouping in the browser (`admin-orders.ts:166`). Wrong above 200 blank forms. |
| A6 | Admin cannot open what the buyer sees (receipt, passes, email retry), though `publicToken` is already returned. |
| A7 | Order line kinds show raw English enum names (`Product`, `Ticket`) in the Afrikaans UI. |
| A8 | The participant route filter only filters the page already loaded, with a hint explaining the limitation. Search ignores entry number and order reference. Search is case-sensitive on Postgres. |
| A9 | Tariff times are edited in UTC with a hint that "South Africa is two hours ahead". |
| A10 | The tariff "live" warning is permanently styled as an error. |
| A11 | Saving a participant, product, advert, route or tariff gives no confirmation; the form just closes or reloads. |
| A12 | Lists show "No orders yet" while still loading and stay silent on errors. Overview tiles are not clickable except the blank-forms one. Tables, chips and small buttons are 15px. |

The scan screen is already strong (big check-in button, medical alert, sibling picker) and is left alone.

---

### Task 1: Paid time on the order response

**Model:** Haiku 5.5, high
**Closes:** P4 (data part)

**Files:**
- Modify: `src/Vasbyt.API/Endpoints/OrderEndpoints.cs:33-35` (record) and `:580-591` (construction)
- Modify: `src/Vasbyt.Frontend/src/app/core/api.models.ts` (`Order` interface)
- Create: `tests/Vasbyt.API.Tests/ReceiptTests.cs`

**Interfaces:**
- Produces: `OrderResponse.PaidUtc` (`DateTime?`, JSON `paidUtc`), `Order.paidUtc: string | null` in TypeScript. Tasks 2 and 3 read it.

- [ ] **Step 1: Write the failing test**

Create `tests/Vasbyt.API.Tests/ReceiptTests.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;

namespace Vasbyt.API.Tests;

public class ReceiptTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Receipt_carries_paid_time_only_once_paid()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = "Koper", LastName = "Toets", Email = "kwitansie@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId("ligtrap"), TariffKind = "Normal", Quantity = 1 } },
        });
        created.EnsureSuccessStatusCode();
        var token = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();

        var pending = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.Equal(JsonValueKind.Null, pending.GetProperty("paidUtc").ValueKind);

        (await client.PostAsync($"/api/orders/{token}/pay-demo", null)).EnsureSuccessStatusCode();
        var paid = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{token}");
        Assert.True(paid.GetProperty("paidUtc").GetDateTime() > DateTime.UtcNow.AddMinutes(-5));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test tests/Vasbyt.API.Tests --filter ReceiptTests`
Expected: FAIL, `KeyNotFoundException` for `paidUtc`.

- [ ] **Step 3: Add the field**

In `OrderEndpoints.cs`, append `DateTime? PaidUtc` as the last record parameter:

```csharp
public record OrderResponse(
    Guid Token, string Reference, string Status, decimal TotalZar, DateTime CreatedUtc,
    string BuyerFirstName, string BuyerLastName, string BuyerEmail, string BuyerPhone, uint Version, bool IsClaimed,
    IEnumerable<OrderLineDto> Lines, IEnumerable<EntrantSlotDto> Entrants, DateTime? ConfirmationEmailSentUtc,
    DateTime? PaidUtc);
```

In `Load`, change the final argument line from `o.ConfirmationEmailSentUtc);` to `o.ConfirmationEmailSentUtc, o.PaidUtc);`.

In `api.models.ts`, inside `interface Order`, after `createdUtc: string;` add:

```ts
  /** Null until the payment has gone through. */
  paidUtc: string | null;
```

- [ ] **Step 4: Run the tests**

Run: `dotnet test tests/Vasbyt.API.Tests`
Expected: all PASS. Then from `src/Vasbyt.Frontend`: `npx ng build`, expected success.

- [ ] **Step 5: Stop and report**

Do not run git. Report: `OrderEndpoints.cs`, `api.models.ts`, `ReceiptTests.cs` changed.

---

### Task 2: Receipt page at a glance

**Model:** Sonnet 5.5, high
**Closes:** P1, P2, P3, P5, P6 (receipt), P7 (receipt), P8, retry error copy

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/register-done.ts` (template, styles, two computeds)
- Modify: `src/Vasbyt.Frontend/src/app/i18n/af/registreer.ts`, `src/Vasbyt.Frontend/src/app/i18n/en/registreer.ts`

**Interfaces:**
- Consumes: `Order.paidUtc` from Task 1. `I18nService.locale()` returns `'af' | 'en'`; Angular locale data for `af` is registered in `main.ts`, so `DatePipe` and `formatDate` accept `i18n.locale()` as the locale argument.

New page order inside the `@else` (paid) branch:

1. `h1` and `.lead` (unchanged).
2. **Glance card**: reference, paid status with date and time, total, event dates (entries only), where the email went.
3. **What to do next**: a numbered list, only when there is something to do.
4. **Passes** (moved up, unchanged component).
5. **Receipt lines**.
6. **Email retry** (only when not sent).
7. **Claim card** (unchanged).

The separate "entry number" card is deleted; the number is on every pass.

- [ ] **Step 1: Add copy keys**

Append to the object in `i18n/af/registreer.ts`:

```ts
  'done.glance': 'Jou bestelling in een oogopslag',
  'done.status': 'Betaling',
  'done.paidOn': 'Betaal op',
  'done.when': 'Wanneer',
  'done.to': 'tot',
  'done.datesProvisional': '(voorlopig)',
  'done.emailTo': 'E-pos gestuur na',
  'done.emailNotYet': 'Nog nie gestuur nie',
  'done.emailFailed': 'Die e-pos kon nie nou gestuur word nie. Jou bestelling is veilig. Probeer later weer.',
  'done.nextTitle': 'Wat om nou te doen',
  'done.stepForms': 'Vul die deelnemersvorms in',
  'done.stepFormsLeft': 'vorms nog oop',
  'done.stepPasses': 'Stoor of druk elke QR-pas hieronder en wys dit by die registrasietent.',
  'done.stepPassesWait': 'Die QR-passe verskyn hier sodra die vorms ingevul is.',
  'done.stepCollect': 'Haal jou produkte by die geleentheid af. Bring jou verwysingsnommer.',
  'done.stepCalendar': 'Sit die datums in jou kalender.',
  'done.receipt': 'Wat jy gekoop het',
  'done.collected': 'Afgehaal',
  'done.toCollect': 'Nog af te haal',
```

Append the same keys to `i18n/en/registreer.ts`:

```ts
  'done.glance': 'Your order at a glance',
  'done.status': 'Payment',
  'done.paidOn': 'Paid on',
  'done.when': 'When',
  'done.to': 'to',
  'done.datesProvisional': '(provisional)',
  'done.emailTo': 'Email sent to',
  'done.emailNotYet': 'Not sent yet',
  'done.emailFailed': 'The email could not be sent just now. Your order is safe. Please try again later.',
  'done.nextTitle': 'What to do next',
  'done.stepForms': 'Fill in the participant forms',
  'done.stepFormsLeft': 'forms still open',
  'done.stepPasses': 'Save or print each QR pass below and show it at the registration tent.',
  'done.stepPassesWait': 'The QR passes appear here once the forms are filled in.',
  'done.stepCollect': 'Collect your products at the event. Bring your reference number.',
  'done.stepCalendar': 'Put the dates in your calendar.',
  'done.receipt': 'What you bought',
  'done.collected': 'Collected',
  'done.toCollect': 'Still to collect',
```

- [ ] **Step 2: Add the event date computed**

In `register-done.ts`, change the `@angular/common` import to `import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';`, add `DatePipe` to `imports`, and add to the class:

```ts
  /** "29 April tot 1 Mei 2027" from the route days, in the reader's language. */
  protected readonly eventDates = computed(() => {
    const d = this.days();
    if (!d.length) return '';
    const fmt = (iso: string) => formatDate(iso, 'd MMMM y', this.i18n.locale());
    const first = fmt(d[0].dateLocal), last = fmt(d[d.length - 1].dateLocal);
    return first === last ? first : `${first} ${this.i18n.t('done.to')} ${last}`;
  });

  /** Anything left to do: forms, passes, collection or the calendar. A pure donation has none. */
  protected readonly hasNext = computed(() => (this.order()?.entrants.length ?? 0) > 0 || this.hasProducts());
```

- [ ] **Step 3: Replace the paid branch of the template**

Replace everything from `<h1>{{ i18n.t(kind() === 'event' ? 'done.title' ...` down to and including the closing `}` of the `@if (completed().length) { <section class="passes"> ... }` block with:

```html
        <h1>{{ i18n.t(kind() === 'event' ? 'done.title' : kind() === 'shop' ? 'done.shopTitle' : 'done.donationTitle') }}</h1>
        <p class="lead">{{ i18n.t(kind() === 'event' ? 'done.body' : kind() === 'shop' ? 'done.shopBody' : 'done.donationBody') }}</p>

        <section class="card glance" aria-labelledby="glance-title">
          <h2 id="glance-title" class="visually-hidden">{{ i18n.t('done.glance') }}</h2>
          <dl>
            <div>
              <dt>{{ i18n.t('pay.reference') }}</dt>
              <dd class="reference">{{ o.reference }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('done.status') }}</dt>
              <dd class="paid">
                <span aria-hidden="true">✓</span> {{ i18n.t('account.statusPaid') }}
                @if (o.paidUtc) {
                  <span class="sub">{{ i18n.t('done.paidOn') }} {{ o.paidUtc | date: 'd MMMM y, HH:mm' : '+0200' : i18n.locale() }}</span>
                }
              </dd>
            </div>
            <div>
              <dt>{{ i18n.t('reg.total') }}</dt>
              <dd>{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            </div>
            @if (kind() === 'event' && eventDates()) {
              <div>
                <dt>{{ i18n.t('done.when') }}</dt>
                <dd>{{ eventDates() }} @if (!datesConfirmed()) { <span class="sub">{{ i18n.t('done.datesProvisional') }}</span> }</dd>
              </div>
            }
            <div>
              <dt>{{ i18n.t('done.emailTo') }}</dt>
              <dd>
                {{ o.buyerEmail }}
                @if (!o.confirmationEmailSentUtc) { <span class="sub">{{ i18n.t('done.emailNotYet') }}</span> }
              </dd>
            </div>
          </dl>
        </section>

        @if (hasNext()) {
          <section class="card panel next" aria-labelledby="next-title">
            <h2 id="next-title">{{ i18n.t('done.nextTitle') }}</h2>
            <ol>
              @if (o.entrants.length) {
                <li [class.is-done]="!outstanding().length">
                  <strong>{{ i18n.t('done.stepForms') }}</strong>
                  @if (outstanding().length) {
                    <span class="sub">{{ outstanding().length }} {{ i18n.t('done.stepFormsLeft') }}</span>
                    <ul class="forms">
                      @for (e of outstanding(); track e.id) {
                        <li>
                          <span><strong>{{ i18n.t('reg.entrant') }} {{ e.n }}</strong> <span class="sub">{{ e.routeName }}</span></span>
                          <a class="btn btn--accent" [routerLink]="['/registreer', o.token, 'deelnemer', e.n]">{{ i18n.t('done.fillIn') }}</a>
                        </li>
                      }
                    </ul>
                  } @else {
                    <span class="sub"><span aria-hidden="true">✓</span> {{ i18n.t('done.allDone') }}</span>
                  }
                </li>
                <li>
                  {{ i18n.t(completed().length ? 'done.stepPasses' : 'done.stepPassesWait') }}
                </li>
              }
              @if (hasProducts()) {
                <li>{{ i18n.t('done.stepCollect') }}</li>
              }
              @if (kind() === 'event' && calendarOpen()) {
                <li>
                  {{ i18n.t('done.stepCalendar') }}
                  <button type="button" class="btn btn--ghost calendar" (click)="addToCalendar()">{{ i18n.t('common.addCalendar') }}</button>
                </li>
              }
            </ol>
          </section>
        }

        @if (completed().length) {
          <section class="passes">
            <h2>{{ i18n.t('pass.title') }}</h2>
            <p>{{ i18n.t('pass.intro') }}</p>
            @for (e of completed(); track e.id) {
              @if (e.qrPayload) { <vb-qr-pass [entrant]="e" /> }
            }
          </section>
        }

        <section class="card panel" aria-labelledby="receipt-title">
          <h2 id="receipt-title">{{ i18n.t('done.receipt') }}</h2>
          <dl class="lines">
            @for (l of o.lines; track l.id) {
              <dt>
                {{ l.quantity }} × {{ l.description }}
                @if (l.kind === 'Product') {
                  <span class="sub">{{ i18n.t(l.collectedQuantity >= l.quantity ? 'done.collected' : 'done.toCollect') }}</span>
                }
              </dt>
              <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            }
            <dt class="is-total">{{ i18n.t('reg.total') }}</dt>
            <dd class="is-total">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
          </dl>
        </section>

        @if (!o.confirmationEmailSentUtc && emailEnabled() && !outstanding().length) {
          <div class="panel">
            <p>{{ i18n.t('done.emailPending') }}</p>
            <button type="button" class="btn btn--ghost" (click)="retryEmail(o)" [disabled]="emailBusy()">{{ i18n.t(emailBusy() ? 'common.loading' : 'done.emailRetry') }}</button>
            @if (emailError()) { <p class="alert alert--error" role="alert">{{ i18n.t('done.emailFailed') }}</p> }
          </div>
        }
```

This removes: the old top calendar button, the old email-sent alert (now a glance row), the old reference/lines card, the old outstanding card, the `@else if (o.entrants.length) { done.allDone }` alert, and the entry number card. The claim block that follows stays as it is.

- [ ] **Step 4: Replace the styles**

Replace the whole `styles` string with:

```scss
    .panel, .glance, .passes { max-width: 44rem; margin-bottom: var(--space-8); }
    .glance dl { display: grid; gap: var(--space-4); margin: 0; }
    .glance dl > div { display: grid; grid-template-columns: minmax(8rem, 12rem) 1fr; gap: var(--space-4); align-items: baseline; }
    .glance dl > div + div { padding-top: var(--space-4); border-top: 1px solid var(--rule); }
    .glance dt { color: var(--ink-muted); font-size: 1rem; }
    .glance dd { margin: 0; font-size: 1.1875rem; font-weight: 600; overflow-wrap: anywhere; }
    .reference { font-size: 1.5rem; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
    .paid { color: var(--ok); }
    .sub { display: block; font-size: 1rem; font-weight: 400; color: var(--ink); }
    @media (max-width: 480px) { .glance dl > div { grid-template-columns: 1fr; gap: var(--space-1); } }

    h2 { font-size: 1.5rem; }
    .next ol { margin: 0; padding-left: 1.5rem; display: grid; gap: var(--space-4); font-size: 1.0625rem; }
    .next ol > li::marker { font-weight: 700; color: var(--indigo-deep); }
    .next .is-done > strong { color: var(--ok); }
    .forms { list-style: none; margin: var(--space-3) 0 0; padding: 0; }
    .forms li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; padding: var(--space-3) 0; border-top: 1px solid var(--rule); }
    .forms .btn, .calendar, .panel .btn { min-height: 48px; }
    .calendar { display: flex; margin-top: var(--space-3); }

    vb-qr-pass { display: block; margin-bottom: var(--space-4); }

    .lines { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-3) 0; margin: 0; font-size: 1.0625rem; }
    .lines dt { padding-right: var(--space-4); }
    .lines dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .lines .is-total { padding-top: var(--space-3); border-top: 1px solid var(--rule); font-weight: 700; font-size: 1.1875rem; }

    .claim-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
    .hint { font-size: 1rem; }
```

- [ ] **Step 5: Build and run unit tests**

Run (from `src/Vasbyt.Frontend`): `npx ng build` then `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: build succeeds, tests PASS. A template error about `hasProducts` or `routerLink` means an import was dropped; `RouterLink` must stay in `imports`.

- [ ] **Step 6: Look at it**

Start the app with the project's launch config (`preview_start`), pay a demo order with two tickets and a product, fill in one form, open `/bestel/<token>/klaar`. Check at 375px wide and at desktop width:
- the glance card is the first thing below the lead, with reference, "✓ Already paid, Paid on 10 Oktober 2026, 14:03", total, dates, email;
- "What to do next" shows one open form with a Fill in button, the pass step, the collect step and the calendar button;
- the pass for the completed form sits above "What you bought";
- switch to English: dates and copy change language.
Take a screenshot of each width for the report.

- [ ] **Step 7: Stop and report**

Do not run git. Report changed files and attach the screenshots.

---

### Task 3: Account page at a glance

**Model:** Sonnet 5.5, high
**Closes:** P6 (account), P7 (account), P9

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/account.ts`
- Modify: `src/Vasbyt.Frontend/src/app/i18n/af/rekening.ts`, `src/Vasbyt.Frontend/src/app/i18n/en/rekening.ts`

**Interfaces:**
- Consumes: `Order.paidUtc` (Task 1).

- [ ] **Step 1: Add copy keys**

`af/rekening.ts`:

```ts
  'account.needsAction': 'Aandag nodig',
  'account.paidOn': 'Betaal op',
```

`en/rekening.ts`:

```ts
  'account.needsAction': 'Needs your attention',
  'account.paidOn': 'Paid on',
```

- [ ] **Step 2: Sort orders that need action first**

Add to the class:

```ts
  /** Unpaid orders and paid orders with blank forms first, then newest first. */
  protected readonly sorted = computed(() =>
    [...(this.orders() ?? [])].sort((a, b) =>
      Number(this.needsAction(b)) - Number(this.needsAction(a)) || b.createdUtc.localeCompare(a.createdUtc)));

  protected needsAction(o: Order) {
    return o.status === 'Pending' || (o.status === 'Paid' && this.outstanding(o) > 0);
  }
```

In the template change `@for (o of orders(); track o.token)` to `@for (o of sorted(); track o.token)`.

- [ ] **Step 3: Rework the order card header and actions**

Replace the `<header>...</header>` block and the two action `@if` blocks below it with:

```html
            <header>
              <div>
                <span class="eyebrow">{{ i18n.t('account.reference') }}</span>
                <h3 class="reference">{{ o.reference }}</h3>
                <p class="facts">
                  {{ (o.paidUtc ?? o.createdUtc) | date: 'd MMMM y' : '+0200' : i18n.locale() }} ·
                  <strong>{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</strong>
                </p>
              </div>
              <span class="status" [class.status--paid]="o.status === 'Paid'" [class.status--due]="needsAction(o)">
                <span aria-hidden="true">{{ o.status === 'Paid' ? '✓' : o.status === 'Pending' ? '!' : '×' }}</span>
                {{ i18n.t(status(o.status)) }}
              </span>
            </header>

            @if (needsAction(o)) { <p class="due">{{ i18n.t('account.needsAction') }}</p> }

            <p class="actions">
              @if (o.status === 'Pending') {
                <a class="btn btn--accent" [routerLink]="['/bestel', o.token, 'betaal']">{{ i18n.t('account.payNow') }}</a>
              } @else if (o.status === 'Paid') {
                <a class="btn btn--primary" [routerLink]="['/bestel', o.token, 'klaar']">{{ i18n.t('account.receipt') }}</a>
              }
            </p>
```

- [ ] **Step 4: Update the styles**

In `styles`, replace the `.status` and `.status--paid` rules and `.block` rule with:

```scss
    .status { display: inline-flex; gap: .5rem; align-items: center; padding: .375rem .875rem; border-radius: var(--r-pill); background: var(--karoo-sand-light); font-size: 1.0625rem; font-weight: 700; color: var(--ink); }
    .status--paid { background: #edf5ed; color: var(--ok); }
    .status--due { background: #fff1e8; color: var(--orange-ink); }
    .reference { font-family: var(--font-body); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; text-transform: none; }
    .facts { font-size: 1.0625rem; margin: 0; }
    .due { font-weight: 700; color: var(--orange-ink); margin: var(--space-4) 0 0; }
    .actions .btn { min-height: 48px; }
    .block { display: block; font-size: 1rem; color: var(--ink); }
```

Also change every `class="muted block"` in this template to `class="block"`.

- [ ] **Step 5: Build, test, look**

Run: `npx ng build` and `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: PASS.
In the preview, sign in with a seeded test account that has one pending and one paid order (create them via demo checkout if none exist), open `/rekening`: the pending order is first with an orange "!" pill and a large Pay button; the paid one shows "✓ Already paid", a long-form date, and a "View receipt" button. Screenshot at 375px.

- [ ] **Step 6: Stop and report**

Do not run git. Report changed files and the screenshot.

---

### Task 4: Pass card readability

**Model:** Haiku 5.5, high
**Closes:** P6 (pass)

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/shared/qr-pass.ts`

- [ ] **Step 1: Label the entry number**

In the template replace `<strong class="pass__number">{{ entrant().entryNumber }}</strong>` with:

```html
        <p class="pass__label">{{ i18n.t('account.entryNumber') }}</p>
        <strong class="pass__number">{{ entrant().entryNumber }}</strong>
```

- [ ] **Step 2: Raise sizes and contrast**

In `styles`, replace these rules exactly:

```scss
    .pass__brand { color: var(--ev, var(--indigo)); font-weight: 700; font-size: 1rem; margin: 0 0 var(--space-3); }
    .pass__label { margin: var(--space-3) 0 0; font-size: 1rem; color: var(--ink-muted); }
    .pass__number { display: block; font-family: var(--font-body); font-size: 1.75rem; font-weight: 700; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: var(--indigo-deep); }
    .pass__hint { font-size: 1rem; color: var(--ink); max-width: 36ch; }
    .pass__actions .btn { min-height: 48px; }
```

(`.pass__actions .btn` is a new rule; keep the existing `.pass__actions` rule.)

- [ ] **Step 3: Build and test**

Run: `npx ng build` and `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: PASS (`qr-pass.spec.ts` included).

- [ ] **Step 4: Stop and report**

Do not run git. Report the changed file.

---

### Task 5: Styled confirmation email with a plain-text part

**Model:** Sonnet 5.5, high
**Closes:** P10

**Files:**
- Modify: `src/Vasbyt.API/Services/OrderConfirmationEmail.cs`
- Modify: `src/Vasbyt.API/Services/PassEmail.cs:28-29` (make the colour constants `internal`)
- Modify: `tests/Vasbyt.API.Tests/OrderEmailTests.cs`

**Interfaces:**
- Produces: `public static (string Html, string Text) OrderConfirmationEmail.Body(Order order, string link)`.
- Consumes: `PassEmail.Indigo, Deep, Orange, Canvas, Paper, Rule, Muted` as `internal const string`.

- [ ] **Step 1: Write the failing test**

Add to `OrderEmailTests`:

```csharp
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
```

Check how `ResendClient` serialises the text part (`ResendClient.cs`, around line 22 onward) and use that property name if it is not `text`.

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test tests/Vasbyt.API.Tests --filter OrderEmailTests`
Expected: the new test FAILS (no `text` property or no button style).

- [ ] **Step 3: Share the colours**

In `PassEmail.cs` change `private const string Indigo = ...` to `internal const string Indigo = ...` (same line, same values).

- [ ] **Step 4: Rewrite `Body` and pass the text part**

In `OrderConfirmationEmail.cs`, change the send call to:

```csharp
        var (html, text) = Body(order, link);
        if (await resend.SendAsync(order.BuyerEmail, $"Vasbyt 2027: {order.Reference}", html, text,
            idempotencyKey: $"vasbyt-{phase}/{order.PublicToken:D}", maxAttempts: 1)) return true;
```

Replace the `Body` method with:

```csharp
    public static (string Html, string Text) Body(Order order, string link)
    {
        static string H(string? v) => WebUtility.HtmlEncode(v ?? "");
        var en = order.Language == "en";
        string T(string af, string english) => en ? english : af;
        static string Money(decimal v) => "R" + v.ToString("N2", CultureInfo.GetCultureInfo("en-ZA"));
        var lines = order.Lines.OrderBy(l => l.Id).ToArray();
        var entrants = lines.SelectMany(l => l.Entrants).OrderBy(e => e.Id).ToArray();
        var hasTickets = lines.Any(l => l.Kind == OrderLineKind.Ticket);
        var hasProducts = lines.Any(l => l.Kind == OrderLineKind.Product);
        var demo = order.PaymentReference?.StartsWith("DEMO-", StringComparison.Ordinal) == true;
        var paid = order.PaidUtc?.AddHours(2).ToString("yyyy-MM-dd HH:mm") ?? "";

        var next = new List<string>();
        if (entrants.Any(e => !e.IsComplete))
            next.Add(T("Vul die deelnemersvorms in. Elke deelnemer kry dan 'n eie QR-pas.", "Fill in the participant forms. Each participant then gets their own QR pass."));
        else if (entrants.Length > 0)
            next.Add(T("Stoor of druk elke deelnemer se QR-pas en wys dit by die registrasietent.", "Save or print each participant's QR pass and show it at the registration tent."));
        if (hasProducts)
            next.Add(T("Haal jou produkte by die Vasbyt-geleentheid af. Bring jou verwysingsnommer. 'n Inskrywing is nie nodig nie.", "Collect your products at the Vasbyt event. Bring your reference number. You do not need an entry."));
        if (!hasTickets && !hasProducts)
            next.Add(T("Dankie vir jou donasie aan Orania Helpmekaar.", "Thank you for your donation to Orania Helpmekaar."));
        var action = hasTickets ? T("Bekyk jou bestelling en QR-passe", "View your order and QR passes")
            : hasProducts ? T("Bekyk jou bestelling", "View your order") : T("Bekyk jou kwitansie", "View your receipt");

        string Row(string label, string value, bool total = false) =>
            $"<tr><td style=\"padding:10px 0;border-top:1px solid {PassEmail.Rule};font-size:17px;color:{PassEmail.Deep}{(total ? ";font-weight:bold" : "")}\">{H(label)}</td>" +
            $"<td align=\"right\" style=\"padding:10px 0;border-top:1px solid {PassEmail.Rule};font-size:17px;color:{PassEmail.Deep};font-weight:bold;white-space:nowrap\">{H(value)}</td></tr>";
        var rows = string.Concat(lines.Select(l => Row($"{l.Quantity} × {l.Description}", Money(l.LineTotalZar))))
            + Row(T("Totaal", "Total"), Money(order.TotalZar), total: true);
        var people = entrants.Length > 0 && entrants.All(e => e.IsComplete)
            ? $"<h2 style=\"margin:24px 0 8px;font-size:20px;color:{PassEmail.Deep}\">{H(T("Jou deelnemers", "Your participants"))}</h2><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">"
              + string.Concat(entrants.Select(e => Row($"{e.FirstName} {e.LastName}", e.EntryNumber ?? ""))) + "</table>"
            : "";
        var steps = string.Concat(next.Select(s => $"<li style=\"margin:0 0 8px\">{H(s)}</li>"));

        var html = $"""
<!doctype html><html lang="{(en ? "en" : "af")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Vasbyt 2027</title></head>
<body style="margin:0;padding:0;background:{PassEmail.Canvas};font-family:Arial,Helvetica,sans-serif;color:{PassEmail.Deep}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PassEmail.Canvas}"><tr><td align="center" style="padding:16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{PassEmail.Paper};border-radius:12px"><tr><td style="padding:24px">
<p style="margin:0;font-size:17px;font-weight:bold;color:{PassEmail.Indigo}">Orania Helpmekaar Vasbyt 2027</p>
{(demo ? $"<p style=\"margin:12px 0 0;font-size:17px;font-weight:bold\">{H(T("Demonstrasie. Geen werklike betaling is verwerk nie.", "Demonstration. No real payment was processed."))}</p>" : "")}
<h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">{H(T("Dankie", "Thank you"))}, {H(order.BuyerFirstName)}</h1>
<p style="margin:12px 0 0;font-size:17px;line-height:1.5">{H(T("Jou betaling is ontvang.", "Your payment was received."))}</p>
<p style="margin:20px 0 0;font-size:17px;color:{PassEmail.Muted}">{H(T("Verwysingsnommer", "Reference number"))}</p>
<p style="margin:4px 0 0;font-size:28px;font-weight:bold;letter-spacing:1px">{H(order.Reference)}</p>
<p style="margin:8px 0 0;font-size:17px">{H(T("Betaal op", "Paid on"))} {H(paid)}. {H(T("Betalingsverwysing", "Payment reference"))}: {H(order.PaymentReference)}</p>
<h2 style="margin:24px 0 8px;font-size:20px">{H(T("Wat om nou te doen", "What to do next"))}</h2>
<ol style="margin:0;padding-left:22px;font-size:17px;line-height:1.5">{steps}</ol>
<p style="margin:24px 0 0"><a href="{H(link)}" style="display:inline-block;padding:14px 24px;background:{PassEmail.Orange};color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;border-radius:8px">{H(action)}</a></p>
<h2 style="margin:24px 0 8px;font-size:20px">{H(T("Wat jy gekoop het", "What you bought"))}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
{people}
<p style="margin:24px 0 0;font-size:16px;color:{PassEmail.Muted}">{H(T("Hou hierdie e-pos en jou verwysingsnommer veilig. Die knoppie is jou private skakel na die bestelling.", "Keep this email and your reference number safe. The button is your private link to the order."))}</p>
</td></tr></table></td></tr></table></body></html>
""";

        var text = new StringBuilder();
        text.AppendLine("Orania Helpmekaar Vasbyt 2027").AppendLine();
        if (demo) text.AppendLine(T("Demonstrasie. Geen werklike betaling is verwerk nie.", "Demonstration. No real payment was processed.")).AppendLine();
        text.AppendLine($"{T("Dankie", "Thank you")}, {order.BuyerFirstName}. {T("Jou betaling is ontvang.", "Your payment was received.")}");
        text.AppendLine($"{T("Verwysingsnommer", "Reference number")}: {order.Reference}");
        text.AppendLine($"{T("Betaal op", "Paid on")} {paid}").AppendLine();
        text.AppendLine(T("Wat om nou te doen:", "What to do next:"));
        for (var i = 0; i < next.Count; i++) text.AppendLine($"{i + 1}. {next[i]}");
        text.AppendLine().AppendLine($"{action}: {link}").AppendLine();
        foreach (var l in lines) text.AppendLine($"{l.Quantity} x {l.Description}: {Money(l.LineTotalZar)}");
        text.AppendLine($"{T("Totaal", "Total")}: {Money(order.TotalZar)}");
        if (people.Length > 0)
            foreach (var e in entrants) text.AppendLine($"{e.FirstName} {e.LastName}: {e.EntryNumber}");
        return (html, text.ToString());
    }
```

The fixture buyer name is `<Anna>`: the plain-text part carries it raw because plain text is not HTML and must not be HTML-encoded.

- [ ] **Step 5: Run all email tests**

Run: `dotnet test tests/Vasbyt.API.Tests --filter "OrderEmail|PassEmail"`
Expected: all PASS, including the existing escaping and no-medical-data test.

- [ ] **Step 6: Stop and report**

Do not run git. Report changed files. Paste the rendered HTML for the test fixture into a file in the scratchpad and open it in the preview browser for one screenshot.

---

### Task 6: Admin API search and filters

**Model:** Sonnet 5.5, high
**Closes:** A4, A5, A8 (server part)

**Files:**
- Modify: `src/Vasbyt.API/Endpoints/AdminEndpoints.cs:83-131`
- Create: `tests/Vasbyt.API.Tests/AdminSearchTests.cs`

**Interfaces:**
- Produces:
  - `GET /api/admin/orders?q=&status=Pending|Paid|Cancelled&page=&size=`; each item gains `formsOutstanding: number` and keeps `publicToken`.
  - `GET /api/admin/entrants?q=&routeCode=&incompleteOnly=&page=&size=`; `q` also matches entry number and order reference.
  - All `q` matching is case-insensitive on SQLite and Postgres.

- [ ] **Step 1: Write the failing tests**

Create `tests/Vasbyt.API.Tests/AdminSearchTests.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;

namespace Vasbyt.API.Tests;

public class AdminSearchTests(VasbytFactory factory) : IClassFixture<VasbytFactory>
{
    [Fact]
    public async Task Orders_search_ignores_case_and_filters_by_status()
    {
        var admin = await factory.AdminClientAsync("search-orders@example.com");
        var buyer = factory.CreateClient();
        var paidToken = await Order(buyer, "Zelda", "Zuma-Soek", 2);
        (await buyer.PostAsync($"/api/orders/{paidToken}/pay-demo", null)).EnsureSuccessStatusCode();
        await Order(buyer, "Zelda", "Zuma-Soek", 1);

        var both = await admin.GetFromJsonAsync<JsonElement>("/api/admin/orders?q=zuma-soek");
        Assert.Equal(2, both.GetProperty("total").GetInt32());

        var paid = await admin.GetFromJsonAsync<JsonElement>("/api/admin/orders?q=ZUMA-SOEK&status=Paid");
        var row = Assert.Single(paid.GetProperty("items").EnumerateArray());
        Assert.Equal(2, row.GetProperty("formsOutstanding").GetInt32());

        var reference = row.GetProperty("reference").GetString()!.ToLowerInvariant();
        var byRef = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/orders?q={reference}");
        Assert.Equal(1, byRef.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Entrants_filter_by_route_on_the_server_and_match_order_reference()
    {
        var admin = await factory.AdminClientAsync("search-entrants@example.com");
        var buyer = factory.CreateClient();
        var token = await Order(buyer, "Rina", "Roete", 1, "ligtrap");
        var paid = await (await buyer.PostAsync($"/api/orders/{token}/pay-demo", null)).Content.ReadFromJsonAsync<JsonElement>();
        var reference = paid.GetProperty("reference").GetString()!;

        var hit = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/entrants?q={reference.ToLowerInvariant()}&routeCode=ligtrap");
        Assert.Equal(1, hit.GetProperty("total").GetInt32());

        var miss = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/entrants?q={reference}&routeCode=ligdraf");
        Assert.Equal(0, miss.GetProperty("total").GetInt32());
    }

    private async Task<string> Order(HttpClient client, string first, string last, int quantity, string route = "ligtrap")
    {
        var created = await client.PostAsJsonAsync("/api/orders", new
        {
            FirstName = first, LastName = last, Email = "soek@example.test",
            Tickets = new[] { new { RouteCategoryId = factory.RouteId(route), TariffKind = "Normal", Quantity = quantity } },
        });
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test tests/Vasbyt.API.Tests --filter AdminSearchTests`
Expected: FAIL (`total` is the whole table; no `formsOutstanding`).

- [ ] **Step 3: Implement the orders query**

Replace the `g.MapGet("/orders", ...)` handler with:

```csharp
        g.MapGet("/orders", async (VasbytDbContext db, string? q, OrderStatus? status, int page = 1, int size = 25) =>
        {
            size = Math.Clamp(size, 1, 200);
            var query = db.Orders.AsNoTracking().AsQueryable();
            if (status is not null) query = query.Where(o => o.Status == status);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var t = q.Trim().ToLower();
                query = query.Where(o => o.Reference.ToLower().Contains(t) || o.BuyerFirstName.ToLower().Contains(t)
                    || o.BuyerLastName.ToLower().Contains(t) || o.BuyerEmail.ToLower().Contains(t) || o.BuyerPhone.Contains(t));
            }
            var total = await query.CountAsync();
            var items = await query.OrderByDescending(o => o.Id)
                .Skip((page - 1) * size).Take(size)
                .Select(o => new
                {
                    o.Id, o.Reference, o.PublicToken, Status = o.Status.ToString(), o.TotalZar,
                    o.BuyerFirstName, o.BuyerLastName, o.BuyerEmail, o.BuyerPhone,
                    o.CreatedUtc, o.PaidUtc, o.PaymentReference,
                    FormsOutstanding = o.Lines.SelectMany(l => l.Entrants).Count(e => !e.IsComplete),
                    Lines = o.Lines.OrderBy(l => l.Id).Select(l => new
                    {
                        l.Id, Kind = l.Kind.ToString(), l.Description, l.Quantity,
                        l.UnitPriceZar, l.LineTotalZar, l.ProductVariantId, l.CollectedQuantity,
                    }),
                }).ToListAsync();
            return Results.Ok(new { total, page, size, items });
        });
```

- [ ] **Step 4: Implement the entrants filters**

In the `g.MapGet("/entrants", ...)` handler, add `string? routeCode,` after `bool? incompleteOnly,` in the parameter list, and replace the `q` filter with:

```csharp
            if (!string.IsNullOrWhiteSpace(routeCode)) query = query.Where(e => e.RouteCategory!.Code == routeCode);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var t = q.Trim().ToLower();
                query = query.Where(e => e.FirstName.ToLower().Contains(t) || e.LastName.ToLower().Contains(t)
                    || e.Email.ToLower().Contains(t) || e.Town.ToLower().Contains(t) || e.IdNumber.Contains(t)
                    || (e.EntryNumber != null && e.EntryNumber.ToLower().Contains(t))
                    || e.OrderLine!.Order!.Reference.ToLower().Contains(t));
            }
```

If `RouteCategory.Code` is an enum or a value-converted type rather than `string`, compare in the form the existing `byRoute` grouping in `/stats` uses.

- [ ] **Step 5: Run all API tests**

Run: `dotnet test tests/Vasbyt.API.Tests`
Expected: all PASS.

- [ ] **Step 6: Stop and report**

Do not run git. Report changed files.

---

### Task 7: Admin orders screen

**Model:** Sonnet 5.5, high
**Closes:** A4, A5, A6, A7, A12 (orders)

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-orders.ts`
- Modify: `src/Vasbyt.Frontend/src/app/core/api.service.ts:183-186`
- Modify: `src/Vasbyt.Frontend/src/app/core/api.models.ts` (`AdminOrder`)
- Modify: `src/Vasbyt.Frontend/src/app/i18n/af/admin.ts`, `src/Vasbyt.Frontend/src/app/i18n/en/admin.ts`

**Interfaces:**
- Consumes: Task 6 query parameters and `formsOutstanding`, `publicToken`.
- Produces: `AdminOrders` gains `readonly initialStatus = input<OrderStatus | ''>('')`. Task 9 binds it.

- [ ] **Step 1: Model and API**

In `api.models.ts`, `interface AdminOrder`, add:

```ts
  publicToken: string;
  formsOutstanding: number;
```

Replace `adminOrders` in `api.service.ts`:

```ts
  adminOrders(page: number, size = 25, q = '', status = '') {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    if (status) params = params.set('status', status);
    return this.http.get<Paged<AdminOrder>>('/api/admin/orders', { params });
  }
```

- [ ] **Step 2: Copy keys**

`af/admin.ts`:

```ts
  'admin.orderSearch': 'Soek op verwysing, naam, e-pos of selfoon',
  'admin.allStatuses': 'Alle betalings',
  'admin.customerView': 'Wys wat die koper sien',
  'admin.kindTicket': 'Inskrywing',
  'admin.kindProduct': 'Produk',
  'admin.kindDonation': 'Skenking',
  'admin.loadError': 'Kon nie laai nie.',
  'admin.retry': 'Probeer weer',
  'admin.searchButton': 'Soek',
```

`en/admin.ts`:

```ts
  'admin.orderSearch': 'Search by reference, name, email or phone',
  'admin.allStatuses': 'All payments',
  'admin.customerView': 'Show what the buyer sees',
  'admin.kindTicket': 'Entry',
  'admin.kindProduct': 'Product',
  'admin.kindDonation': 'Donation',
  'admin.loadError': 'Could not load.',
  'admin.retry': 'Try again',
  'admin.searchButton': 'Search',
```

- [ ] **Step 3: Component state and loading**

In `AdminOrders`:
- add `FormsModule` to `imports` and `import { FormsModule } from '@angular/forms';`, `input, OnInit` to the core import;
- delete the `outstanding` signal, the 200-row sweep in the constructor, and `blankForms()`;
- replace the constructor with `ngOnInit` and add state:

```ts
  readonly initialStatus = input<OrderStatus | ''>('');
  protected readonly q = signal('');
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  /** Null while loading, so an empty list never reads as "no orders" before the answer arrives. */
  protected readonly loaded = signal<boolean | null>(null);

  private static readonly KIND: Record<OrderLineKind, TranslationKey> = {
    Ticket: 'admin.kindTicket', Product: 'admin.kindProduct', Donation: 'admin.kindDonation',
  };
  protected kind(k: OrderLineKind) { return AdminOrders.KIND[k]; }

  ngOnInit() {
    this.statusFilter.set(this.initialStatus());
    this.load();
  }

  protected search() {
    this.page.set(1);
    this.load();
  }

  protected load() {
    this.loaded.set(null);
    this.api.adminOrders(this.page(), this.size, this.q().trim(), this.statusFilter()).subscribe({
      next: (r) => { this.orders.set(r.items); this.total.set(r.total); this.loaded.set(true); },
      error: () => this.loaded.set(false),
    });
  }
```

Make `load` `protected` (it was `private`) and import `OrderLineKind` from `api.models`.

- [ ] **Step 4: Template**

Directly after the `.lead` paragraph insert:

```html
    <form class="card controls" (ngSubmit)="search()">
      <label class="field">
        <span>{{ i18n.t('admin.orderSearch') }}</span>
        <input type="search" name="q" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </label>
      <label class="field">
        <span>{{ i18n.t('admin.payment') }}</span>
        <select name="status" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); search()">
          <option value="">{{ i18n.t('admin.allStatuses') }}</option>
          <option value="Pending">{{ i18n.t('admin.statusPending') }}</option>
          <option value="Paid">{{ i18n.t('admin.statusPaid') }}</option>
          <option value="Cancelled">{{ i18n.t('admin.statusCancelled') }}</option>
        </select>
      </label>
      <button class="btn btn--primary" type="submit">{{ i18n.t('admin.searchButton') }}</button>
    </form>

    @if (loaded() === null) {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (loaded() === false) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
      <button class="btn btn--ghost" type="button" (click)="load()">{{ i18n.t('admin.retry') }}</button>
    } @else if (orders().length) {
```

and change the existing `@if (orders().length) {` opener to the `@else if` above (so the existing table and pager become that branch; the final `} @else { noOrders }` stays).

In the forms cell, replace `blankForms(o.reference) > 0` and `{{ blankForms(o.reference) }}` with `o.formsOutstanding > 0` and `{{ o.formsOutstanding }}`.

In the actions cell, after the show/hide button add:

```html
                  <a class="btn btn--ghost btn--sm" [href]="'/bestel/' + o.publicToken + '/klaar'" target="_blank" rel="noopener">
                    {{ i18n.t('admin.customerView') }}
                  </a>
```

In the expanded lines, replace `<span class="chip chip--quiet">{{ l.kind }}</span>` with `<span class="chip chip--quiet">{{ i18n.t(kind(l.kind)) }}</span>`.

Add to `styles`:

```scss
    .controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-4); margin-bottom: var(--space-6); }
    .controls .field { margin-bottom: 0; min-width: min(20rem, 100%); }
    .controls .btn { min-height: var(--touch); }
```

- [ ] **Step 5: Build, test, look**

Run: `npx ng build` and `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: PASS.
In the preview, sign in as the seeded admin, open the Orders tab, search a lowercase surname, pick "Paid", expand an order (kinds read "Inskrywing", "Produk"), click "Show what the buyer sees" (receipt opens in a new tab). Screenshot.

- [ ] **Step 6: Stop and report**

Do not run git. Report changed files and the screenshot.

---

### Task 8: Admin participants screen

**Model:** Haiku 5.5, high
**Closes:** A8 (client part), A11 (participants), A12 (participants)

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-entrants.ts`
- Modify: `src/Vasbyt.Frontend/src/app/core/api.service.ts:167-172`
- Modify: `src/Vasbyt.Frontend/src/app/i18n/af/admin.ts`, `src/Vasbyt.Frontend/src/app/i18n/en/admin.ts`

**Interfaces:**
- Consumes: Task 6 `routeCode` parameter; `admin.loadError`, `admin.retry` keys from Task 7; existing `admin.saved` key.

- [ ] **Step 1: API method**

Replace `adminEntrants` in `api.service.ts`:

```ts
  adminEntrants(q: string, page: number, size = 25, incompleteOnly = false, routeCode = '') {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    if (incompleteOnly) params = params.set('incompleteOnly', true);
    if (routeCode) params = params.set('routeCode', routeCode);
    return this.http.get<Paged<AdminEntrant>>('/api/admin/entrants', { params });
  }
```

- [ ] **Step 2: Copy**

Change the existing `'admin.search'` value in `af/admin.ts` to `'Soek op naam, inskrywingsnommer, verwysing, e-pos, dorp of ID'` and in `en/admin.ts` to `'Search by name, entry number, reference, email, town or ID'`. Delete the `'admin.filterNote'` key from both files.

- [ ] **Step 3: Server-side route filter**

In `admin-entrants.ts`:
- delete the `visible` computed and its ponytail comment; replace every `visible()` in the template with `entrants()`;
- change both route chip handlers from `routeCode.set(...)` to `pickRoute(...)`;
- delete `<p class="field__hint">{{ i18n.t('admin.filterNote') }}</p>`;
- add:

```ts
  protected pickRoute(code: string) {
    this.routeCode.set(code);
    this.reload();
  }
```

- change `load()`:

```ts
  protected readonly loaded = signal<boolean | null>(null);
  protected readonly savedId = signal(0);

  protected load() {
    this.draft.set(null);
    this.loaded.set(null);
    this.api.adminEntrants(this.q(), this.page(), this.size, this.onlyIncomplete(), this.routeCode()).subscribe({
      next: (r) => { this.entrants.set(r.items); this.total.set(r.total); this.loaded.set(true); },
      error: () => this.loaded.set(false),
    });
  }
```

(`load` becomes `protected`.)

- [ ] **Step 4: Saved confirmation and resend wording**

In `save()`, inside `next`, after `this.draft.set(null);` add `this.savedId.set(d.id);`. In `toggle()`, add `this.savedId.set(0);` as the first line.

In the template's actions cell, after the resend note block, add:

```html
                  @if (savedId() === e.id) { <span class="alert alert--ok" role="status">{{ i18n.t('admin.saved') }}</span> }
```

In `resendPass`, change the success note to drop the bare count: `this.resendNote.set(this.i18n.t('admin.passSent'));`.

- [ ] **Step 5: Loading and error states**

Wrap the existing `@if (entrants().length) { ...table and pager... } @else { noEntrants }` with:

```html
    @if (loaded() === null) {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (loaded() === false) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
      <button class="btn btn--ghost" type="button" (click)="load()">{{ i18n.t('admin.retry') }}</button>
    } @else if (entrants().length) {
```

turning the old `@if (entrants().length) {` into that final `@else if`.

- [ ] **Step 6: Build and test**

Run: `npx ng build` and `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: PASS. A build error naming `visible` means a template reference was missed.

- [ ] **Step 7: Stop and report**

Do not run git. Report changed files.

---

### Task 9: Admin shell, tabs in the URL, clickable overview

**Model:** Haiku 5.5, high
**Closes:** A1, A2, A3, A12 (overview)

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin.ts`
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-overview.ts`
- Modify: `src/Vasbyt.Frontend/src/styles/_base.scss:343-344`
- Modify: `src/Vasbyt.Frontend/src/app/i18n/af/admin.ts`, `src/Vasbyt.Frontend/src/app/i18n/en/admin.ts`

**Interfaces:**
- Consumes: `AdminOrders.initialStatus` input (Task 7); `admin.loadError`, `admin.retry` (Task 7).
- Produces: `AdminOverview` output `pending = output<void>()`.

- [ ] **Step 1: Copy**

`af/admin.ts`:

```ts
  'admin.groupDay': 'Op die dag',
  'admin.groupSetup': 'Opstelling',
```

`en/admin.ts`:

```ts
  'admin.groupDay': 'On the day',
  'admin.groupSetup': 'Setup',
```

- [ ] **Step 2: Selected style for `aria-current`**

In `_base.scss`, the selector list at line 343 reads `&[aria-selected='true'],` then `&[aria-pressed='true'],`. Add a third line `&[aria-current='page'],` directly below them.

- [ ] **Step 3: Tabs from the URL, grouped**

In `admin.ts`, replace `TABS` with two groups and wire the tab to the query string:

```ts
const GROUPS: { label: TranslationKey; tabs: { id: Tab; label: TranslationKey }[] }[] = [
  { label: 'admin.groupDay', tabs: [
    { id: 'overview', label: 'admin.tabOverview' },
    { id: 'scan', label: 'scan.tab' },
    { id: 'orders', label: 'admin.tabOrders' },
    { id: 'entrants', label: 'admin.tabEntrants' },
  ] },
  { label: 'admin.groupSetup', tabs: [
    { id: 'programme', label: 'programme.tab' },
    { id: 'products', label: 'admin.tabProducts' },
    { id: 'adverts', label: 'admin.tabAdverts' },
    { id: 'tariffs', label: 'admin.tabTariffs' },
    { id: 'routes', label: 'admin.tabRoutes' },
  ] },
];
const IDS = GROUPS.flatMap((g) => g.tabs.map((t) => t.id));
```

Class body:

```ts
  protected readonly i18n = inject(I18nService);
  protected readonly groups = GROUPS;
  private readonly router = inject(Router);
  protected readonly tab = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => {
      const t = p.get('tab') as Tab;
      return IDS.includes(t) ? t : 'overview';
    })),
    { initialValue: 'overview' as Tab },
  );
  protected readonly incompleteOnly = signal(false);
  protected readonly ordersStatus = signal<OrderStatus | ''>('');
  protected readonly programmeOpened = signal(false);

  constructor() {
    // Programme keeps unsaved edits once opened, so it stays mounted after the first visit.
    effect(() => { if (this.tab() === 'programme') this.programmeOpened.set(true); });
  }

  protected select(tab: Tab) {
    this.router.navigate([], { queryParams: { tab } });
  }

  protected followUp() {
    this.incompleteOnly.set(true);
    this.select('entrants');
  }

  protected pending() {
    this.ordersStatus.set('Pending');
    this.select('orders');
  }
```

Imports: `effect` from `@angular/core`, `toSignal` from `@angular/core/rxjs-interop`, `ActivatedRoute, Router` from `@angular/router`, `map` from `rxjs`, `OrderStatus` from `../core/api.models`.

Replace the `<nav>` with:

```html
      <nav class="tabs" [attr.aria-label]="i18n.t('admin.title')">
        @for (g of groups; track g.label) {
          <div class="group">
            <span class="group__label">{{ i18n.t(g.label) }}</span>
            <div class="group__tabs">
              @for (t of g.tabs; track t.id) {
                <button class="chip" type="button" [attr.aria-current]="tab() === t.id ? 'page' : null" (click)="select(t.id)">
                  {{ i18n.t(t.label) }}
                </button>
              }
            </div>
          </div>
        }
      </nav>
```

Change `<vb-admin-overview (followUp)="followUp()" />` to `<vb-admin-overview (followUp)="followUp()" (pending)="pending()" />` and `<vb-admin-orders />` to `<vb-admin-orders [initialStatus]="ordersStatus()" />`.

Replace `styles` with:

```scss
    .tabs { display: grid; gap: var(--space-4); margin-bottom: var(--space-8); }
    .group { display: grid; gap: var(--space-2); }
    .group__label { font-size: 1rem; font-weight: 700; color: var(--ink-muted); }
    .group__tabs { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .group__tabs .chip { min-height: var(--touch); font-size: 1rem; padding-inline: var(--space-4); }
```

- [ ] **Step 4: Overview tile link and error state**

In `admin-overview.ts`:
- add `readonly pending = output<void>();`;
- replace the pending orders tile `<div class="card tile">...</div>` with a button using the same classes:

```html
        <button type="button" class="card tile tile--link" (click)="pending.emit()">
          <span class="eyebrow">{{ i18n.t('admin.pendingOrders') }}</span>
          <strong>{{ s.pendingOrders }}</strong>
        </button>
```

- add `protected readonly failed = signal(false);`, change the subscribe to `.subscribe({ next: (s) => this.stats.set(s), error: () => this.failed.set(true) })`, and after the closing `}` of `@if (stats(); as s) { ... }` add:

```html
    @else if (failed()) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
    } @else {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    }
```

- add to `styles`:

```scss
    .tile--link { text-align: left; font: inherit; border: 0; cursor: pointer; }
    .tile--link:hover strong { text-decoration: underline; }
```

- [ ] **Step 5: Build, test, look**

Run: `npx ng build` and `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: PASS (`admin-programme.spec.ts` included).
In the preview: open `/admin`, click Tariffs, reload the page: Tariffs is still open. Press Back: Overview. Click the pending orders tile: Orders opens filtered to unpaid. Screenshot of the grouped tabs.

- [ ] **Step 6: Stop and report**

Do not run git. Report changed files and the screenshot.

---

### Task 10: Tariffs in South African time

**Model:** Sonnet 5.5, high
**Closes:** A9, A10

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.ts`
- Create: `src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.spec.ts`
- Modify: `src/Vasbyt.Frontend/src/app/i18n/af/admin.ts`, `src/Vasbyt.Frontend/src/app/i18n/en/admin.ts`

**Interfaces:**
- Produces: `export function toSast(utcIso: string): string` and `export function fromSast(local: string): string` in `admin-tariffs.ts`.

- [ ] **Step 1: Write the failing spec**

Create `admin-tariffs.spec.ts`:

```ts
import { fromSast, toSast } from './admin-tariffs';

describe('tariff times', () => {
  it('shows a UTC stamp in South African time, across midnight', () => {
    expect(toSast('2027-01-31T22:00:00Z')).toBe('2027-02-01T00:00');
  });

  it('reads a stamp without a zone as UTC', () => {
    expect(toSast('2027-01-31T22:00:00')).toBe('2027-02-01T00:00');
  });

  it('sends South African input back as the same instant in UTC', () => {
    expect(fromSast('2027-02-01T00:00')).toBe('2027-01-31T22:00:00.000Z');
  });

  it('round-trips', () => {
    expect(toSast(fromSast('2026-12-31T23:30'))).toBe('2026-12-31T23:30');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/admin/admin-tariffs.spec.ts`
Expected: FAIL, `toSast` is not exported.

- [ ] **Step 3: Implement**

At the bottom of `admin-tariffs.ts`, replace the `utc()` function and the `from`/`to` lines in `draft()`:

```ts
const SA_MS = 2 * 3_600_000;

/** A UTC stamp as the 'YYYY-MM-DDTHH:mm' a datetime-local input shows in South African time (UTC+2, no DST). */
export function toSast(utcIso: string): string {
  const zoned = /([zZ]|[+-]\d\d:\d\d)$/.test(utcIso) ? utcIso : `${utcIso}Z`;
  return new Date(Date.parse(zoned) + SA_MS).toISOString().slice(0, 16);
}

/** The datetime-local value, read as South African time, back to a UTC ISO stamp. */
export function fromSast(local: string): string {
  return new Date(`${local.slice(0, 16)}:00+02:00`).toISOString();
}
```

In `draft()`: `from: toSast(r.validFromUtc), to: toSast(r.validToUtc),`.
In `save()`: `validFromUtc: fromSast(r.from), validToUtc: fromSast(r.to),`.
In `add()`: `const now = toSast(new Date().toISOString());`.

- [ ] **Step 4: Copy and a calmer warning**

Change `'admin.utcHint'` in `af/admin.ts` to `'Tye is Suid-Afrikaanse tyd.'` and in `en/admin.ts` to `'Times are South African time.'`.
In the template change `<p class="alert alert--error warning">` to `<p class="alert warning">`.

- [ ] **Step 5: Run tests**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: all PASS. Then `npx ng build`.

- [ ] **Step 6: Stop and report**

Do not run git. Report changed files.

---

### Task 11: Saved confirmation on setup screens, admin type scale

**Model:** Haiku 5.5, high
**Closes:** A11, A12 (type scale)

**Files:**
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-products.ts`
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-adverts.ts`
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-routes.ts`
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.ts`
- Modify: `src/Vasbyt.Frontend/src/app/pages/admin/admin-orders.ts`, `admin-entrants.ts` (delete local `.btn--sm`)
- Modify: `src/Vasbyt.Frontend/src/styles/_forms.scss:106`, `src/Vasbyt.Frontend/src/styles/_buttons.scss`

**Interfaces:**
- Consumes: existing `admin.saved` key. Save API return types: `adminSaveProduct` and `adminSaveAdvert` return `Saved` (`{ id }`), `adminSavePricingRule` returns `PricingRule`, `adminSaveRoute` returns `void`.

The pattern, the same in all four components: a `savedId` signal set to the saved row's id before the list reloads, and an alert under that row's buttons.

- [ ] **Step 1: Products**

Add `protected readonly savedId = signal(0);`. In `save(p)`, first line `this.savedId.set(0);`. Replace the `next` handler:

```ts
      next: (saved) => {
        const id = p.id ?? saved.id;
        const done = () => { this.savedId.set(id ?? 0); this.load(); };
        if (!single || !id) return done();
        this.api.adminSaveVariant(id, single).subscribe({ next: done, error: failed });
      },
```

In the template, directly after `@if (p.error) { ... }` add:

```html
              @if (p.id && savedId() === p.id) { <p class="alert alert--ok" role="status">{{ i18n.t('admin.saved') }}</p> }
```

- [ ] **Step 2: Adverts**

Add `protected readonly savedId = signal(0);`. In `save(a)`: first line `this.savedId.set(0);`, and `next: (saved) => { this.savedId.set(a.id ?? saved.id); this.load(); },`. After the `@if (a.error) { ... }` block add:

```html
              @if (a.id && savedId() === a.id) { <p class="alert alert--ok" role="status">{{ i18n.t('admin.saved') }}</p> }
```

- [ ] **Step 3: Routes**

Add `protected readonly savedId = signal(0);`. In `save(r)`: first line `this.savedId.set(0);`, and `next: () => { this.savedId.set(r.id); this.load(); },`. After the `@if (r.error) { ... }` block add:

```html
        @if (savedId() === r.id) { <p class="alert alert--ok" role="status">{{ i18n.t('admin.saved') }}</p> }
```

- [ ] **Step 4: Tariffs**

Add `protected readonly savedId = signal(0);`. In `save(r)`: first line `this.savedId.set(0);`, and `next: (rule) => { this.savedId.set(rule.id); this.load(); },`. After the `@if (r.error) { ... }` block add:

```html
          @if (r.id && savedId() === r.id) { <p class="alert alert--ok" role="status">{{ i18n.t('admin.saved') }}</p> }
```

- [ ] **Step 5: Type scale**

In `_forms.scss` line 106 (`table.data`), change `font-size: 0.9375rem;` to `font-size: 1rem;`.

Append to `_buttons.scss`:

```scss
/* Secondary row actions in admin tables: smaller padding, never a smaller target or smaller type. */
.btn--sm {
  min-height: var(--touch);
  padding: var(--space-2) var(--space-4);
  font-size: 1rem;
}
```

Delete the local `.btn--sm { ... }` rule from the `styles` of `admin-orders.ts` and `admin-entrants.ts` (the global one replaces it). Search for any other local `.btn--sm` in `pages/admin` with `grep -rn "btn--sm {" src/app/pages/admin` and delete those too.

- [ ] **Step 6: Build, test, look**

Run: `npx ng build` and `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: PASS.
In the preview, save a product and a tariff: "Gestoor." appears under that card's buttons. Screenshot.

- [ ] **Step 7: Stop and report**

Do not run git. Report changed files and the screenshot.

---

### Task 12: Whole-change verification

**Model:** Sonnet 5.5, high

- [ ] **Step 1: Full test run**

Run from the repo root: `dotnet test tests/Vasbyt.API.Tests`. From `src/Vasbyt.Frontend`: `npx ng test --watch=false --browsers=ChromeHeadless`, `npx ng build`, and `npx playwright test` (the existing `e2e/demo.spec.ts`; it may assert old receipt copy such as the removed entry number card, in which case update the assertion to the new glance card text and say so in the report).
Expected: all PASS.

- [ ] **Step 2: Older-reader check in the browser**

In the preview, at 375px wide and again at desktop width with the browser zoom emulated at 200% (`resize_window` to 640x900 approximates it), walk: receipt page, account page, a pass zoomed full screen, admin Orders search, admin Participants route filter, Tariffs. For each confirm: no horizontal scroll, no key fact below 16px (check with `javascript_tool`: `[...document.querySelectorAll('main *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.textContent.trim().slice(0, 40))`), every primary button at least 44px high.

- [ ] **Step 3: Copy check**

Run: `grep -rnP "\x{2014}|\x{2013}" src/Vasbyt.Frontend/src/app src/Vasbyt.API/Services` and confirm no new em or en dashes were introduced by this work (compare against `git diff`).

- [ ] **Step 4: Report**

Do not run git. Report: test results with counts, the list of every changed file across Tasks 1 to 11, the screenshots, and any finding left open. Give the user this command to review the diff:

```bash
git diff --stat
```
