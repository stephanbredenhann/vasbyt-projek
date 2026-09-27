# Vasbyt demo

The local demonstration runs at http://127.0.0.1:5080. It uses `vasbyt_demo`, a separate PostgreSQL database, and a separate `demo-media` folder. The existing `vasbyt` database remains available.

## Start

From the repository root, run:

```bash
./scripts/run-demo.sh
```

Requires Docker Compose, Node.js 20.19 or newer, and a .NET SDK that supports .NET 8. The script starts PostgreSQL, creates the demo database only if missing, builds the application, applies additive migrations, and starts the website. It does not reset existing databases. Stop the foreground server with Ctrl+C.

Sign in through **Teken in** using `demo@vasbyt.local` and `VasbytDemo2027!`. These credentials are for the local demonstration. To choose different credentials on first creation, set `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` before running the script. Changing those variables does not overwrite an existing account's password.

## Demonstration journey

1. Select **Skryf in!**, choose ticket quantities, add an optional shop item and donation, and enter the buyer details.
2. Save the order, retain the reference number and page link, and complete the payment step. It still uses the local payment simulation. Reloading the payment page resumes the saved order in the same browser.
3. Fill in one participant form per ticket. Each completed participant receives a unique QR pass on the confirmation page. Download the PNG or print the pass. Optionally create an account to retrieve the passes under **My rekening**.
4. Sign in as the demo admin in a separate browser session. Under **Skandeer QR**, use the camera, upload a QR photo, or enter the participant's `VB2027-` number. The result includes contact, emergency, medical and order information. **Teken aankoms aan** records arrival once. Repeat scans retain the first timestamp.
5. Under **Program**, edit all three days' dates, times, headings, activities and notes in Afrikaans and English. Add, remove and reorder activities. **Stoor program** publishes the saved version. Switching admin tabs preserves unsaved programme work.

Camera access requires localhost or HTTPS and browser permission. Image upload and manual entry remain available when a camera is denied or unavailable. Physical phone cameras still need a check on the eventual HTTPS deployment.

## Content and source material

The supplied `Aanpassings.docx` was treated as source copy and design feedback. The website uses the official logo's blue and orange, the requested headings and calls to action, revised registration wording, larger participant tabs, discipline icons, difficulty meters, alternating route cards, and the full photo hero with a gallery below it. English copy matches the revised Afrikaans. Fonts are served locally with their licences.

Selected photographs are optimised WebP files in `src/Vasbyt.Frontend/public/foto`. Original downloads were left untouched. The event selection covers the cycling start, group participation, running, walking, canal route, finish-line celebration and trophies. The Helpmekaar selection covers families, hands, the river and community participation. Homepage, routes, donations and about pages use these selections. All supplied photos need not be loaded into the website.

The programme begins with the existing brochure activities on the project's provisional 2027 dates, 29 April to 1 May. The public page labels these dates as provisional. The organiser can edit the programme independently of route-day data.

The public pages omit demonstration labels for the presentation. Shop products, accommodation, sponsors and seeded registrations remain sample content. Seeded registrations use reserved `example.test` email addresses. Actual merchandise, prices, sponsors and accommodation require organiser confirmation. Existing route prices and GPX files are retained.

## Email and payments

Demo mode suppresses registration email delivery. Passes can be downloaded and printed immediately without email configuration. The confirmation page only reports successful email delivery when the provider accepted it.

Registration confirmation emails are implemented through Resend. Outside demo mode, configure `Resend:ApiKey`, a verified `Resend:From`, and the trusted HTTPS website origin in `Public:BaseUrl`. The initial payment email provides a private link to resume forms. Once all participant forms are complete, the final email includes the order summary, participant numbers and access to downloadable QR passes. Identity numbers and medical details are omitted. A provider failure does not undo the saved registration or falsely show delivery. The confirmation page offers a retry when email is configured, and successful delivery is recorded. Payment and completed registration emails use separate idempotency keys.

Payment remains the existing demo transition. Connect a real payment provider and a verified webhook before taking real payments. The demo is not publicly deployed by this work.

## Verification

```bash
dotnet test Vasbyt.sln
cd src/Vasbyt.Frontend
npm test -- --watch=false --browsers=ChromeHeadless
npx playwright install chromium
npm run test:e2e
```

Browser tests require the isolated demo to be running and refuse to run without `demoContent` enabled. They create clearly named sample registrations in that database, and restore the programme after editing. Set `TEST_CAMERA=true` with FFmpeg installed to also test the live camera path using a generated QR video. For a different local port, set `DEMO_URL`.

The checks cover paid and complete pass issuance, uniqueness, admin-only lookup, refusal of unknown and cancelled passes, private data boundaries, repeat check-in, programme validation and persistence, confirmation email safety, real QR decoding, activity reordering, registration and account flows, camera cleanup, and public pages at phone and desktop widths.
