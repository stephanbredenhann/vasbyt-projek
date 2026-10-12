# UX Audit Update Implementation Plan

> **For agentic workers:** use superpowers:subagent-driven-development. Run waves in order, tasks inside a wave one at a time, in the listed order. Each wave ends with a review before the next wave starts.

**Goal:** close the findings in `docs/UX_AUDIT_2026-10-12.md` that can be fixed without guessing an owner fact, P1 first.

**Source:** `docs/UX_AUDIT_2026-10-12.md` (finding IDs A1 to A5, R1 to R7, D1 to D12, V1 to V10). Evidence screenshots in `docs/ux-audit-2026-10-12/`.

**Shape of the work:** almost all frontend (Angular 20 standalone components, signals, flat i18n dictionaries). One backend change (T4.5, a field on the quote response). No new packages, no new pages, no schema migration.

**Model tags:** `haiku` = transcription of an exact change. `sonnet` = judgment, state, multi-file or backend. Dispatch with the Agent tool, `model: "haiku"` or `model: "sonnet"`.

---

## Global Constraints

Every task obeys all of these. A reviewer rejects a task that breaks one.

1. **Git (user override for this plan).** The user granted commit permission for this work on branch `ux-audit-update`. Each task stages only the files it changed (`git add <paths>`, never `-A`) and commits with the task's **Commit** message. Never push, rebase, reset, amend, stash, switch or branch. No AI co-author, `Co-Authored-By`, or "Generated with" line in any commit message.
2. **No em dashes or en dashes anywhere** you write: copy, code comments, commit messages. Use a comma, a period, or "to" for a range. If a line you edit already contains one, replace it. Check before reporting: `grep -nP '[\x{2013}\x{2014}]' <changed files>` must print nothing on lines you added.
3. **Code comments are one line.** Only go longer when the why truly needs it.
4. **No coloured strip on the top edge of a card:** no top border, no inset top shadow, no accent bar. Colour a card with a tint (`--karoo-sand-light`, `--ev-tint`) or its contents.
5. **All user-facing copy goes through i18n**, in both `src/Vasbyt.Frontend/src/app/i18n/af/<area>.ts` and `.../en/<area>.ts`. Afrikaans is the source of truth. `en.ts` is typed `Record<TranslationKey, string>`, so a key missing from English fails the build. That includes `aria-label`, `title`, placeholders and error text. Never show a server `detail` string as the only message on a buyer page when a status code can be mapped to a key.
6. **Reuse before writing.** Existing pieces to reach for: `.field`, `.field__error`, `.field__hint`, `.alert`, `.alert--error`, `.alert--ok`, `.chip`, `.btn--primary|accent|ghost|sm|lg|block`, `table.data.data--stack` with `data-label` / `.primary` / `.actions-cell` (stacks under 560px), `.visually-hidden`, `routeKey()` in `pages/routes-page.ts`, `eventDays()` in `shared/calendar.ts`, `safeReturn()` in `core/auth.service.ts`, the checkout field-error pattern in `pages/register-review.ts` (`#x="ngModel"` plus `@if (x.invalid && (x.touched || f.submitted))`), keys `checkout.required`, `checkout.emailInvalid`, `common.optional`, `common.loading`, `common.error`, `programme.retry`, `admin.retry`, `helpmekaar.email`, `helpmekaar.phone`. SCSS tokens live in `src/Vasbyt.Frontend/src/styles/_tokens.scss`; never hard-code a colour a token already names.
7. **Smallest diff that fully fixes the finding.** No refactors, renames or tidy-ups outside the task.
8. **Preserve behaviour the task does not name.** Guest checkout, tab drafts, address reuse, autocomplete tokens, password-manager paste, reduced-motion handling, the invite flow, optimistic `version` fields, admin unsaved-change protection all keep working.
9. Buyer-page touch targets at least 48px high, admin at least `var(--touch)` (44px). Body text on buyer pages never below `1rem`.
10. Component styles stay under the 16kB `anyComponentStyle` budget (8kB warns). `ng build` warnings about a component you touched must not get worse.
11. Afrikaans copy uses the same apostrophe style as its neighbours in that file.

### Commands

Frontend, from `src/Vasbyt.Frontend`:

- Build (also proves i18n parity): `npx ng build`
- All unit tests: `npx ng test --watch=false --browsers=ChromeHeadless`
- One spec: `npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/pages/admin/admin-tariffs.spec.ts'`
- Manual check: `npm start` (dev server at `http://127.0.0.1:4200`, proxied API per `proxy.conf.json`)

Backend, from the repo root (`Vasbyt.sln` holds `src/Vasbyt.API` and `tests/Vasbyt.API.Tests`, net8.0, xUnit):

- Build: `dotnet build Vasbyt.sln`
- Tests: `dotnet test tests/Vasbyt.API.Tests` (needs Docker running: the factory starts `postgres:16-alpine` through Testcontainers)
- One class: `dotnet test tests/Vasbyt.API.Tests --filter "FullyQualifiedName~ShopCheckoutTests"`

Every task runs `npx ng build` and the unit tests at the end. T4.5 also runs the backend build and tests.

### Wave review checklist

Run by a reviewer agent on `git diff` (read-only) after the last task of each wave:

1. Each task's acceptance checks hold; the listed tests exist and pass.
2. Global Constraints 2 to 6: dash grep clean, comments one line, no top strips, every new key in both languages, no hard-coded colour or copy.
3. No change outside the files each task lists.
4. Build and full unit test run pass.

---

## Wave 1: P1 buyer journeys (account, participant forms, contrast, event dates)

### T1.1 Accessible text on orange actions

- **Findings:** V1
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/styles/_buttons.scss`, `src/Vasbyt.Frontend/src/styles/_base.scss`
- **Change:**
  1. `_buttons.scss`, inside `&--accent` (around line 153): change the base rule `color: var(--paper);` to `color: var(--ink);`. Leave the `&:hover:not(:disabled)` rule (indigo fill, paper text) as is. Replace the comment above it with `/* Accent: the single call to action (register). Orange takes ink text: white on orange is only 3.5:1. */`
  2. `_base.scss`, `.chip--accent` (around line 342): `color: var(--paper);` becomes `color: var(--ink);`.
  3. `_base.scss`, `a { &:hover { ... } }` (around line 97): `color: var(--orange);` becomes `color: var(--orange-ink);` (orange text on the canvas is about 3.3:1).
- **Why:** white `#ffffff` on `#f1531c` is 3.50:1; ink `#1c1b19` on `#f1531c` is 4.91:1, matching the existing `.badge` rule "Orange fill takes ink text".
- **Acceptance:** header "Enter now!", home hero CTA, route-detail CTA, basket "Checkout", pay buttons and the basket count chip render dark text on orange; hover still turns them indigo with white text (9.99:1); admin chips (Paid, Incomplete, Switched on) and done participant tabs show dark text; link hover keeps the thicker underline.
- **Tests:** build only.
- **Commit:** `git add src/Vasbyt.Frontend/src/styles/_buttons.scss src/Vasbyt.Frontend/src/styles/_base.scss && git commit -m "Use ink text on orange actions for readable contrast"`

### T1.2 Account creation knows its context and names its fields

- **Findings:** A2, A3, A4, A1 (account copy)
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/create-account.ts`, new `src/Vasbyt.Frontend/src/app/pages/create-account.spec.ts`, `i18n/af/common.ts`, `i18n/en/common.ts`, `i18n/af/registreer.ts`, `i18n/en/registreer.ts`
- **Change:**
  1. **Context, not the cart (A2).** Replace the unconditional cart prefill (`create-account.ts` lines 69 to 72):
     - `back === '/bestel'` (checkout): prefill first name, surname and email from `OrderFlowService.cart().buyer`, as today.
     - `back` matches `/^\/(?:bestel|registreer)\/([^/?#]+)\/klaar$/` (a receipt): fields start blank. Load `ApiService.order(token)` into an `order` signal. Show a ghost button `auth.useBuyer` (replace `{name}` with buyer first and last name, `{email}` with buyer email) that copies those three values into the model when clicked. Never fill them automatically. An order load error shows nothing extra.
     - Anything else: blank, except an invite keeps its email exactly as today.
     - No change to `register-done.ts`: its links already pass `terug: here`, and `sign-in.ts` forwards `terug` to this page.
  2. **Copy (A1, A3).** Lead: invite keeps `auth.inviteIntro`, otherwise `auth.createIntro` (new text). Under it one context line: checkout `auth.returnCheckout`, receipt `auth.returnOrder` (with `{ref}` = order reference, shown once loaded), any other `back` keeps `auth.returnNote`.
  3. **Way out (A3).** Below the existing "Already have an account?" line: checkout shows `<a routerLink="/bestel">` with `auth.continueGuest`; receipt shows `<a [routerLink]="back">` with `auth.backToOrder` (`{ref}` replaced) once the order has loaded.
  4. **Field errors (A4).** Each input gets a template ref (`#fn="ngModel"` etc.) and, below it, `@if (x.invalid && (x.touched || f.submitted)) { <small class="field__error">...</small> }` using `checkout.required` for empty, `checkout.emailInvalid` for a bad email, `auth.passwordShort` for a short password. On an invalid submit keep the `auth.fixFields` alert and focus the first `input.ng-invalid` inside the host element.
  5. **Password (A4).** Label `auth.createPassword`. Add a `show` signal, bind `[type]="show() ? 'text' : 'password'"`, and add `<button type="button" class="btn btn--ghost btn--sm" [attr.aria-pressed]="show()">` toggling between `auth.showPassword` and `auth.hidePassword`. Keep `autocomplete="new-password"`, `minlength="8"`, `required`.
  6. **Claim scope (A3).** Change only the copy of `claim.link`; `register-done.ts` already prints the signed-in email beside it.
- **Keys** (AF / EN; `auth.*` in `common.ts`, `claim.link` in `registreer.ts`):
  - `auth.createIntro` (change): "Opsioneel. Hierdie rekening behoort aan jou en help jou om jou bestellings en die mense wat jy inskryf te bestuur. Ander deelnemers het nie hul eie rekeninge nodig nie." / "Optional. This account belongs to you and lets you manage your orders and the people you register. Other participants do not need their own accounts."
  - `auth.returnCheckout`: "Hierna gaan jy terug na die betaalblad. Jou mandjie bly behoue." / "Afterwards you go back to checkout. Your basket is kept."
  - `auth.returnOrder`: "Hierna gaan jy terug na bestelling {ref}, waar jy dit aan jou rekening kan koppel." / "Afterwards you go back to order {ref}, where you can link it to your account."
  - `auth.useBuyer`: "Gebruik die koper se besonderhede: {name}, {email}" / "Use the buyer's details: {name}, {email}"
  - `auth.continueGuest`: "Gaan voort as gas" / "Continue as a guest"
  - `auth.backToOrder`: "Terug na bestelling {ref}" / "Back to order {ref}"
  - `auth.createPassword`: "Skep 'n wagwoord" / "Create a password"
  - `auth.showPassword`: "Wys wagwoord" / "Show password"
  - `auth.hidePassword`: "Versteek wagwoord" / "Hide password"
  - `auth.passwordShort`: "Die wagwoord moet minstens 8 karakters hê." / "The password needs at least 8 characters."
  - `claim.link` (change): "Koppel hierdie hele bestelling en sy passe aan my rekening" / "Link this whole order and its passes to my account"
- **Acceptance:**
  - Audit A2 reproduction: cart buyer is "UX Audit Shop", open `/skep-rekening?terug=/bestel/<token of 000017>/klaar`: name and email are blank, and the button offers "UX Audit Test". Old receipts never use a newer basket's identity.
  - `/skep-rekening?terug=/bestel` is prefilled from the basket as before.
  - Empty submit shows a message under each empty field and focuses First name.
  - Show password reveals the text; the password manager still offers to save.
  - The receipt path never says "Your basket is kept".
- **Tests:** add `create-account.spec.ts` (TestBed, same style as `admin-programme.spec.ts`): stub `ActivatedRoute` with `snapshot.queryParamMap = convertToParamMap({ terug: '/bestel/abc/klaar' })`, an `OrderFlowService` whose `cart().buyer` is "Shop Buyer", and `ApiService.order` returning an order whose buyer is "Receipt Buyer". Assert the first-name input is empty, and after clicking the use-buyer button it reads "Receipt". Second case with `terug: '/bestel'` asserts "Shop". Run build and all unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/create-account.ts src/Vasbyt.Frontend/src/app/pages/create-account.spec.ts src/Vasbyt.Frontend/src/app/i18n/af/common.ts src/Vasbyt.Frontend/src/app/i18n/en/common.ts src/Vasbyt.Frontend/src/app/i18n/af/registreer.ts src/Vasbyt.Frontend/src/app/i18n/en/registreer.ts && git commit -m "Create account from its own context with field errors and a password reveal"`

### T1.3 Participant form: error summary, optional marks, readable terms, draft warning

- **Findings:** R2, R1, R3 (terms part), A1 (participant copy)
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/register-entrant.ts`, `src/Vasbyt.Frontend/src/app/shared/address-input.ts`, `src/Vasbyt.Frontend/src/app/pages/programme.ts`, `src/Vasbyt.Frontend/src/styles/_forms.scss`, new `src/Vasbyt.Frontend/src/app/pages/register-entrant.spec.ts`, `i18n/af/registreer.ts`, `i18n/en/registreer.ts`
- **Change:**
  1. **Address fields join the form.** `AddressInput` declares `required` fields but they do not register with the parent `NgForm`, so the parent never knows they are empty (the server then answers with an Afrikaans "Provinsie word vereis."). Add `viewProviders: [{ provide: ControlContainer, useExisting: NgForm }]` to `AddressInput`. This enforces what its markup already declares; flag it in the report.
  2. **Save always enabled (R2).** Remove `|| f.invalid` from the Save button's `[disabled]` (keep `busy()`).
  3. **Error summary (R2).** In `submit()`, when the form is invalid, set a `missing` signal to the names of invalid controls (`Object.entries(form.controls).filter(([, c]) => c.invalid).map(([n]) => n)`) and return. Render above the form, only when `missing().length`: a `<div class="alert alert--error" role="alert" tabindex="-1">` with an `<h2>` `entrant.summaryTitle` and a `<ul>`; each item is a `<button type="button">` styled as a link (underline, `--orange-ink`, no padding, min-height 44px) whose text is `i18n.t(FIELD_LABEL[name])` and whose click focuses `[name="<name>"]` inside the host. Focus the summary after it renders. Clear `missing` on a valid submit.
     `FIELD_LABEL` (control name to key): `firstName: entrant.firstName`, `lastName: entrant.lastName`, `idNumber: entrant.idNumber`, `dateOfBirth: entrant.dob`, `email: entrant.email`, `phone: entrant.phone`, `gender: entrant.gender`, `shirtSize: entrant.shirt`, `streetAddress: entrant.street`, `town: entrant.town`, `province: entrant.province`, `postalCode: entrant.postcode`, `emergencyName: entrant.emergencyName`, `emergencyRelationship: entrant.emergencyRelation`, `emergencyPhone: entrant.emergencyPhone`, `acceptTerms: entrant.consentTermsRequired`, `guardianConsentName: entrant.guardianName`.
  4. **Red borders after submit.** In `_forms.scss`, extend the invalid rule inside the input selector block to `&.ng-invalid.ng-touched, .ng-submitted &.ng-invalid { border-color: var(--danger); }`.
  5. **Optional marks (R2).** Add `<span class="muted">({{ i18n.t('common.optional') }})</span>` to the labels of Medical conditions, Medication, Medical scheme and Medical scheme number (same markup as Club). Below `entrant.formsIntro` add `<p class="muted">{{ i18n.t('entrant.requiredNote') }}</p>`.
  6. **Terms beside consent (R3).** In `programme.ts` change `const TERMS` to `export const TERMS` and add `export const termKey = (n: number) => \`terms.t${n}\` as TranslationKey;`, then make the `term()` method return `termKey(n)`. In the Consents fieldset, directly after the accept-terms checkbox, add `<details class="terms"><summary>{{ i18n.t('entrant.readTerms') }}</summary><ol>@for (n of terms; track n) { <li>{{ i18n.t(termKey(n)) }}</li> }</ol></details>`. It opens in place, so nothing typed is lost. No indemnity link: its text is an owner decision (see below).
  7. **Draft warning (R1).** Add `<p class="muted">{{ i18n.t('entrant.draftNote') }}</p>` under the required note. Add a `viewChild<NgForm>('f')` and `@HostListener('window:beforeunload', ['$event'])` that calls `event.preventDefault()` and sets `event.returnValue = ''` when the form is dirty, the slot is not complete, and nothing is saving. Implement `OnDestroy` with `ngOnDestroy() { this.keepDraft(); }` so leaving for another in-app page and coming back in the same session keeps the draft. Do not write drafts to any browser storage.
  8. **Who is "me" (A1).** Change the `entrant.isBuyer` copy and add `<small class="field__hint">{{ i18n.t('entrant.isBuyerHint') }}</small>` right after that button.
- **Keys** (AF / EN, in `registreer.ts`):
  - `entrant.summaryTitle`: "Voltooi asseblief hierdie velde" / "Please complete these fields"
  - `entrant.requiredNote`: "Velde wat as opsioneel gemerk is, mag leeg bly. Alles anders is nodig voordat jy kan stoor." / "Fields marked optional can stay blank. Everything else is needed before you can save."
  - `entrant.draftNote`: "Wat jy intik, bly behoue terwyl jy tussen deelnemers op hierdie blad skuif. Dit word eers gestoor wanneer jy op Stoor deelnemer druk. As jy die blad herlaai of toemaak voor dit, gaan dit verlore." / "What you type is kept while you move between participants on this page. It is only saved when you press Save entrant. If you refresh or close the page before then, it is lost."
  - `entrant.readTerms`: "Lees die bepalings en voorwaardes" / "Read the terms and conditions"
  - `entrant.isBuyer` (change): "Dis ek: kopieer die koper se kontakbesonderhede" / "This is me: copy the buyer's contact details"
  - `entrant.isBuyerHint`: "Slegs as jy, die koper, hierdie deelnemer is. Skryf jy iemand anders in? Vul hul eie besonderhede in." / "Only if you, the buyer, are this participant. Registering someone else? Fill in their own details."
  - `entrant.medicalHint` (change, drop the trailing "Optional."): "Allergieë en toestande waarvan die mediese span moet weet." / "Allergies and conditions the medical team should know about."
- **Acceptance:**
  - Save is enabled on an empty form. Pressing it shows the summary, focuses it, and lists every missing field. Each item moves focus to its field. Typed values are kept.
  - Missing fields get red borders after the first Save.
  - The four medical fields read "(optional)".
  - "Read the terms and conditions" opens the 11 programme terms in place without losing input.
  - Refreshing with typed data triggers the browser's leave-page warning. Switching tabs and switching language still keep drafts. The address-reuse checkbox still works.
- **Tests:** add `register-entrant.spec.ts`: stub `ActivatedRoute.paramMap` (`token`, `index: 1`) and `ApiService.order` returning one incomplete entrant, plus a `saveEntrant` spy. Submit the empty form and assert the summary contains the First name label and `saveEntrant` was not called. Run build and all unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/register-entrant.ts src/Vasbyt.Frontend/src/app/pages/register-entrant.spec.ts src/Vasbyt.Frontend/src/app/shared/address-input.ts src/Vasbyt.Frontend/src/app/pages/programme.ts src/Vasbyt.Frontend/src/styles/_forms.scss src/Vasbyt.Frontend/src/app/i18n/af/registreer.ts src/Vasbyt.Frontend/src/app/i18n/en/registreer.ts && git commit -m "Participant form lists missing fields, shows terms in place and warns before losing a draft"`

### T1.4 Calendar date on every route-day heading

- **Findings:** V2 (safe partial)
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/pages/route-detail.ts`
- **Change:**
  1. Import: `import { DecimalPipe, formatDate } from '@angular/common';`
  2. Line ~111: `<h3>{{ i18n.t(dayKey(d.dayNumber)) }}</h3>` becomes `<h3>{{ i18n.t(dayKey(d.dayNumber)) }} {{ dayDate(d.dateLocal) }}</h3>`.
  3. Add to `RouteDetail`: `protected dayDate(iso: string) { return iso ? formatDate(iso, 'd MMMM y', this.i18n.locale()) : ''; }`
- **Why:** the audit asks for explicit dates on every route-day heading, not just "Day 1, Thursday". The date comes from the route day already loaded, so no time value is chosen here.
- **Acceptance:** `/roetes/ligstap` shows "Dag 1, Donderdag 29 April 2027" (AF) and "Day 1, Thursday 29 April 2027" (EN) for each of the three days; a day without a date shows the old heading.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/route-detail.ts && git commit -m "Show the calendar date on every route day"`

### T1.5 Remove dead copy that hard-codes event times

- **Findings:** V2 (one source of truth, no value chosen)
- **Model:** haiku
- **Files:** `i18n/af/program.ts`, `i18n/en/program.ts`, `i18n/af/roetes.ts`, `i18n/en/roetes.ts` (all under `src/Vasbyt.Frontend/src/app/`)
- **Change:**
  1. Pre-check (must print nothing): `grep -rnE "program\.d(ay)?[123]|routes\.[a-z]+\.day[123]" src/Vasbyt.Frontend/src/app --include=*.ts | grep -v "/i18n/"`. Also confirmed at plan time: `routeKey()` is only called with `'name'` and `'blurb'`, and `programme.ts` builds only `terms.t*` and `bring.*` keys. If the grep prints anything, stop and report.
  2. In both `program.ts` files delete `'program.day1'`, `'program.day2'`, `'program.day3'` and every key starting `'program.d1.'`, `'program.d2.'`, `'program.d3.'` (35 keys per file, including multi-line values).
  3. In both `roetes.ts` files delete every key matching `'routes.(ligtrap|vastrap|ligdraf|vasbyt|ligstap|vasstap).day1'`, `.day2`, `.day3` (18 keys per file). Keep every `.name` and `.blurb`.
- **Why:** these unused strings carry a third and fourth set of start times (and the date "Donderdag 30 April"). The live times come from the admin-edited programme and route days. Removing the copies leaves only real sources for the owner to reconcile. Git history keeps the text.
- **Acceptance:** build passes; the programme and route pages render unchanged.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/i18n/af/program.ts src/Vasbyt.Frontend/src/app/i18n/en/program.ts src/Vasbyt.Frontend/src/app/i18n/af/roetes.ts src/Vasbyt.Frontend/src/app/i18n/en/roetes.ts && git commit -m "Remove unused programme and route copy that repeated event times"`

**Wave 1 review.**

---

## Wave 2: P1 admin creation (products, tariffs)

### T2.1 Products: variants before the first save, explicit save scope, phone layout

- **Findings:** D1, D2, D3, D4 (copy), "named admin inputs"
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-products.ts`, new `src/Vasbyt.Frontend/src/app/pages/admin/admin-products.spec.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. **D1 variants before save.** Change `@if (p.multiple && p.id; as productId)` to `@if (p.multiple)`. For an unsaved product (`!p.id`) hide the per-row Save and Delete buttons and show `admin.variantsSaveWithProduct` under the table. In `save(p)`, when `p.multiple && !p.id`: validate every live variant with `variantError(v, true)` (show errors on the rows and stop if any fail), create the product, set `p.id` to the new id right away (a retry then updates rather than duplicates), then save each live variant in sequence (`concat(...).pipe(toArray())`). On a variant failure set `p.error` and still refresh.
  2. **D1 not live by accident.** `add()` sets `isActive: false`. Show `admin.newProductHidden` as a hint under the Active checkbox while `!p.id`.
  3. **D2 save scope.** Product button text: single product `admin.saveProductAndPrice`; multi product with id `admin.saveProduct`; new multi product `admin.saveProductAndVariants`. Row button `admin.saveVariant`, with `[attr.aria-label]` = that text plus product name and variant label. Disable a product's button while it saves and show `entrant.saving` as its text.
  4. **D2 keep other drafts.** Replace the wholesale `load()` after save and delete with a refresh that merges. Export a pure function `mergeProducts(current, fresh, savedId)`: products whose id is `savedId` take the fresh version; every other product with an id keeps the current draft object; fresh products not in `current` are added; unsaved drafts (no id) other than the one just saved stay at the top. The initial load still sets the list directly.
  5. **D3 phone layout.** Variant table class becomes `data data--stack`. Label cell gets `class="primary"`. The other cells get `[attr.data-label]` with `admin.price`, `admin.trackStock`, `admin.quantityOnHand`, `admin.active`. The actions cell gets `class="actions-cell"`.
  6. **Accessible names.** Every variant input gets `[attr.aria-label]` = field label + `': '` + product name + `' '` + variant label (label, price, track stock, quantity, active). The single-product price and quantity inputs already have visible labels.
  7. **D4 copy.** Change `admin.hasVariantsLocked`; deactivating (not deleting) is what unlocks the switch, because `live()` counts only active variants.
  8. **Loading.** Add a `loaded` signal. Show `common.loading` (role status) before the first response, instead of "No products yet".
- **Keys** (AF / EN):
  - `admin.saveProduct`: "Stoor produkbesonderhede" / "Save product details"
  - `admin.saveProductAndPrice`: "Stoor produk, prys en voorraad" / "Save product, price and stock"
  - `admin.saveProductAndVariants`: "Stoor produk en variante" / "Save product and variants"
  - `admin.saveVariant`: "Stoor variant" / "Save variant"
  - `admin.variantsSaveWithProduct`: "Die variante word saam met die produk gestoor." / "The variants are saved together with the product."
  - `admin.newProductHidden`: "'n Nuwe produk begin onaktief. Merk Aktief wanneer dit gereed is vir die winkel." / "A new product starts inactive. Tick Active when it is ready for the shop."
  - `admin.hasVariantsLocked` (change): "Om dit weer as een item te verkoop, ontmerk Aktief by alle variante behalwe een en stoor elkeen. Ou variante bly in die bestelgeskiedenis." / "To sell this as one item again, untick Active on every variant but one and save each. Old variants stay in the order history."
- **Acceptance:**
  - New product, turn on Different variants: variant rows and New variant appear before any save. One save creates the product and its variants.
  - A new product is inactive until ticked.
  - Editing product B, then saving product A, leaves B's unsaved edits in place.
  - At 390px each variant is a stacked card with label, price, stock, active and Save together, with no horizontal scroll.
  - Every variant input announces its product and variant.
- **Tests:** `admin-products.spec.ts` covers `mergeProducts`: (a) an edited draft of B survives a save of A, (b) A takes the fresh copy, (c) an unsaved new draft survives, (d) a product new on the server is added. Run build and all unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/admin/admin-products.ts src/Vasbyt.Frontend/src/app/pages/admin/admin-products.spec.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Products: add variants before the first save, name each save, keep other drafts"`

### T2.2 Tariffs: intentional end time, overlap warning, plain warning

- **Findings:** D6
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.ts`, `src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.spec.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. `add()` sets `to: ''` (keep `from: now`).
  2. Export `RuleDraft` and a pure `windowError(from: string, to: string): TranslationKey | null`: `admin.validToRequired` when `fromSast(to)` is empty, `admin.validToAfterFrom` when `to <= from` (the `YYYY-MM-DDTHH:mm` strings compare correctly as text), else `null`. In `save()`, set `r.error = i18n.t(key)` and return without calling the API when it is not null. The server already refuses `to <= from`, but in Afrikaans.
  3. Export a pure `overlaps(r: RuleDraft, all: RuleDraft[]): boolean`: true when another rule with the same `tariffKind`, both active, both with complete windows, satisfies `a.from < b.to && b.from < a.to`. Under such a rule show `<p class="alert">{{ i18n.t('admin.ruleOverlap') }}</p>` (a warning, not blocking). Matches `Pricing.RuleAsync`: the earliest-starting open window wins.
  4. Add `<small class="field__hint">{{ i18n.t('admin.validToHint') }}</small>` under the Valid to input.
  5. Change the `admin.liveWarning` copy. Keep the live buyer-price card.
  6. Add a `loaded` signal; show `common.loading` before the first response instead of `admin.noRules`.
- **Keys** (AF / EN):
  - `admin.liveWarning` (change): "Veranderinge geld dadelik vir nuwe aankope." / "Changes apply to new purchases immediately."
  - `admin.validToHint`: "Die reël geld tot op hierdie tyd. Die volgende reël neem dan oor." / "The rule applies until this time. The next rule takes over from then."
  - `admin.validToRequired`: "Kies wanneer hierdie reël eindig." / "Choose when this rule ends."
  - `admin.validToAfterFrom`: "Die einde moet ná die begin wees." / "The end has to be after the start."
  - `admin.ruleOverlap`: "Hierdie reël oorvleuel met 'n ander aktiewe reël vir dieselfde tarief. Die een wat eerste begin, geld totdat dit eindig." / "This rule overlaps another active rule for the same tariff. The one that starts first applies until it ends."
- **Acceptance:**
  - New tariff rule shows an empty Valid to. Saving it shows "Choose when this rule ends." with no request sent.
  - An end before the start is refused in the reader's language.
  - Two overlapping active Standard rules both show the overlap note.
  - The warning reads "Changes apply to new purchases immediately."
- **Tests:** extend `admin-tariffs.spec.ts` with `windowError` (empty end, end before start, valid) and `overlaps` (same kind overlapping, different kind, inactive, touching end-to-start not overlapping). Run build and all unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.ts src/Vasbyt.Frontend/src/app/pages/admin/admin-tariffs.spec.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Tariffs: require an end time, flag overlaps, plain live warning"`

**Wave 2 review.**

---

## Wave 3: P2 journey clarity (receipt, steps, home, auth pages)

### T3.1 Receipt separates "paid" from "registered"

- **Findings:** R7
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/register-done.ts`, `src/Vasbyt.Frontend/src/app/shared/calendar.ts`, `src/Vasbyt.Frontend/src/app/shared/calendar.spec.ts`, `i18n/af/registreer.ts`, `i18n/en/registreer.ts`
- **Change:**
  1. Steps rail: `<vb-steps [current]="outstanding().length ? 'forms' : 'done'" [tickets]="kind() === 'event'" />`.
  2. For a paid event order with outstanding forms: the `h1` is `done.titleFormOpen` (one form) or `done.titleFormsOpen` (with `{n}` replaced); the lead is `done.bodyFormsOpen`; directly under the lead add `<a class="btn btn--primary btn--lg" [routerLink]="['/registreer', o.token, 'deelnemer', outstanding()[0].n]">{{ i18n.t('done.finishForms') }}</a>`. With no outstanding forms keep `done.title` / `done.body` (title copy changes below). Shop and donation receipts are unchanged.
  3. At the end of the "What to do next" panel: `<p>{{ i18n.t('done.help') }} <a [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('helpmekaar.email') }}</a></p>`.
  4. Move the body of the `eventDates` computed into `calendar.ts` as `export function eventDateRange(days: EventDay[], locale: string, toWord: string): string` (uses `formatDate` from `@angular/common`), and call it from `register-done.ts`. T3.3 reuses it.
- **Keys** (AF / EN):
  - `done.titleFormsOpen`: "Betaling ontvang. Nog {n} deelnemersvorms om in te vul." / "Payment received. {n} participant forms still to complete."
  - `done.titleFormOpen`: "Betaling ontvang. Nog een deelnemersvorm om in te vul." / "Payment received. One participant form still to complete."
  - `done.bodyFormsOpen`: "Elke deelnemer kry eers 'n QR-pas wanneer sy of haar vorm ingevul is. Jy kan dit nou doen of later na hierdie blad terugkeer." / "Each participant gets a QR pass once their form is complete. You can do it now or come back to this page later."
  - `done.finishForms`: "Voltooi die deelnemersvorms" / "Finish the participant forms"
  - `done.help`: "Vrae? Kontak die organiseerders:" / "Questions? Contact the organisers:"
  - `done.title` (change): "Inskrywing voltooi!" / "Registration complete!"
- **Acceptance:** order 000017 (paid, 2 blank forms) leads with "Payment received. 2 participant forms still to complete.", one primary button to form 1, and the rail on Forms. After both forms are done it reads "Registration complete!" with the rail on Done. Shop-only receipts show no participant language. The help email link is present.
- **Tests:** `calendar.spec.ts` adds `eventDateRange` cases with locale `'en'`: two dates give "29 April 2027 to 1 May 2027", one date gives one date, no days give `''`. Run build and all unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/register-done.ts src/Vasbyt.Frontend/src/app/shared/calendar.ts src/Vasbyt.Frontend/src/app/shared/calendar.spec.ts src/Vasbyt.Frontend/src/app/i18n/af/registreer.ts src/Vasbyt.Frontend/src/app/i18n/en/registreer.ts && git commit -m "Receipt says payment received and forms outstanding until forms are done"`

### T3.2 Readable step count on phones, journey up front

- **Findings:** R4
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/pages/steps.ts`, `i18n/af/registreer.ts`, `i18n/en/registreer.ts`
- **Change:**
  1. `steps.ts` template, directly after `</ol>`: `<p class="steps__count">{{ i18n.t('reg.step') }} {{ at() + 1 }} {{ i18n.t('reg.of') }} {{ phases().length }}</p>`
  2. Styles, after the `.steps__n` rule: `.steps__count { display: none; margin: calc(-1 * var(--space-6)) 0 var(--space-6); font-weight: 600; color: var(--ink); }`. Inside the existing `@media (max-width: 720px)` block add `.steps__count { display: block; }`.
  3. Change `reg.chooseIntro`: AF "Kies hoeveel mense jy in elke kategorie inskryf. Jy kan daarna opsionele produkte byvoeg en dan een keer betaal. Ná betaling vul jy een vorm per persoon in: naam, ID-nommer, kontakbesonderhede, adres en 'n noodkontak." / EN "Choose how many people you are entering in each category. You can then add optional products and pay once. After payment you fill in one form per person: name, ID number, contact details, address and an emergency contact."
- **Acceptance:** at 390px `/registreer` shows "Step 1 of 6" under the rail; desktop unchanged; the intro names products, single payment and per-person forms.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/steps.ts src/Vasbyt.Frontend/src/app/i18n/af/registreer.ts src/Vasbyt.Frontend/src/app/i18n/en/registreer.ts && git commit -m "Show step count on phones and explain the whole entry journey up front"`

### T3.3 Home: dates and place beside the CTA, route links, gallery pause

- **Findings:** V3, V4, V7
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/home.ts`, `i18n/af/home.ts`, `i18n/en/home.ts`
- **Change:**
  1. **V3.** Add a `routesLoaded` signal (set in the `routes()` next and error handlers). Under `.hero__actions`, when `days().length`: `<p class="hero__when">{{ eventDateRange(days(), i18n.locale(), i18n.t('done.to')) }} · {{ i18n.t('home.where') }}@if (!datesConfirmed()) { ({{ i18n.t('home.provisional') }})}</p>` styled white, `1.0625rem`, weight 600. Show the existing `home.dates` line only when `routesLoaded() && !days().length`, so nothing provisional flashes while loading. The countdown stays below as is.
  2. **V4.** In each route card, after the difficulty meter: `<a class="btn btn--ghost btn--sm" [routerLink]="['/roetes', r.code]" [attr.aria-label]="i18n.t('routes.view') + ': ' + r.name">{{ i18n.t('routes.view') }}</a>`.
  3. **V7.** Add a `userPaused` signal. `resume()` returns early when `userPaused()`. Render, only when not `reduced()`, a `<button type="button" class="btn btn--ghost btn--sm gallery__toggle" [attr.aria-pressed]="userPaused()" (click)="togglePlay()">` in `.gallery-heading`, with text `home.playGallery` when paused and `home.pauseGallery` otherwise. `togglePlay()` flips the signal and calls `pause()` or `resume()`. Hover and focus pausing stay.
- **Keys** (AF / EN): `home.where`: "Orania, Noord-Kaap" / "Orania, Northern Cape"; `home.pauseGallery`: "Pouseer foto's" / "Pause photos"; `home.playGallery`: "Speel foto's" / "Play photos".
- **Acceptance:**
  - The hero shows "29 April 2027 to 1 May 2027 · Orania, Northern Cape" beside Enter now, with "(Provisional date)" while unconfirmed. There is no flash of "to be confirmed" on load.
  - Each home route card has a View the route link to its detail page.
  - Pause stops the slideshow until Play, including after hover-out.
  - With reduced motion there is no button and no autoplay.
- **Tests:** build (watch the `home.ts` style budget) and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/home.ts src/Vasbyt.Frontend/src/app/i18n/af/home.ts src/Vasbyt.Frontend/src/app/i18n/en/home.ts && git commit -m "Home: event dates and place by the CTA, route links, gallery pause"`

### T3.4 One supporting photo on sign-in and account creation

- **Findings:** V6
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/pages/sign-in.ts`, `src/Vasbyt.Frontend/src/app/pages/create-account.ts`
- **Change (both files):**
  1. Wrap the existing `<form ...>...</form>` in `<div class="auth-split">` and add, after the form and inside the div: `<img class="auth-photo" src="/foto/vasbyt-saam.webp" alt="" loading="lazy" decoding="async" />`
  2. Append to `styles`:
     ```
     .auth-split { display: grid; gap: var(--space-8); align-items: start; }
     .auth-photo { display: none; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--r-lg); }
     @media (min-width: 1024px) { .auth-split { grid-template-columns: minmax(0, 32rem) minmax(0, 1fr); } .auth-photo { display: block; } }
     ```
     In `sign-in.ts` use `minmax(0, 26rem)` instead of `32rem` to match its `.auth` width.
- **Acceptance:** at 1440px the photo sits right of the form; below 1024px there is no photo and the primary button is exactly where it was; the form keeps its white card.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/sign-in.ts src/Vasbyt.Frontend/src/app/pages/create-account.ts && git commit -m "Add an event photo beside sign-in and account creation on desktop"`

**Wave 3 review.**

---

## Wave 4: P2 language, recovery and error states

### T4.1 Auth errors in the reader's language, recovery with a next step

- **Findings:** A5
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/sign-in.ts`, `src/Vasbyt.Frontend/src/app/pages/password-reset.ts`, `i18n/af/common.ts`, `i18n/en/common.ts`
- **Change:**
  1. Sign-in error: status 401 gives `auth.wrongCredentials`, 423 gives `auth.lockedOut`, anything else `common.error`. Stop showing the Afrikaans server `detail`.
  2. ForgotPassword: call `api.config()`. When `registrationEmails` is false (same condition as the server's `ResendEmailSender.IsAvailable`), show `<p class="alert">auth.recoveryUnavailable</p>` plus `mailto:` and `tel:` links built from `helpmekaar.email` and `helpmekaar.phone` instead of the email field. A 503 answer shows the same state. Until config answers, the form shows as today.
  3. ResetPassword: a 400 shows `auth.resetFailed` plus a link to `/wagwoord-vergeet` with `auth.forgotSubmit`; other errors show `common.error`.
- **Keys** (AF / EN):
  - `auth.wrongCredentials`: "Verkeerde e-pos of wagwoord." / "Wrong email or password."
  - `auth.lockedOut`: "Rekening tydelik gesluit. Probeer later weer." / "Account temporarily locked. Please try again later."
  - `auth.recoveryUnavailable`: "Wagwoordherstel per e-pos is tans nie beskikbaar nie. Kontak die organiseerders, dan help hulle jou:" / "Password recovery by email is not available right now. Contact the organisers and they will help you:"
  - `auth.resetFailed`: "Hierdie herstelskakel is ongeldig of het verval, of die wagwoord is te swak. Vra 'n nuwe skakel of kies 'n sterker wagwoord." / "This reset link is invalid or has expired, or the password is too weak. Ask for a new link or choose a stronger password."
- **Acceptance:** in English demo mode, Forgot password shows the English unavailable message with tappable email and phone before any email is typed. A wrong password reads in the selected language.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/sign-in.ts src/Vasbyt.Frontend/src/app/pages/password-reset.ts src/Vasbyt.Frontend/src/app/i18n/af/common.ts src/Vasbyt.Frontend/src/app/i18n/en/common.ts && git commit -m "Translate sign-in and recovery errors and offer organiser contact"`

### T4.2 Translate the skip link and landmark labels

- **Findings:** V8 (accessibility labels)
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/app.ts`, `i18n/af/nav.ts`, `i18n/en/nav.ts`
- **Change:**
  1. `app.ts` line 15: `<a class="skip" href="#inhoud">Spring na inhoud</a>` becomes `<a class="skip" href="#inhoud">{{ i18n.t('nav.skip') }}</a>`
  2. Line 41: `<nav aria-label="Hoof">` becomes `<nav [attr.aria-label]="i18n.t('nav.mainLabel')">`
  3. Line 118: `<nav class="site-footer__nav" aria-label="Meer">` becomes `<nav class="site-footer__nav" [attr.aria-label]="i18n.t('nav.moreLabel')">`
  4. Keys (AF / EN): `nav.skip`: "Spring na inhoud" / "Skip to content"; `nav.mainLabel`: "Hoof" / "Main"; `nav.moreLabel`: "Meer" / "More".
- **Acceptance:** in English the skip link reads "Skip to content" and the landmarks are "Main" and "More".
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/app.ts src/Vasbyt.Frontend/src/app/i18n/af/nav.ts src/Vasbyt.Frontend/src/app/i18n/en/nav.ts && git commit -m "Translate the skip link and navigation landmark labels"`

### T4.3 English province names

- **Findings:** V8 (province options and map)
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/shared/province-map.ts`, `src/Vasbyt.Frontend/src/app/shared/address-input.ts`, `i18n/af/home.ts`, `i18n/en/home.ts`
- **Change:**
  1. In `province-map.ts`, above the component, add:
     ```ts
     const PROVINCE_EN: Record<string, string> = {
       'Oos-Kaap': 'Eastern Cape', Vrystaat: 'Free State', Gauteng: 'Gauteng', 'KwaZulu-Natal': 'KwaZulu-Natal',
       Limpopo: 'Limpopo', Mpumalanga: 'Mpumalanga', 'Noord-Kaap': 'Northern Cape', Noordwes: 'North West', 'Wes-Kaap': 'Western Cape',
     };
     /** Stored values stay Afrikaans; only the label changes. */
     export const provinceLabel = (name: string, locale: string) => (locale === 'en' ? PROVINCE_EN[name] ?? name : name);
     ```
  2. In `province-map.ts` inject `I18nService` as `i18n` if it is not already injected. The `<title>` becomes `{{ label(p.name) }}: {{ p.count }}` (removes the em dash). The legend name becomes `{{ label(p.name) }}`. `ariaLabel` starts with `this.i18n.t('home.mapAria') + ' '` and uses `this.label(p.name)`. Add `protected label(n: string) { return provinceLabel(n, this.i18n.locale()); }`.
  3. In `address-input.ts` import `provinceLabel` and change the option text to `{{ provinceLabel(p, i18n.locale()) }}`, with `protected readonly provinceLabel = provinceLabel;`. Keep `[value]="p"`.
  4. Keys (AF / EN): `home.mapAria`: "Inskrywings per provinsie:" / "Entries per province:".
- **Acceptance:** in English the participant form's province list and the home map read "Northern Cape" etc.; the saved value is still "Noord-Kaap" and map counts are unchanged.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/shared/province-map.ts src/Vasbyt.Frontend/src/app/shared/address-input.ts src/Vasbyt.Frontend/src/app/i18n/af/home.ts src/Vasbyt.Frontend/src/app/i18n/en/home.ts && git commit -m "Show English province names in English"`

### T4.4 Distinct loading, empty and error states with a way on

- **Findings:** V9, V8 (difficulty chip)
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/route-detail.ts`, `src/Vasbyt.Frontend/src/app/shared/difficulty-meter.ts`, `src/Vasbyt.Frontend/src/app/pages/accommodation.ts`, `src/Vasbyt.Frontend/src/app/pages/sponsors.ts`
- **Change:**
  1. `difficulty-meter.ts`: export `difficultyLabel(value: string, locale: string): string` holding the existing Maklik/Matig/Swaar map, and use it in the `label` computed.
  2. `route-detail.ts`: the hero chip `{{ r.difficulty }}` becomes `{{ difficultyLabel(r.difficulty, i18n.locale()) }}`. Add a `failed` signal set on not-found and on load error. In the `@else` branch, after the message, when `failed()`: `<a class="btn btn--primary" routerLink="/roetes">{{ i18n.t('routes.all') }}</a>`.
  3. `accommodation.ts` and `sponsors.ts`: `adverts` becomes `signal<Advert[] | null>(null)` plus a `failed` signal and a `load()` method called from the constructor. Template: null and not failed shows `<p class="muted" role="status">common.loading</p>`; failed shows `<p class="alert alert--error" role="alert">common.error</p>` and `<button class="btn btn--primary" type="button" (click)="load()">programme.retry</button>`; an empty list keeps `stay.empty` / `sponsors.empty`. Delete the stale "Wave 2" comment.
- **Acceptance:**
  - `/roetes/bestaan-nie` shows the message plus an All routes button.
  - In English the Ligstap hero chip reads "Moderate" or "Hard", matching the listing.
  - With the API stopped, Accommodation and Sponsors say something went wrong with Try again, not "coming soon".
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/route-detail.ts src/Vasbyt.Frontend/src/app/shared/difficulty-meter.ts src/Vasbyt.Frontend/src/app/pages/accommodation.ts src/Vasbyt.Frontend/src/app/pages/sponsors.ts && git commit -m "Separate loading, empty and error states and translate route difficulty"`

### T4.5 One ticket label everywhere, in the reader's language

- **Findings:** R5, V8 (order-line labels)
- **Model:** sonnet
- **Files:** `src/Vasbyt.API/Endpoints/OrderEndpoints.cs`, `tests/Vasbyt.API.Tests/ShopCheckoutTests.cs`, `src/Vasbyt.Frontend/src/app/core/api.models.ts`, new `src/Vasbyt.Frontend/src/app/shared/line-label.ts`, new `src/Vasbyt.Frontend/src/app/shared/line-label.spec.ts`, `src/Vasbyt.Frontend/src/app/pages/basket.ts`, `register-review.ts`, `register-pay.ts`, `register-done.ts`, `account.ts` (all under `pages/`), `i18n/af/registreer.ts`, `i18n/en/registreer.ts`
- **Change:**
  1. **Backend.** The `/api/orders/quote` projection (`OrderEndpoints.cs` around line 85) gains `routeCode`: load `db.RouteCategories.AsNoTracking().ToDictionaryAsync(r => r.Id, r => r.Code)` once and map `l.RouteCategoryId` through it (null for non-ticket lines). The order response already carries `RouteCode`.
  2. **Frontend.** `Quote.lines` Pick in `api.models.ts` adds `'routeCode'`.
  3. New `shared/line-label.ts`: `export function lineLabel(l: Pick<OrderLine, 'kind' | 'description' | 'routeCode' | 'tariffKind'>, t: (k: TranslationKey) => string): string`. A Ticket with `routeCode` and `tariffKind` returns `` `${t(routeKey(routeCode, 'name'))}, ${t(tariffKind === 'Student' ? 'reg.student' : 'reg.normal')}` ``. A Donation returns `t('reg.donationLine')`. Anything else returns `description` (product names are proper names).
  4. Use it wherever a buyer sees a line: `basket.ts` (the `label()` fallback chain and the quote list at line ~105), `register-review.ts` line ~100, `register-pay.ts` line ~50, `register-done.ts` line ~132, `account.ts` line ~89. Admin screens keep the stored description.
  5. Key (AF / EN): `reg.donationLine`: "Donasie aan Orania Helpmekaar" / "Donation to Orania Helpmekaar".
- **Why:** selection and participant forms already say "Ligstap" plus Standard / Student; basket to receipt showed the Afrikaans price-window label. The price-window wording is admin free text in one language (see owner decision 8), so buyers see the tariff group and the price.
- **Acceptance:** in English a standard Ligstap ticket reads "Ligstap, Standard" on selection, basket, checkout, payment, receipt and account; in Afrikaans "Ligstap, Normaal"; the donation line is English in English.
- **Tests:** `ShopCheckoutTests`: a ticket quote line has `routeCode` equal to the route's code. `line-label.spec.ts`: ticket, student ticket, donation, product pass-through, using a stub `t` that echoes keys. Run `dotnet build Vasbyt.sln`, `dotnet test tests/Vasbyt.API.Tests` (Docker), then the frontend build and unit tests.
- **Commit:** `git add src/Vasbyt.API/Endpoints/OrderEndpoints.cs tests/Vasbyt.API.Tests/ShopCheckoutTests.cs src/Vasbyt.Frontend/src/app/core/api.models.ts src/Vasbyt.Frontend/src/app/shared/line-label.ts src/Vasbyt.Frontend/src/app/shared/line-label.spec.ts src/Vasbyt.Frontend/src/app/pages/basket.ts src/Vasbyt.Frontend/src/app/pages/register-review.ts src/Vasbyt.Frontend/src/app/pages/register-pay.ts src/Vasbyt.Frontend/src/app/pages/register-done.ts src/Vasbyt.Frontend/src/app/pages/account.ts src/Vasbyt.Frontend/src/app/i18n/af/registreer.ts src/Vasbyt.Frontend/src/app/i18n/en/registreer.ts && git commit -m "Name ticket and donation lines the same way on every buyer page"`

**Wave 4 review.**

---

## Wave 5: P2 admin clarity

### T5.1 Accommodation and sponsors editor

- **Findings:** D5
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-adverts.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. The three filter chips: `[attr.aria-selected]` becomes `[attr.aria-pressed]` (same values; `_base.scss` styles both).
  2. Replace the single New advert button with two: `<button class="btn btn--accent" type="button" (click)="add('Accommodation')">{{ i18n.t('admin.addAccommodation') }}</button>` and `<button class="btn btn--ghost" type="button" (click)="add('Sponsor')">{{ i18n.t('admin.addSponsor') }}</button>`. `add()` becomes `add(kind: 'Accommodation' | 'Sponsor')` and sets `kind` from it. Delete `admin.newAdvert` from both dictionaries (no other use).
  3. Wrap the Booking link and Phone `<label class="field">` elements in `@if (a.kind === 'Accommodation') { ... }`. The public sponsors page uses neither field.
  4. Key changes (AF / EN): `admin.tabAdverts`: "Verblyf en borge" / "Accommodation and sponsors"; `admin.sortOrder`: "Vertoonvolgorde" / "Display order"; `admin.linkUrl`: "Webwerfadres" / "Website address". New: `admin.addAccommodation`: "Voeg verblyf by" / "Add accommodation"; `admin.addSponsor`: "Voeg borg by" / "Add sponsor".
- **Acceptance:** the tab reads Accommodation and sponsors; Add sponsor opens a sponsor draft with no booking or phone fields; the image-required note is unchanged.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/admin/admin-adverts.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Separate accommodation and sponsor actions in admin"`

### T5.2 Shared walking routes link to their source

- **Findings:** D7
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-routes.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. `<article class="card route">` gets `[id]="'route-' + r.code"`.
  2. Directly after the `admin.usesRoute` paragraph add `<button class="btn btn--ghost" type="button" (click)="goTo(src)">{{ i18n.t('admin.editShared').replace('{name}', i18n.t(key(src, 'name'))) }}</button>`.
  3. Add the method: `protected goTo(code: string) { const el = document.getElementById('route-' + code); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); el?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true }); }`
  4. Key changes (AF / EN):
     - `admin.usesRoute`: "Afstand, klim, graad en dae kom van {name}. Veranderinge daar geld vir albei." / "Distance, climb, grade and days come from {name}. Changes there apply to both."
     - `admin.routesIntro`: "Die ses kategorieë en hul kodes is vas. Staproetes deel hul afstand, klim, graad en dae met 'n drafroete; wysig dit by die drafroete." / "The six categories and their codes are fixed. Walking routes share their distance, climb, grade and days with a running route; edit those on the running route."
     - New `admin.editShared`: "Wysig die gedeelde roete by {name}" / "Edit the shared route on {name}"
- **Acceptance:** on Ligstap the button scrolls to Ligdraf and focuses its first field; the intro no longer says walking routes get their own distances here.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/admin/admin-routes.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Link shared walking routes to the running route that owns their details"`

### T5.3 Participants: one search convention, no technical dates

- **Findings:** D9
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-entrants.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. Make the search work like Orders (`admin-orders.ts` lines 24 to 38): wrap the search field in `<form (ngSubmit)="reload()">` with `name="q"` and a `<button class="btn btn--primary" type="submit">{{ i18n.t('admin.searchButton') }}</button>`; drop `(change)="reload()"`. Any `ngModel` left inside the form needs a `name` or `[ngModelOptions]="{ standalone: true }"`. The checkbox and route chips keep applying at once.
  2. Detail panel date of birth: `{{ d.dateOfBirth?.startsWith('0001') ? i18n.t('admin.notProvided') : d.dateOfBirth }}`.
  3. Key (AF / EN): `admin.notProvided`: "Nie verskaf nie" / "Not provided".
- **Acceptance:** typing then Enter or Search runs the search in both Orders and Participants; a blank participant's details show "Not provided", never `0001-01-01`.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/admin/admin-entrants.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Participants search like orders and hide placeholder birth dates"`

### T5.4 Reception and administrator wording

- **Findings:** D10, D12
- **Model:** haiku
- **Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-scan.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. `admin-scan.ts` sibling option (line ~89): `{{ s.fullName }}` becomes `{{ (s.fullName || '').trim() || i18n.t('admin.blankForm') }}`.
  2. Key changes (AF / EN): `scan.others`: "Ander deelnemers in hierdie bestelling" / "Other participants in this order"; `admin.addAdmin`: "Gee toegang of stuur uitnodiging" / "Grant access or send invite".
- **Acceptance:** the scan picker reads "Other participants in this order (n)" and an unfinished person shows "Form still blank / Ligtrap (form incomplete)"; the administrators button names both outcomes.
- **Tests:** build and unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/pages/admin/admin-scan.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Clearer reception and administrator wording"`

### T5.5 Image crop without dragging

- **Findings:** D11
- **Model:** sonnet
- **Files:** `src/Vasbyt.Frontend/src/app/shared/image-cropper.ts`, `i18n/af/admin.ts`, `i18n/en/admin.ts`
- **Change:**
  1. Stage: `tabindex="0"`, `role="group"`, `[attr.aria-label]="i18n.t('admin.cropHint')"`, `(keydown)` handling ArrowUp/Down/Left/Right (move 10px, `preventDefault`).
  2. Under the zoom slider: a row of five `btn btn--ghost btn--sm` buttons (up, down, left, right, centre) with `aria-label`s from the keys below and arrow glyphs as text. Every move goes through `clampOffset`. Centre sets the offset that centres the image at the current zoom.
  3. Key changes (AF / EN): `admin.cropHint`: "Sleep die prent, of gebruik die pyltjieknoppies of -sleutels om dit te skuif, dan sny." / "Drag the image, or use the arrow buttons or keys to move it, then crop." New: `admin.cropUp` "Skuif op" / "Move up"; `admin.cropDown` "Skuif af" / "Move down"; `admin.cropLeft` "Skuif links" / "Move left"; `admin.cropRight` "Skuif regs" / "Move right"; `admin.cropCentre` "Sentreer" / "Centre".
  4. Check first: `admin-programme.spec.ts` queries `button[aria-label="Skuif op"]` inside the programme editor. The cropper is not rendered there, so there is no clash, but confirm that spec still passes.
- **Acceptance:** a crop can be positioned with keyboard only and with taps only; the uploaded crop matches the frame (the existing maths tests still pass).
- **Tests:** build and all unit tests.
- **Commit:** `git add src/Vasbyt.Frontend/src/app/shared/image-cropper.ts src/Vasbyt.Frontend/src/app/i18n/af/admin.ts src/Vasbyt.Frontend/src/app/i18n/en/admin.ts && git commit -m "Let admins position a crop with buttons or arrow keys"`

**Wave 5 review.**

---

## Needs owner decision

No task guesses these. Draft the question to the site owner exactly as written.

1. **Event times (V2).** "Which times are correct? (a) Thursday: the programme says start 18:15 and gather 18:00; every route day and the Dorpsdraf paragraph say 18:00. (b) Saturday: the programme says 06:30; Vasbyt and Ligtrap say 06:30, but Vastrap, Ligdraf and Ligstap say 06:00 (after a 05:30 truck). (c) Friday braai: the programme says fires are lit at 17:00; the braai paragraph says welcome from 17:00 and the fire at 18:00. Are the per-route differences intended? If so, should the programme list them?" Once answered: the owner edits Programme and Routes in admin, and a follow-up task fixes `program.dorpsdrafBody` / `program.braaiBody`. T1.4 and T1.5 are the safe parts done now.
2. **Indemnity text (R3).** "Please supply the exact indemnity (vrywaring) wording participants agree to, in Afrikaans and English, and confirm the 11 terms on the programme page are the version they agree to." Then a follow-up adds "Read the indemnity" beside the consent checkbox, like T1.3's terms disclosure.
3. **Shirt size (R6).** "Does every entry include a shirt? If yes, is the size on the participant form for that included shirt, separate from shirts bought in the shop? If not, should the field be optional or removed?"
4. **Participant drafts across refresh (R1).** "May an unfinished participant form, including ID number and medical details, be kept when the page is refreshed? Options: (a) no, keep the leave-page warning (done in T1.3), (b) keep it in this browser tab only until it is closed, (c) save drafts on the server against the order."
5. **Account holder as a participant (A1).** "Should an account record which participant, if any, is the account holder, with an 'I am registering other people only' choice? This needs a new field on the order or participant." T1.2 and T1.3 do the copy part now.
6. **Eligibility (V10).** "What are the age limits per route, and what proof is needed for the student and scholar fee?" FAQ q2 and q15 are marked DRAFT. Once answered, show it beside the fee choice on `/registreer`.
7. **Emergency number (V10).** "Is Eureka, 072 559 8850 the right emergency number on the About page? The source notes that the supplied documents disagree."
8. **English for managed content (V8, R5).** "Will you keep English versions of product, advert and route descriptions and of tariff labels (for example 'Vroeë inskrywing')? If yes, we add English fields to the admin editors; if no, Afrikaans stays the single version."
9. **Real media (V5).** "Can you supply photos of the shirt (front, back, detail), a size guide, the supporters' pack contents, and accommodation details (location, rooms, price range, booking contact)?" These are uploaded through admin, so no code change is needed.

## Deferred

- **D8 programme editor redesign** (day navigation, one activity open at a time): large rework with no defect. Revisit after owner decision 1.
- **D4 full conversion flow** (pick the variant to keep, preview): T2.1 fixes the misleading copy; the flow is a later design.
- **D12 outcome before granting access**: needs a new account lookup endpoint; T5.4 names both outcomes on the button.
- **D9 numbering blank participants and showing applied filters**: needs the participant's position in the admin API; the pressed chips already show filters.
- **D10 grouping arrival and collection**: the scan screen tested well; only wording changed.
- **R2 sections, progress and review step**: a redesign; the T1.3 summary removes the blocking barrier first.
- **R4 sticky mobile basket summary** and **V4 route comparison view**: P2 enhancements with no defect behind them.
- **V10 FAQ grouping, jump links and in-task help links**: P3.
- **Admin loading states for Orders, Adverts and Routes** (V9 source-only): Products and Tariffs are done in Wave 2; the rest are cosmetic flashes.
- **Validation the audit could not run:** sessions with older Afrikaans and English users, screen reader use, 200% zoom, a full keyboard-only walkthrough, physical phone cameras, production payment and email paths, and the final waiver submission. These need real devices and people, not code.

## Coverage

| Finding | Task |
|---|---|
| A1 | T1.2, T1.3 (copy); owner decision 5 |
| A2, A3, A4 | T1.2 |
| A5 | T4.1 |
| R1 | T1.3; owner decision 4 |
| R2 | T1.3 |
| R3 | T1.3 (terms); owner decision 2 |
| R4 | T3.2 |
| R5 | T4.5 |
| R6 | owner decision 3 |
| R7 | T3.1 |
| D1, D2, D3 | T2.1 |
| D4 | T2.1 (copy), deferred |
| D5 | T5.1 |
| D6 | T2.2 |
| D7 | T5.2 |
| D8 | deferred |
| D9 | T5.3 |
| D10, D12 | T5.4 |
| D11 | T5.5 |
| V1 | T1.1 |
| V2 | T1.4, T1.5; owner decision 1 |
| V3, V4, V7 | T3.3 |
| V5 | owner decision 9 |
| V6 | T3.4 |
| V8 | T4.2, T4.3, T4.4, T4.5; owner decision 8 |
| V9 | T4.4 |
| V10 | owner decisions 6, 7; deferred |
