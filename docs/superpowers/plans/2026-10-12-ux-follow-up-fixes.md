# UX follow-up fixes implementation plan

**Goal:** Fix review findings 3, 2 and 5: participant draft warnings, sibling product edits lost after saves, and raw server errors in account creation and participant forms.

**Approach:** Keep the current screens, API routes and in-memory draft policy. Limit product refreshes to the operation that completed. Add machine-readable error codes to existing problem responses and translate only recognised codes in the frontend.

**Execution:** One Luna subagent implements the three tasks in this checkout. The parent reviews the complete diff and verifies the affected cases. No Git mutations, migrations, new dependencies, persistent sensitive drafts, unrelated redesigns, or account identity selection.

## Constraints

- Preserve all existing work. Git is read-only, including staging and commits.
- Never write a project tracker or board.
- Comments stay on one line. Prose uses no em or en dashes.
- Write a failing regression test before each production fix and record the failure and subsequent passing command.
- Reuse Angular, Jasmine/Karma and xUnit already installed.
- Build the frontend into a temporary directory so verification does not replace the running API's website.

## Task 1: Product save scope

**Files:** `src/Vasbyt.Frontend/src/app/pages/admin/admin-products.ts` and `admin-products.spec.ts`.

**Root cause:** `saveVariant` calls `refresh(productId)`. `mergeProducts` replaces the whole saved product. The product details button also replaces its entire variant list even when it saves only details.

- [ ] Add component-level regressions that edit two existing variants of one product, save one, and assert the sibling still contains the unsaved price and stock. Assert the edited product description also survives.
- [ ] Test the inverse: save details on a product with labelled variants and retain edited existing variants and unsaved new variant rows.
- [ ] Test creating a variant: apply its returned ID, preserve other draft rows, and ensure a subsequent save updates that variant rather than creating it again.
- [ ] Test typing while a save/refetch is pending. A later response must not overwrite newer input.
- [ ] Run these tests against the current implementation and confirm the data-loss failure.
- [ ] Replace whole-product refresh semantics with explicit save scope. Product details saves refresh details; variant saves refresh only that row. Single-product saves still save details plus their single price/stock row, and new-product first saves still create all submitted variants.
- [ ] Snapshot submitted fields. When applying a response, keep any current field that differs from its submitted value. Preserve sibling variant versions so their existing optimistic concurrency checks remain valid.
- [ ] Preserve server IDs and confirmed versions for successfully saved rows. Do not increment versions speculatively. Keep an existing row's old version if its unsaved stock state would otherwise be silently rebased past a conflict.
- [ ] Keep failure and partial batch recovery working. A 409 must not silently discard unrelated edits or overwrite current stock. Removal/deactivation refreshes must apply the server outcome without restoring a deleted row, while preserving sibling drafts.
- [ ] Run product regressions and inspect every caller of the changed refresh/merge helper.

## Task 2: Warn for every unsaved participant draft

**Files:** `src/Vasbyt.Frontend/src/app/core/order-flow.service.ts`, `order-flow.service.spec.ts`, `src/Vasbyt.Frontend/src/app/pages/register-entrant.ts`, and `register-entrant.spec.ts`.

**Root cause:** The component's beforeunload handler checks only its current form. Earlier drafts remain in the service map, which disappears on refresh. Once the component is destroyed, no component handler remains.

- [ ] Add a regression that enters participant 1, switches to untouched participant 2, dispatches a cancelable `beforeunload` event and asserts `defaultPrevented`.
- [ ] Add a service regression that an in-memory participant draft still warns when no participant component is mounted.
- [ ] Verify untouched forms do not warn, clearing the last draft stops the warning, and sign-out clears private drafts.
- [ ] Verify the current dirty form still warns, including while a save is pending. Only a successful server save removes protection for that draft.
- [ ] Run the new tests and confirm failures in the current implementation.
- [ ] Add a small draft-presence query to the shared service. Its root-lifetime beforeunload listener prevents unloading while the map contains any drafts. Keep the component handler for current input that has not yet entered the map.
- [ ] Have the component warning include draft presence and avoid suppressing protection merely because a save is busy or the current participant is complete.
- [ ] Keep participant navigation working and keep drafts exclusively in memory. Do not add localStorage/sessionStorage/server persistence for identity or medical information.
- [ ] Run the service and participant regressions.

## Task 3: Translated account and participant errors

**Files:** `src/Vasbyt.API/Endpoints/AuthEndpoints.cs`, participant-save responses in `OrderEndpoints.cs`, `src/Vasbyt.Frontend/src/app/pages/create-account.ts`, `register-entrant.ts`, translations in `i18n/af/common.ts`, `i18n/en/common.ts`, `i18n/af/registreer.ts`, `i18n/en/registreer.ts`, and their frontend tests. Add focused API regression tests under `tests/Vasbyt.API.Tests/` using `VasbytFactory`.

**Root cause:** Both submit handlers display `error.detail`. Identity emits English descriptions; participant validation emits Afrikaans regardless of selected language.

- [ ] Add API tests asserting stable problem-response codes for duplicate email, weak password, invalid invitation and representative participant validation/conflict cases. Existing HTTP status and business rules must remain intact.
- [ ] Add frontend tests asserting account duplicate-email, password and invitation messages in both languages. Cover unknown code, missing code, network failure and server error with a distinctive raw `detail` that must never appear.
- [ ] Add participant frontend tests for validation, payment required, missing order/participant, checked-in participant and save conflict in both languages, preserving entered values after failure.
- [ ] Run the new tests and confirm current failures.
- [ ] Add a `code` extension to existing relevant `Results.Problem` responses. Keep human-readable `detail` for compatibility, but never parse it in the frontend.
- [ ] Map Identity's known error codes to stable public registration codes: duplicate address, invalid address, password requirements and invalid invitation. Unknown failures get a generic registration code. Password messaging must match the configured policy: at least eight characters, uppercase, lowercase and a digit; punctuation is optional.
- [ ] Add stable participant codes for the existing validation branches and checked-in/concurrent-save failures. Use status-based translated fallback for 403, 404 and uncoded 409, plus `common.error` for network/server/unknown failures.
- [ ] Use a small explicit whitelist of code-to-translation-key mappings in these forms, or a shared helper only if it removes actual duplication. Do not surface arbitrary code or detail text.
- [ ] Add matching English and Afrikaans translation keys. Keep the existing error alert and validation focus behaviour.
- [ ] Run frontend and API regressions, including existing payment-gate and admin-invite tests.

## Verification

- [ ] Frontend: `npm test -- --watch=false --browsers=ChromeHeadless` in `src/Vasbyt.Frontend`. If Chrome sandbox launch is unavailable, use a temporary Karma configuration outside the repo with the installed Chrome and a no-sandbox launcher; do not change project configuration.
- [ ] Build: `npm run build -- --output-path=/tmp/vasbyt-ux-follow-up-build` in `src/Vasbyt.Frontend`.
- [ ] API: `dotnet test tests/Vasbyt.API.Tests/Vasbyt.API.Tests.csproj --no-restore`.
- [ ] Parent review: inspect the changes and ensure product saves cannot overwrite sibling drafts, warnings remain until the relevant saves succeed, all known messages translate, and raw detail is hidden for unknown failures.
- [ ] Read `git status`, `git diff --check` and recent reflog entries before reporting completion. Report any failed or unavailable check precisely. Leave changes in the working tree.

## Review focus

1. Unsaved S and M prices in one shirt, plus an edited description: saving S keeps M and description.
2. A new variant receives its real ID without duplicating a draft on the next save.
3. A participant draft on a different tab, or after returning Home, still protects against refresh.
4. An in-flight save must not suppress warnings or erase newer edits.
5. Unknown API errors must display translated fallback text, never Identity or server details.

## Completion record

All three fixes were implemented by Luna and reviewed against their callers and regression cases. Review also corrected IDs after failed refetches, null stock normalisation, partial batch preservation, stock concurrency during pending saves, inherited-property error codes, and deletion controls during a new product's first save.

Final parent-run verification:

- Frontend suite: 79 tests passed with `npm test -- --watch=false --browsers=ChromeHeadless`.
- API suite: 101 tests passed with `dotnet test tests/Vasbyt.API.Tests/Vasbyt.API.Tests.csproj --no-restore`.
- Production build passed with output at `/tmp/vasbyt-ux-follow-up-final-build`.
- `git diff --check` passed. Git state was read only; changes remain uncommitted.
- Frontend tests emit Angular NG0956 list-tracking warnings. No full manual end-to-end retest was performed.
- Participant drafts still live in memory only. The fixes add unload protection, not persistence after an accepted refresh or close.
