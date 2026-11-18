# Architecture

## What was kept from the original Duty Register

| Original | Now |
|---|---|
| Hard-coded `DUTIES` array, 6 fixed roles | Configurable **duty points** (any number, times, days, staff needed, phase) and duties stored per assignment |
| Day strip + pinned register card | Dashboard "Today" card and the public roster page (same paper/ink/brass design) |
| Find my duty | Roster highlight search, "My duties", and public roster search |
| Browse by teacher | My duties → teacher chips, and the public roster |
| Term dates modal | Full school calendar (month/week/day/term views, phases, recurrence, reminders) and term management |

## Routes

Public: `/`, `/features`, `/pricing`, `/faq`, `/contact`, `/legal/terms`, `/legal/privacy`, `/login`, `/register`, `/reset`, `/invite/:token`, `/r/:token` (public roster).
App (signed in): `/app` (Today), `/app/my-duties`, `/app/roster`, `/app/calendar`, `/app/timetable`, `/app/swaps`, `/app/absences`, `/app/announcements`, `/app/staff`, `/app/notifications`, `/app/account`. Admins also get `/app/terms`, `/app/reports`, `/app/audit`, `/app/settings`, `/app/billing`.

## Data model (Firestore)

```
users/{uid}                     displayName, email, prefs.email.*, activeSchoolId,
                                schools{ id: {name, role} }*, trialUsed*          (* server-written)
schools/{schoolId}              name, type, timezone, ownerUid, settings{periods, schoolDays, eventTemplates},
                                billing{plan, status, seats, features, accessUntil, interval,
                                        provider, token, lastPaymentAt, lastReference, ...}*
  members/{uid}                 role (owner|admin|teacher), staffId, name, email   (server-created)
  staff/{id}                    name, email, phone, department, grades, phase, position, active,
                                uid?, excludedCategories[], maxPerWeek, dutyWeight
  dutyCategories/{id}           name, color, order, startTime, endTime, staffNeeded, days[], phase, active
  duties/{id}                   date 'YYYY-MM-DD', categoryId, staffId, note, auto?
  events/{id}                   title, type, phase, start, end, allDay, startTime, endTime, location,
                                description, recurrence{freq, until}, exceptions[], remindDaysBefore, private
  terms/{id}                    name, start, end, phase
  timetable/{id}                staffId, className, subject, room, day (1-7), periodIndex
  absences/{id}                 staffId, start, end, reason, note, status (reported|approved|cancelled), createdBy
  swapRequests/{id}             dutyId, date, categoryId, fromStaffId, toStaffId, message,
                                status (pending|accepted|declined|approved|rejected|cancelled), createdBy
  announcements/{id}            title, body, pinned, authorUid, authorName, createdAt
  notifications/{id}            toUid, title, body, link, read, kind, createdAt      (server-created)
  auditLogs/{id}                actorUid, actorName, action, summary, at             (append-only)
  imports/{id}                  kind, fileName, status (processing|ready|failed|imported), result{duties, lessons, warnings}, usage
invites/{token}                 schoolId, staffId, email, role, status, expiresAt    (server-only)
links/{token}                   type roster|ics, schoolId, scope, staffId, revoked   (server-only)
billingCheckouts/{m_payment_id} pending PayFast checkout → school/plan            (server-only)
billingCustomers/pf_{token}     PayFast subscription token → school               (server-only)
```

**Staff vs members.** A *staff* record is a person on the roster. A *member* is a login. Rosters work without accounts (Teacher plan). Invitations link a member to a staff record.

Dates are local `YYYY-MM-DD` strings in the school's time zone, so a duty on "18 Nov" never shifts across time zones.

## Security model

1. **Tenant isolation:** every read under `schools/{id}` requires `schools/{id}/members/{uid}` to exist. Members cannot create memberships; only the `create-school` and `accept-invite` functions can.
2. **Roles:** owner/admin write rosters, staff, calendar, terms, timetable, announcements and settings. Teachers can only report their own absences, create swap requests for **their own** duties, respond to swaps addressed to them, and mark their own notifications read.
3. **Billing lock:** writes require `billing.accessUntil > request.time`. `billing` is written only by functions (PayFast ITN handler). Expired workspaces stay **readable**.
4. **Plan limits:** `billing.features` (derived from `src/config/plans.js`) is checked by rules (swaps, timetable, absences) and functions (invites, email). Seat limits are enforced in `invite` and `accept-invite` (transaction).
5. **Audit log:** append-only. `actorUid` must equal the caller and `at` must be the server time, so entries can't be forged or back-dated.
6. **Functions:** each verifies the Firebase ID token and membership/role server-side. Notification text is generated server-side from Firestore data, so `notify` can't be used to send arbitrary email. Webhooks are verified with HMAC-SHA512 and constant-time comparison.
7. **Secrets:** only in Netlify environment variables, never in the bundle. Public links (`/r/`, `/api/ics`) use 192-bit random tokens, can be revoked, and expose names and duties only (no emails or phone numbers).

## Subscription lifecycle (PayFast)

```
sign up → create-school → trialing (14 days, School features, accessUntil = +14d)
choose plan → billing{checkout}: stores billingCheckouts/{id}, returns a signed subscription form
          → browser POSTs to PayFast /eng/process → customer pays → returns to /app/billing?paid=1
ITN (notify_url /api/billing-webhook): verify signature + source IP + /eng/query/validate + amount
   COMPLETE  → active, accessUntil = period + 3-day grace; token mapped to school
               (new token on a plan change → old subscription cancelled via API)
   renewals  → same token → accessUntil extended
   CANCELLED → cancelled; access continues to the end of the paid period
cancel → billing{cancel}: PUT api.payfast.co.za/subscriptions/{token}/cancel
update card → PayFast-hosted /eng/recurring/update/{token}
```
The Billing page listens to the school document live, so it flips to "Active" as soon as the ITN is processed. PayFast has no proration: a plan change starts a new subscription and cancels the old one. One free trial per account (`users.trialUsed`).

## AI document import

`import-upload` → Anthropic Files API (1 h expiry) → `import-extract-background` → Claude (`claude-opus-5-5`, `effort: high`, structured output against `EXTRACTION_SCHEMA` in `netlify/functions/_lib/extract.js`, server-side `fallbacks: "default"` so a safety decline is retried on Anthropic's recommended model) → `imports/{id}.result` → review screen (`src/app/DocumentImport.jsx`, matching in `src/lib/matching.js`) → normal audited batch write. The model gets the school's existing names as context and is told to copy names exactly as written rather than guess. The app's own matcher then sorts names into exact, "likely" (highlighted for checking) or unmatched, and it never guesses between two people with the same surname. Imported duties and lessons carry `imported: true`.

## Scheduler

`src/lib/scheduler.js` is a deterministic greedy allocator. For each school day and each slot it picks the eligible teacher with the lowest score:

```
score = (load / dutyWeight) × 10 + timesOnThisDuty × 3 + (on duty yesterday ? 6 : 0) + random tie-break
```
Eligibility: active, not absent, not excluded from the duty, phase matches, under the weekly limit, not already on duty that day. Prior duties earlier in the term are counted, so later regenerations stay fair. Tests show the spread is at most 1 duty per teacher over a full term, with 14 staff and 6 duty points.

## Assumptions and decisions

- **PayFast:** chosen by the owner. Stripe isn't directly available to SA businesses. Checkout uses PayFast's hosted page, so card data never touches our servers. If a renewal fails and no notification arrives, a missed payment simply lets `accessUntil` lapse after the grace period (read-only, nothing deleted).
- **Netlify Functions instead of Firestore triggers:** this keeps to the requested stack (no Cloud Functions/Blaze plan needed for triggers). Notifications are sent by the client calling `notify` after a write. If that call fails, the in-app change still stands; only the email is missed.
- **Emails go only to staff with accounts**, who opted in by signing up and can opt out per category (POPIA-friendlier than emailing everyone on a spreadsheet).
- **PDFs** are generated client-side with jsPDF (real downloadable files). Browser print is also styled.
- **Offline:** Firestore's persistent cache keeps recent data available on patchy school Wi-Fi.
- **Not built (yet):** SMS/WhatsApp notifications (would need a paid provider), SA-SAMS integration, native apps, district/multi-school admin consoles, in-app invoice PDFs (PayFast emails receipts).
