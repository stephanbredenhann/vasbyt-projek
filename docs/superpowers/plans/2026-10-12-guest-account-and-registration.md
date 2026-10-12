# Guest to account, and smoother registration (plan)

Planned by an Opus 5.5 agent with no codebase access, from Haiku exploration findings. Section "Fit with today's code" was added after, from the exploration.

## Fit with today's code

Already there, reuse:
- `Order.Language`, `Order.BuyerEmail`, nullable `Order.UserId`, `Order.PublicToken` (Entities.cs).
- Resend client with retries and Idempotency-Key (Services/ResendClient.cs). Bilingual confirmation and pass emails.
- DataProtection keys already persisted to the `dp-keys` volume (deploy/compose.yaml), usable for encrypting drafts.
- `POST /api/orders/{token}/claim` exists but the SPA never calls it, and it has no tests. Replace it with the claim-link flow below.

Must change:
- `POST /api/orders/{token}/link` lets any signed-in holder of the token take an unowned order, even unpaid, with no email match. Remove it; ownership comes only from a verified buyer email.
- `PassQueue` is `Task.Run` fire-and-forget and loses mail on restart. Move confirmation and pass emails onto an outbox.
- `PUT /api/orders/{token}/entrants/{id}` accepts edits to a completed entrant (UI locks it, server does not).
- Accounts have `RequireConfirmedAccount=false` and no verification, so auto-linking by email is unsafe until verification exists.

Spotted in passing, not part of this plan:
- `Payments__DemoEnabled` defaults to `true` in deploy/compose.yaml and OrderEndpoints.cs. Unless set on the server, the demo button marks orders paid for free. Check production.
- Checkout and payment errors show raw Afrikaans server `detail` in English mode.

## Owner decisions (2026-10-12)

- Passwords stay (client requirement). Sign-in by emailed code is an extra option, not the default. Section 1's "passwordless first" is overridden.
- Keep the optional create-account hint at checkout, before payment.
- Phase 4 is out of scope.
- Encrypted server-side participant drafts: yes. Separate details deadline: no.
- Still open: per-participant links (Phase 3).

## Phase 1 as built

- Confirmation email carries a "Create your account" link for unowned orders: the buyer email, signed and time-limited (90 days) with Data Protection, same pattern as AdminInvite. No new table.
- Register or sign in with that link marks the email confirmed and collects every unowned order with that buyer email. Code sign-in and password reset also confirm the email.
- Payment joins an order to a confirmed account with the buyer's email.
- `/link` and the unused `/claim` endpoint are removed. The receipt says the link was emailed, with "Send the link again" (`POST /api/orders/{token}/account-link`, capped at one email per order per hour).
- Sign-in page has "Email me a code instead" (Identity's email token provider, lockout after 10 wrong codes).
- Deferred from the plan's Phase 1: email outbox, hashing and expiring order tokens, rate limiting, Referrer-Policy.

---

## Phase 2 as built

- Participant answers autosave to the server as you type (`GET`/`PUT /api/orders/{token}/entrants/{id}/draft`), encrypted with Data Protection in `Entrant.Draft`, cleared on submit. Refresh no longer loses work; the leave warning shows only while a save is pending or failed.
- A valid SA ID number fills date of birth and gender (editable); a 13-digit number that fails the checksum gets a soft warning, so passports still work.
- Medical fields hide behind a Yes/No question, unanswered by default.
- "Use {name} as emergency contact" offers the last saved contact on the next form.
- Reminder emails for unfinished forms, 1 and 7 days after payment, at most one each (`FormReminders`, hourly).
- Deferred: the 5-step stepper, the checkout "I'm also taking part" box (the existing "This is me" button covers it), encrypting submitted ID and medical columns, ConsentRecord, ID HMAC, purging stale drafts after the event.

## 1. Guest to account model

An account is a verified email. Sign-in is passwordless by default (password optional), and "create account" and "sign in" are one flow: no signup form, no "email already registered" error, nothing to enumerate.

**Claim link (in the confirmation email)**
- Random 256-bit token in a new `AuthToken` table, only its SHA-256 hash stored. Not a JWT: single use and revocation need state anyway.
- Bound to the buyer's normalised email (and the order for context). Single use, 14 days.
- A GET never consumes it (Outlook Safe Links and similar prefetch links). The page shows "Create your Vasbyt account for s****@gmail.com" with one Continue button that POSTs. Consume with a conditional update (`SET ConsumedAt=now() WHERE TokenHash=@h AND ConsumedAt IS NULL AND ExpiresAt>now()`).
- On consume: create the account if missing with `EmailConfirmed=true`, sign in (30-day sliding cookie), auto-link orders, land on "My entries".
- Expired or used: "Send me a new link", always to the order's address, never a typed one.

**Email already has an account**
- Same link signs them in and links orders ("Welcome back").
- Existing password accounts that never verified: the claim verifies them, password kept.
- Never auto-link to an unverified account.

**Normal sign-in**
- Enter email, always the same reply ("If there are entries for this address, we've sent a sign-in email").
- Email holds a link and a 6-digit code, both 15 minutes and single use. The code covers phones where the mail app's in-app browser has a different cookie jar. 5 attempts.
- Rate limit by email and IP (ASP.NET Core 8 built-in limiter). Sending through the outbox makes response time identical whether or not the account exists.
- "Set a password (optional)" in settings via the existing reset flow.

**Auto-linking by verified email**
- `BuyerEmailNormalized` on Order: trim and lowercase only (no Gmail dot or +tag stripping).
- On email verification: link all unowned orders with that email. On payment: link at once if a verified account with that email exists. Signed-in checkout sets the owner directly.
- Remove token-only linking. If the signed-in email differs from the buyer's: "This order belongs to s****@... We've emailed a link to add it to an account."

**The existing order link (bearer token)**
- Keep it as the guest handle. Store only its hash (migration hashes existing tokens so old links work).
- Scope: view order and passes, pay while unpaid, fill incomplete participant forms. Submitted sensitive data is masked (ID `920315*******`, medical "On file") and not editable through it.
- Expire at event end plus 30 days. Account holders get "Reset order link".
- `Referrer-Policy: no-referrer`; never log full paths containing tokens.

| Risk | Mitigation |
|---|---|
| Forwarded confirmation email | Single-use claim, page shows which email is claimed, "account created" notice to that address, masked sensitive data, per-participant links (Phase 3) remove the reason to forward. |
| Order link takeover | Scoped, expiring token; linking needs email proof; submitted data read-only and masked. |
| Enumeration | One combined endpoint, same response and timing, rate limits. |
| Code brute force | 6 digits, 5 attempts, 15 minutes, rate limits. |
| Mistyped buyer email | Domain typo hint at checkout, "Tickets go to: x" in large text on review, "Wrong address? Fix it" while unpaid, admin correction with audit after payment. |
| Email change hijack | Not allowed yet; later requires verifying the new address and notifying the old. |

## 2. Registration flow

1. **Basket:** unchanged. If a route has an age limit, ask "age on event day" per ticket, not a full DOB.
2. **Checkout:** first name, surname, email, mobile (strongly encouraged), and "I'm also taking part (ticket: Route X)", which fills participant 1 and removes the "this is me" copy and re-typing. Only a small "Already have an account? Sign in" link.
3. **Payment:** on return, show the receipt at once with "Confirming payment..." polling until the webhook lands. Main action "Next: participant details".
4. **Participant details after payment:** short checkout, organisers don't have 20 ID numbers to hand, abandoned carts hold no POPIA data.
5. **Per slot:** "Fill in now", "Send to participant" (email or WhatsApp share), or "Later" (reminders). A participant link is scoped to its slot; the participant (or guardian) accepts the indemnity themselves.

**Encrypted server drafts**
- Memory-only drafts lose work and protect nothing the submitted record doesn't already expose.
- Autosave per step (debounced on blur) with a visible "Saved".
- Encrypt the draft blob and final ID and medical columns with ASP.NET Data Protection. Keys persisted and backed up (losing keys loses data; runbook it).
- Delete draft on submit; purge leftovers at event end. Never browser storage (shared phones).

**Five-step form, one column, mobile first**
1. Identity: SA ID first, derive DOB, gender (prefilled, editable) and citizenship. "No SA ID" shows passport, DOB, gender. Then name.
2. Contact and address, with "Same address as [Participant 1 / buyer]".
3. Event: shirt size as tap buttons, club typeahead with "Same club as...".
4. Health and emergency: "Any medical conditions? No / Yes" reveals fields; emergency contact with "Same as [Participant N]", soft hint if that contact is also taking part.
5. Consent: terms and indemnity in place in the chosen language; guardian block only if a minor on event date, with "Guardian is [buyer/participant]"; photo consent; summary before Submit.

Sticky "Continue", "Step 2 of 5", inline validation on blur, top error summary linking to fields, 44px touch targets.

**SA ID parsing** (YYMMDD SSSS C A Z): Luhn check and real date; century 19 if YY > current two-digit year else 20; SSSS >= 5000 male; C 0 citizen, 1 permanent resident, 2 refugee. One shared server function mirrored on the client, server authoritative. Store an HMAC of the ID to find duplicate entries without decrypting.

**Autofill:** `given-name`, `family-name`, `email`, `tel` (`type=tel`, normalised to +27), `sex`, `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code`, `country`; `section-emergency` prefix for the emergency contact; `inputmode=numeric` on ID and postal code. No DOB picker.

**Reminders:** to whoever holds the slot, 1 day and 7 days after payment and 7 days before the details deadline. Max 3, re-check incomplete before sending.

**Editing after submit (later):** emergency, medical and club until the event; shirt until the shirt cutoff; identity via admin only.

## 3. Emails

| Email | Trigger | Content |
|---|---|---|
| Order confirmation | Paid webhook, once | Receipt, per-participant status, "Complete participant details", and "Manage your entries later: create your account" (claim link). Verified account holders get "View in your account" instead. |
| Participant invite | Buyer delegates a slot | "[Buyer] entered you in Vasbyt [Route]. Add your details." |
| Pass | Slot submitted | QR pass to the participant's email, else the buyer; buyer gets a short "X completed". |
| Incomplete reminder | Schedule above | Open slots and deadline. |
| Sign-in / claim | On request | Link plus 6-digit code. |
| New account / new sign-in notice | First claim, new device | "Wasn't you? Contact us." |

No ID or medical data in any email. Every email in the order's language.

**Outbox plus BackgroundService**
- `EmailOutbox` row inserted in the same transaction as the business change (e.g. Pending to Paid conditional update plus the confirmation row).
- Unique `IdempotencyKey`: `order-confirmation:{orderId}`, `pass:{participantId}:{submissionVersion}`, `reminder:{slotId}:{n}`.
- Worker on a 10s `PeriodicTimer`, woken immediately by an in-process `Channel` after commit. Claims with `FOR UPDATE SKIP LOCKED`, sends with Resend `Idempotency-Key` = outbox key, exponential backoff up to 8 attempts, then Dead, listed in admin with Retry.
- Payloads hold no secrets: the worker mints tokens at send time and renders bodies from current data.
- Hourly loop enqueues reminders. No Hangfire or Quartz.
- Later: Resend bounce webhook. Before Phase 1: SPF, DKIM, DMARC on the sending domain.

## 4. Data model

- **Order:** `BuyerEmailNormalized` (indexed), `OwnerUserId`, `BuyerIsParticipant`; replace plaintext token with `AccessTokenHash` (unique) and `AccessTokenExpiresAt`.
- **Participant (slot):** `Status` (Unassigned, Invited, Draft, Submitted); `InviteEmail`, `InviteTokenHash`, `InviteTokenExpiresAt`, `InvitedAt`; `DraftCipher`, `DraftUpdatedAt`; `SubmittedAt`, `SubmittedVia` (Buyer, ParticipantLink, Account), `SubmissionVersion`; `IdNumberCipher`, `IdNumberHmac` (indexed), `MedicalCipher`, `IdDocumentType`, `Citizenship`.
- **ConsentRecord** (insert only): `ParticipantId`, `Type` (Indemnity, Terms, Photo, RememberDetails), `DocumentVersion`, `Language`, `AcceptedByName`, `AcceptedByRole` (Self, Guardian, BuyerOnBehalf), `AcceptedAt`, `IpAddress`.
- **AuthToken:** `EmailNormalized`, `TokenHash` (unique), `CodeHash`, `Purpose` (Claim, SignIn), `OrderId`, `Attempts`, `ExpiresAt`, `ConsumedAt`, `CreatedIp`.
- **AppUser:** `EmailConfirmed` now meaningful, `PreferredLanguage`, password optional.
- **EmailOutbox:** `Type`, `ToAddress`, `Language`, `PayloadJson`, `IdempotencyKey` (unique), `Status`, `Attempts`, `NextAttemptAt`, `LastError`, `SentAt`, `ProviderMessageId`.
- **SavedPerson** (Phase 4, explicit consent only): `OwnerUserId`, encrypted profile, `LastUsedAt`.
- **AuditLog:** admin views and edits of sensitive fields, buyer email corrections.

## 5. Phases

**Phase 1: the core ask (emailed account link, reliable email)**
- Users: "Create your account" in the confirmation email; claim page with one Continue; one combined email sign-in page (link plus code); "My entries" fills by email; receipt swaps "create then link" for "We've emailed you a link to set up your account. Resend"; checkout keeps a small sign-in link.
- Backend: outbox and worker (move confirmation and pass emails onto it); `AuthToken`; request-link, consume-claim, verify-code endpoints; linking on verification and on payment; remove token-only linking; hash order tokens and add expiry; rate limiting; `Referrer-Policy`; backfill `BuyerEmailNormalized`.
- Risks: prefetch burn (POST handles it), in-app browsers (code handles it), already-linked orders stay linked, deliverability.
- Tests: GET doesn't consume; two concurrent POSTs give one success; expired and used tokens rejected; claim creates a verified user and links all and only matching orders; existing account signs in and links; unverified account gets no auto-link; unknown email gets the same response and no outbox row; more than 5 code attempts fail; rate limit returns 429; replayed webhook gives one confirmation row; failed send retries, goes Dead after the limit, survives restart; DB holds only token hashes; old plaintext order links work after migration; order link shows masked data after submit and rejects edits.

**Phase 2: smoother form**
- Users: "I'm also taking part", 5-step form with autosave, ID parsing, "Same as" shortcuts, guardian only for minors, autofill and error summary, reminders.
- Backend: encrypted drafts and columns, ID parser with HMAC, `ConsentRecord`, reminder loop, details deadline setting.
- Risks: key loss, century bugs, gender identity vs ID (editable), migrating existing participants into encrypted columns.
- Tests: ID parser table (valid, bad Luhn, 30 Feb, 1900s vs 2000s, 4999/5000); draft round-trips with no plaintext in the column; minor computed against event date; guardian only for minors; "taking part" fills participant 1; reminders stop on completion, cap at 3, no duplicates.

**Phase 3: send to participant**
- Users: email or WhatsApp share per slot; participant fills their own details and consent; participant gets their own pass; participant signing in sees only their registration.
- Backend: hashed, revocable slot invite tokens valid to the details deadline; participant-level linking by verified email.
- Risks: buyer and participant editing at once (last write wins, "being filled in by X"); privacy between participants (buyer sees status and name only).
- Tests: slot token can't read other slots or the order; revoked token fails; participant-signed indemnity records Self; pass goes to the participant.

**Phase 4: returning entrants and self-service**
- Saved people with "remember for next year" consent, post-submit editing windows, Resend bounce webhook, pre-event emails, retention purge (drafts at event end; medical and ID anonymised at event end plus 90 days unless consented), optional passwords in settings.

## 6. Not doing, and why

- No account or password at checkout: costs conversions, and the owner asked to avoid it.
- No full participant details before payment: slows organisers, abandoned carts would hold POPIA data.
- No token consumption on GET: scanners burn it.
- No JWT claim links: not revocable or single use without state.
- No auto-link by unverified email, no linking by order token alone: hands sensitive data to whoever holds a link.
- Never reveal whether an email has an account.
- No magic link without a code: browser switching on phones strands users.
- No `Task.Run` emails, no Hangfire or RabbitMQ: the outbox is durable on one server.
- No sensitive data in emails, URLs, outbox payloads or logs.
- No drafts in browser storage, and no more memory-only drafts.
- Don't lock gender to the ID.
- Don't let the buyer silently accept the indemnity for other adults: record BuyerOnBehalf in Phase 2, move consent to the participant in Phase 3. Get the indemnity wording legally checked.
- Don't expire the order link before the event: passes are opened from it on the day.
- No CSV bulk upload, SMS/WhatsApp API or wallet passes yet.
- No automatic account merging or unverified email changes.
