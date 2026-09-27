# Finished Vasbyt demo

The demo should let an organiser show the real event, complete a registration, save a participant QR pass, scan it as an admin, and edit the public programme without redeploying. The supplied Aanpassings document is source material for copy and presentation. The user's request authorises image selection and implementation decisions while they are away.

## Presentation

Use the existing Vasbyt logo and its orange and blue colours, Montserrat body text and Oswald headings. Lead with a large event photograph, white readable text, and a bordered registration button. Put the carousel below the hero. Apply every requested wording change in Afrikaans and equivalent English. Use alternating blue and orange tinted route cards with accessible discipline icons and a labelled difficulty meter. End the homepage at the existing province map. Use selected, optimised local event and Helpmekaar photographs on the relevant pages.

## Programme

Persist three programme days and their ordered entries in PostgreSQL. Each day has an editable date, Afrikaans and English heading, note, times, activity titles and descriptions. Add a Programme tab to admin with add, remove and reorder controls. Save all days in one validated operation; failures preserve the editor and the published version. Seed the brochure's activities against the same provisional 2027 dates already used by route days, and clearly label them provisional until organisers confirm them.

## Participant passes and reception

Every entrant has an independent random QR token, with existing entrants backfilled through an additive migration. Only paid and completed entrants expose a QR payload in the order response. Encode only a Vasbyt prefix, season and opaque token. Display downloadable and printable passes on the completion page and the account page. Never encode personal details, an order access token or a public personal-data URL.

The Admin Scan tab accepts a camera scan, uploaded QR image or typed entry number. Only authenticated admins can resolve a pass. Show participant, route, tariff, paid status, contacts, emergency and medical details, and purchases. Allow explicit check-in, preserving the first timestamp if repeated. Reject unrelated, unknown, incomplete, unpaid and cancelled registrations. Stop camera tracks on stop, navigation, and successful scan. Keep a manual and image route available when camera access is denied or unavailable.

## Constraints and validation

Work in the existing checkout. Do not stage, commit, change branches, push or write to a project tracker. Preserve all existing work. Keep payments explicitly in demo mode and explain that actual email requires the existing email configuration. Self-host fonts so a demo build does not depend on Google's availability. Verify the production build, all API tests against disposable PostgreSQL, frontend tests, desktop and mobile layouts, and registration through QR upload and check-in in a browser.
