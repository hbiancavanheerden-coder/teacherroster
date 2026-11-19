# StaffBoard

Subscription SaaS for school duty rosters, school calendars, timetables, absences and swaps. Grown out of the single-page *Staff Duty Register* (Term 4 2026). Its look, "Find my duty" search, teacher browser and term-dates modal live on as the **public roster link** (`/r/:token`).

- **Frontend:** React 19 + Vite, hand-written CSS (`src/styles.css`), hosted on Netlify
- **Auth:** Firebase Authentication (email/password + Google)
- **Database:** Cloud Firestore, multi-tenant, enforced by `firestore.rules`
- **Backend:** Netlify Functions (`netlify/functions`) using the Firebase Admin SDK
- **Email:** Resend
- **AI document import:** Anthropic Claude (`claude-opus-5-5`) reads uploaded rosters/timetables
- **Payments:** PayFast subscriptions (recurring billing) in ZAR

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, security model and design decisions.

---

## 1. What you need to set up (one-off)

| Service | What to do | Where the values go |
|---|---|---|
| **Firebase** | Create a project → add a **Web app** → enable **Authentication** (Email/Password and Google) → create a **Firestore** database (production mode, region `africa-south1` Johannesburg, or `europe-west`) | `VITE_FIREBASE_*` |
| Firebase Admin | Project settings → Service accounts → *Generate new private key*. Copy `project_id`, `client_email`, `private_key` from the JSON, then **delete the JSON file** | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Firebase Auth domains | Authentication → Settings → Authorised domains → add your Netlify domain and custom domain | — |
| **Resend** | Create an account → add and verify your sending domain (DNS records) → create an API key | `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_TO` |
| **PayFast** | Register a merchant account → Settings → Integration: note **Merchant ID** and **Merchant Key**, set a **Passphrase** (required for subscriptions) → ask PayFast to **enable Recurring Billing / Subscriptions** on your account. For testing, create a separate account at sandbox.payfast.co.za | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX` |
| **Anthropic** | Create an account at console.anthropic.com → add billing credit → create an API key | `ANTHROPIC_API_KEY` |
| **Netlify** | New site from Git (or `netlify deploy`) → add all environment variables → set `APP_URL` to your public URL | Site settings → Environment variables |

### How PayFast billing works here

No plans need creating in PayFast. Each checkout posts a signed **subscription** form (monthly = frequency 3, annual = frequency 6, `cycles=0` until cancelled) with the price from `src/config/plans.js`. PayFast calls `https://YOUR-SITE/api/billing-webhook` (the `notify_url`, sent with every checkout, so there's nothing to configure in the PayFast dashboard) for the first payment, every renewal and cancellations. Every notification goes through PayFast's four checks: signature, PayFast source IP, server-to-server confirmation, and amount = plan price.

> **Verify before launch:** with `PAYFAST_SANDBOX=true`, do a full sandbox subscription, then cancel it from the Billing page. Also confirm the **Update card** link works for your account. It points to PayFast's `/eng/recurring/update/{token}` page; if PayFast has moved that page, change `updateCardUrl` in `netlify/functions/_lib/payfast.js`.

### Netlify environment variables

Copy every key from `.env.example`. Notes:
- `VITE_*` values are compiled into the browser bundle. The Firebase web config is **meant to be public**; security comes from `firestore.rules`.
- All other values are **server-only** and must never be prefixed with `VITE_`.
- Paste `FIREBASE_PRIVATE_KEY` with literal `\n` sequences (exactly as it appears in the JSON).
- AWS Lambda limits a function's environment variables to **4 KB in total**. This setup uses about 2.5 KB. Don't add large values.
- In Netlify you can scope the server-only variables to **Functions** and the `VITE_*` ones to **Builds**.

## 2. Deploy

```bash
npm install
npm test                      # unit + render tests
npm run deploy:rules          # pushes firestore.rules + indexes (log in with: npx firebase-tools login)
netlify deploy --build --prod # or connect the Git repo in the Netlify UI
```

The `daily-digest` function is a Netlify **scheduled function** (weekdays 06:30 SAST). It is enabled automatically on deploy; check it under Functions → Scheduled.

## 3. Local development

```bash
cp .env.example .env    # fill in values (test keys)
netlify dev             # runs Vite + Functions together on http://localhost:8888
```
`npm run dev` (Vite alone) serves only the marketing site. API calls need `netlify dev`.

Test payments in the PayFast **sandbox** (`PAYFAST_SANDBOX=true` with your sandbox merchant ID, key and passphrase). PayFast must reach the ITN URL, so test billing on a Netlify deploy preview or with `netlify dev --live`, not plain localhost.

### Tests

| Command | Covers | Needs |
|---|---|---|
| `npm test` | Scheduler fairness, conflicts, recurrence, SA holidays, CSV/ICS, plans, PayFast signing and ITN checks, function auth/validation, every app page rendering for owner and teacher | Node only |
| `npm run test:rules` | Firestore security rules: tenant isolation, roles, billing lock, swap flow, audit log | **Java 11+** (Firestore emulator) |

> The security-rules suite was written but **has not been run yet**: this machine has no Java runtime. Install one (`brew install --cask temurin`) and run `npm run test:rules` before going live.

## 4. Importing documents (PDF, Word, Excel, photos)

Admins click **Import document** on the Duty roster or Timetable page:

1. `import-upload` (normal function) checks the file (≤ 4 MB; PDF, .docx, .xlsx, .csv, PNG/JPG/WebP). Word files are converted to HTML tables with `mammoth` and Excel files to text. The file is stored in Anthropic's Files API with a **1-hour expiry**.
2. `import-extract-background` (a **Netlify Background Function**, up to 15 min) sends it to Claude with your staff, duty points, periods, term dates and holidays as context. It asks for JSON matching a strict schema and saves the result to `schools/{id}/imports/{importId}`. Then it deletes the file from Anthropic.
3. The browser watches that document and shows a **review screen**. Every name, duty point and period is matched (exact, "likely, please check", or red = choose one). You can add unknown names as new staff or duty points, or skip them. You choose whether to replace duties already on those dates. Nothing is written until you click Import, and the import is recorded in the audit log.

**Cost and limits:** Claude Opus 5.5 at high effort. A typical multi-page term roster costs roughly **R5–R15** per import (about $0.25–$0.80), billed to your Anthropic account. Imports are capped at 20 per school per day (`DAILY_LIMIT` in `import-upload.js`). Set a monthly spend limit in the Anthropic Console.

**Check before launch:** Background Functions must be available on your Netlify plan. If they aren't, the upload returns "Could not start reading the document".

## 5. Live demo and your owner dashboard

- **Live demo:** `/demo` (or `/demo?as=teacher`) opens the real app with a sample school, no account needed. It's linked from the homepage and nav. Demo data lives only in the visitor's browser tab; nothing reaches Firebase. Features that need a real account (invites, payments, imports, emails) show a friendly "start a free trial" message.
- **Owner dashboard (MRR & users):** set your email in both `VITE_PLATFORM_ADMIN_EMAILS` and `PLATFORM_ADMIN_EMAILS`, sign up with that email and verify it. A **Platform owner → MRR & users** item then appears in your menu. It shows MRR, annual run rate, registered users, paying workspaces, trials, trial conversion, revenue per month (from PayFast payments) and new workspaces per month. The server re-checks your email on every request.

## 6. Free push notifications & home-screen app

StaffBoard is an installable web app (PWA). Teachers can add it to their home screen and get **free push notifications**: a 06:30 school-day reminder of their duties (skipped on holidays), plus duty changes, swaps and announcements.
- **Works on:** Android (Chrome), desktop browsers, and iPhone/iPad on iOS 16.4+ *after* "Add to Home Screen" (Apple's rule). The app shows step-by-step instructions.
- **Without an account:** on the shared roster link a teacher picks their name once (remembered on that phone), sees their own duties first, and can turn on notifications.
- **Setup (once):** run `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:you@…) and `VITE_VAPID_PUBLIC_KEY` (same public key) in Netlify. Keep the private key secret; if you change the keys, everyone has to turn notifications on again.
- **Cost:** nothing per message. Email (Resend) stays an optional School-plan extra.

## 7. Plans: what's personal and what's shared

| | Teacher (R99) | School (R599) |
|---|---|---|
| Purpose | One teacher's organiser | The whole staff, live |
| Own duties, timetable, calendar, own morning reminders | ✓ | ✓ |
| Build / auto-schedule / print a roster, AI import, WhatsApp roster image | ✓ | ✓ |
| One-click SA school terms + public holidays | ✓ | ✓ |
| Away & cover (find free colleagues for duties) | ✓ | ✓ |
| Shared roster link, colleagues' calendar links & notifications | – | ✓ |
| **Relief roster** (cover lessons from the timetable, fair, notified) | – | ✓ |
| **Exam invigilation roster** (fair, clash-free, own-subject rule) | – | ✓ |
| **Daily staff briefing** (print / image) and **Staffroom TV** (live screen via secret link) | – | ✓ |
| **Inspections & moderation planner** (checklists, sign-off, PDF) | – | ✓ |
| Staff accounts, swaps, email, audit log | – | ✓ |

School-only pages stay visible to Teacher-plan admins with a "School" tag in the menu; opening one explains the feature and offers "Get this for my school" (upgrade or send to principal).

Enforced on the server (`canShare()` in `netlify/functions/_lib/core.js`) on **every request**. If a school drops from a trial or School plan to Teacher, existing shared links, colleague calendar feeds and link notifications pause with a friendly message. The teacher's own reminders keep working.

**Send to my principal:** Teacher-plan users see "Share with staff" prompts (dashboard, roster, staff, settings). The dialog emails the principal a one-page proposal (`/api/upgrade`, reply-to the teacher, max 5 a day), or shares a secure **activation link** (`/upgrade/:token`, valid 60 days) by copy or WhatsApp. The principal or bursar pays for the School plan on that page without an account. PayFast confirms it and the teacher's existing workspace switches to the School plan.

### School term dates
`src/lib/schoolTerms.js` holds the national public school terms (2026 and 2027, from the gazetted DBE calendars). New schools get this year's and next year's terms and public holidays automatically, and **Term dates → Load 20xx school terms** adds them later. **Add each new year's gazetted dates to that file.** Independent schools set their own dates and can edit them.

## 8. Importing the existing Term 4 roster

Once you've signed up and created your workspace, copy the school ID from the Firestore console (`schools/{id}`) and run:

```bash
node --env-file=.env scripts/import-legacy.mjs ~/Downloads/duty-roster-term-4-2026-updated.html <schoolId> --dry-run
node --env-file=.env scripts/import-legacy.mjs ~/Downloads/duty-roster-term-4-2026-updated.html <schoolId>
```
It creates the six duty points, the staff (matched by name; add their emails afterwards to invite them), all 228 duty assignments and the 75 term-date events. Re-running it is safe.

## 9. Launch checklist

- [ ] Fill in `src/config/site.js` (support email, company name). Add real testimonials when you have them; the section stays hidden until then.
- [ ] Have a lawyer review `src/marketing/Legal.jsx` (terms, POPIA privacy policy). Register an Information Officer with the Information Regulator.
- [ ] PayFast live: merchant verified, recurring billing enabled, live ID/key/passphrase set, `PAYFAST_SANDBOX=false`.
- [ ] Anthropic: API key set, monthly spend limit set; test one roster import and one timetable import.
- [ ] Resend: domain verified (SPF/DKIM), `EMAIL_FROM` on that domain.
- [ ] Firebase: authorised domains, rules and indexes deployed, `npm run test:rules` green. Consider enabling **App Check**.
- [ ] Turn on Firestore **daily backups** (Firestore → Disaster recovery) and set a Google Cloud **budget alert**.
- [ ] Custom domain + HTTPS on Netlify; update `APP_URL`.
- [ ] Run through: sign up → onboarding → add staff → auto-schedule → invite a teacher (second browser) → accept → swap request → approve → absence → substitute → subscribe with a test card → cancel via "Update card or cancel".

## 10. Maintenance

- **Logs:** Netlify → Functions → each function's log (ITN failures return 500 so PayFast retries; rejected ITNs are logged with the reason).
- **Billing issues:** each school's `billing` map in Firestore shows status, plan, `accessUntil`, the PayFast subscription `token` and last payment reference. Billing changes are written to the school's audit log.
- **Extending a trial / comping a school:** edit `schools/{id}.billing.accessUntil` in the Firestore console.
- **Dependencies:** `npm outdated` monthly; `npm audit` before each release.
- **Account deletion requests:** `delete-account` removes the login and marks sole-owner workspaces with `deletionRequestedAt`. Purge those workspaces after 30 days (Firestore console → delete document with subcollections, or `firebase firestore:delete --recursive schools/{id}`).
