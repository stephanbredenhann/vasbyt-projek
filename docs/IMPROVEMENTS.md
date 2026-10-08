# Vasbyt improvements

Working notes on how Vasbyt compares with South African event platforms, what this branch (`feature/premium-overhaul`) adopted, and what to build next. Audience for the event is mainly older people, so clarity and large, simple flows come first.

## 1. Peers reviewed

| Platform / event | What stands out | Source |
|---|---|---|
| Entry Ninja (Computicket) | Saved personal profile for one-click repeat entries, team entries, optional timing | [BusinessTech](https://businesstech.co.za/news/?p=171575) |
| Cape Town Cycle Tour | Official substitution flow with a fee, race-number collection at the expo, numbers non-transferable, charity entries managed by group admins | [MapMyWay](https://mapmyway.co.za/?p=32455) |
| Cape Town Marathon | No transfers, deferral to next year, automatic refund on cancellation, clear published policy | [Marathon Ballot](https://www.marathonballot.com/news/cape-town-marathon-deferral) |
| Webtickets, Howler, Quicket | QR tickets, wallet-friendly PDFs, gate scan apps. Howler adds RFID cashless payments | Platform sites (not verified in this research) |
| RaceTec / Winning Time | Bib and chip timing, searchable results, SMS and email result notifications | Platform sites (not verified in this research) |
| Absa Cape Epic, Sani2c, Joburg2C | Team and pair entries, per-stage pages with elevation, daily results, live tracking, medical and indemnity capture at entry, long FAQs, sponsor walls, accommodation pages | Event sites (not verified in this research) |
| Comrades, Two Oceans | Seeding batches, countdown on the home page, expo collection with ID, live results | Event sites (not verified in this research) |
| parkrun SA | One personal barcode reused at every event | parkrun SA |

What matters most for Vasbyt:

- Returning people should not retype their details.
- Collection and entry day must be obvious from a single screen.
- Policy on changes (substitution, transfer, refund) should be published before anyone asks.
- Scan staff need the whole picture on one screen, not a bare ticket number.

## 2. Adopted in this branch

| Peer idea | What was built in this branch | Status |
|---|---|---|
| Per-stage pages, one route per discipline (Cape Epic, Sani2c) | Walk routes share the run route data while staying separate events. A Run/Walk switch and a register deep link let people pick the discipline on the route | Done |
| Stock-aware shop (general practice) | Admin sets a quantity on hand per variant; the shop hides a variant at 0 and a product once all its variants are gone | Done |
| QR tickets and wallet-friendly passes (Webtickets, Quicket) | Resend email with one QR pass per entrant, sent to the entrant and to the buyer or account owner. Inline QR plus attachment, in Afrikaans and English | Done |
| parkrun personal barcode | "My passes" section in the account with a large, easy-to-scan QR view | Done |
| Expo collection with ID (Comrades, Cycle Tour) | Admin scan screen shows the full person, order, purchased items and reference. A dropdown lists others on the same account, with per-line collection | Done |
| Countdown on home (Comrades, Two Oceans) | Home page countdown with add-to-calendar | Done |
| Searchable, discoverable event pages (general practice) | Server-side head injection (title, description, canonical, Open Graph, JSON-LD for the event, routes and shop), sitemap.xml and robots.txt | Done |
| Polished, mobile-first event pages (Cape Epic, Sani2c) | Visual, motion and mobile pass following Apple HIG spacing and motion, larger type for older readers, decluttered header | Done |
| Order language stored (for bilingual comms) | Order language is stored; order confirmation and pass emails follow it | Done |

## 3. Recommended next

Ordered by value for the event, then effort. "Value" is for Vasbyt's audience and day-of operations.

| # | Item | Value | Effort | Notes |
|---|---|---|---|---|
| 1 | Saved participant profile, prefilled for returning entrants | High | Low | Mirrors Entry Ninja. Store only what the form already collects. Explicit consent for saving |
| 2 | Published substitution and deferral policy, plus an admin substitution flow | High | Medium | Write the policy first (Cape Town Marathon, Cycle Tour). Admin flow reuses the per-line order model |
| 3 | Waitlist with an automatic offer email | High | Medium | Offer expires after a set time, then moves to the next person. Avoids manual phone calls |
| 4 | Google Wallet pass (JWT, no certificate) | Medium | Medium | Lowest-friction wallet option. Start here |
| 5 | Apple Wallet pass | Medium | High | Needs a paid Apple Developer certificate. Do after Google Wallet proves useful |
| 6 | WhatsApp and SMS reminders (bib collection, start times, weather) | High | Medium | Most useful to older people who read SMS or WhatsApp more than email. Opt-in only |
| 7 | Donation progress bar and opt-in donor wall | Medium | Low | Helps Orania Helpmekaar show momentum. Donors choose whether their name shows |
| 8 | Results import (CSV) with search by bib | Medium | Medium | Simple import first, live timing later. Search must work on a phone |
| 9 | PayFast integration (cards, instant EFT, SnapScan) | High | High | Replaces the demo payment. Needs live credentials handled outside the codebase |
| 10 | Offline-tolerant scanner queue | High | Medium | Karoo signal is poor. Queue scans locally, sync when back online, flag duplicates |
| 11 | Per-language URLs (`/en/`) with hreflang | Low now | Medium | Only worth it once English traffic is significant. Search engines otherwise handle it fine |
| 12 | Bilingual account emails (password reset, confirmation) | Low | Low | Order and pass emails already follow the order language. Account emails are still Afrikaans only |

Notes on priorities:

- Items 1 to 3 remove the most day-of and pre-event friction for returning and changing entrants.
- Item 6 is high value for this audience, but it needs opt-in consent and a sender account before it can go live.
- Item 9 is the largest effort. Keep the demo payment until the live integration is tested in PayFast's sandbox.

## 4. Before going live

- Set `PUBLIC_BASE_URL` (required by `deploy/compose.yaml`). Canonical links, social previews and email links depend on it.
- Verify the sending domain in Resend (SPF, DKIM, DMARC) and set `RESEND_API_KEY` and `RESEND_FROM` on that domain.
- Set `Event:DatesConfirmed` to `true` once the organisers confirm the 2027 dates. Until then the countdown and calendar file say the date is provisional.

## 5. Sources

- BusinessTech, Entry Ninja and Computicket: https://businesstech.co.za/news/?p=171575
- MapMyWay, Cape Town Cycle Tour entry rules: https://mapmyway.co.za/?p=32455
- Marathon Ballot, Cape Town Marathon deferral: https://www.marathonballot.com/news/cape-town-marathon-deferral
- Webtickets, Howler and Quicket: platform websites (QR tickets, gate scanning, RFID cashless at Howler)
- RaceTec and Winning Time: platform websites (bib and chip timing, result notifications)
- Absa Cape Epic, Sani2c and Joburg2C: official event websites
- Comrades Marathon and Two Oceans: official event websites
- parkrun South Africa: parkrun website (personal barcode)
