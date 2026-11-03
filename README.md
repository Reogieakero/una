# DCAS

**DOrSU Counseling and Appointment System** — the "Chekie" platform for the DOrSU Guidance Office.

DCAS is a privacy-sensitive counseling platform with two clients and one backend:

- a **student mobile app** (Expo / React Native) for onboarding, booking, stress screening, sessions, chat, notifications, and profile;
- a **staff web portal** (Next.js) for counselors, faculty, the guidance head, and the administrator;
- a **single Supabase backend** (Postgres, Auth, Storage, Realtime, Row Level Security) that both clients share.

The system covers the full guidance-office loop: a student books a session and completes a PSS-10 check-in, the guidance head assigns a counselor, the counselor confirms the schedule (and attaches a Google Meet link for online sessions), the session is completed against a fresh check-in or an audited waiver, the counselor writes a private S.O.A.P./freeform note, and the head reads aggregated, privacy-suppressed reports.

The design is deliberately explicit about identity. Routine staff views use a student **alias**. Real identity is available only through a time-limited, reviewed, audited **break-glass** action. This is pseudonymity with audited re-identification, not mathematical anonymity.

> **Using the system rather than building it?**
> Read [`docs/ux/user-guide.md`](docs/ux/user-guide.md). It explains every screen and rule for students, counselors, faculty, the guidance head, and the administrator without code or database jargon.

---

## Table of contents

- [1. What DCAS is](#1-what-dcas-is)
- [2. What makes it different](#2-what-makes-it-different)
- [3. Roles and platforms](#3-roles-and-platforms)
- [4. Feature map by role](#4-feature-map-by-role)
- [5. Route map](#5-route-map)
- [6. End-to-end workflows](#6-end-to-end-workflows)
- [7. Status reference](#7-status-reference)
- [8. Rules the system enforces](#8-rules-the-system-enforces)
- [9. Analytics and reports](#9-analytics-and-reports)
- [10. Technology stack](#10-technology-stack)
- [11. Repository layout](#11-repository-layout)
- [12. Getting started](#12-getting-started)
- [13. Environment variables](#13-environment-variables)
- [14. Database and migrations](#14-database-and-migrations)
- [15. Scripts](#15-scripts)
- [16. Testing and quality](#16-testing-and-quality)
- [17. Performance evidence](#17-performance-evidence)
- [18. Security and privacy](#18-security-and-privacy)
- [19. Deployment](#19-deployment)
- [20. Troubleshooting](#20-troubleshooting)
- [21. Documentation map](#21-documentation-map)
- [22. Glossary](#22-glossary)
- [23. Known limits and honest status](#23-known-limits-and-honest-status)

---

## 1. What DCAS is

DCAS replaces a paper-and-spreadsheet counseling workflow with one auditable system. Every request, assignment, confirmation, session, note, referral, announcement, and report is a record in the same database, tied to the person and role that produced it.

The problem it addresses:

- **Booking is informal.** Students ask for help in person, by message, or through a teacher; requests are easy to lose and hard to track.
- **Identity is exposed at the front desk.** A paper log or a shared spreadsheet shows real names and student numbers to anyone who can open the file.
- **Session documentation is fragmented.** Notes live in notebooks or personal files, so the office cannot see workload, follow-ups, or trends.
- **Reporting is manual.** The head rebuilds counts from memory or spreadsheets, and small groups are easy to re-identify in a raw list.
- **Referrals are untracked.** Faculty refer a student and never learn whether the referral was acted on.

DCAS closes those gaps with:

- a student-owned booking flow with real counselor availability;
- a PSS-10 screening gate before sessions, with a documented waiver path;
- alias-first staff views plus a break-glass protocol for emergencies;
- counselor dashboards, a session calendar, and per-student case timelines;
- a referral pipeline that links a confirmed referral to a real appointment;
- head-only analytics with small-cell suppression and Excel export;
- realtime chat and notifications that carry IDs and status, never clinical content.

### What this repository is not

- It is **not** a public social network or a crisis hotline. Chat is for coordination with a counselor; emergencies go to campus security or local services.
- It is **not** a diagnostic tool. The PSS-10 is a screening questionnaire, not a diagnosis.
- It is **not** mathematically anonymous. The alias-to-identity mapping exists in the same database and is protected by policy, not cryptography.
- It is **not** an event-management system. Announcements are news posts; there is no RSVP, venue, capacity, or attendance tracking.
- It is **not** a student web portal or a staff mobile app. Students use mobile; staff use the web.

---

## 2. What makes it different

**Alias first, identity by exception.** Every routine staff surface reads the student alias. A counselor who needs a real identity in an emergency logs a justification, receives a 30-minute grant, and (for counselors) waits for the guidance head to review it. Each log, review, and reveal writes an audit row.

**The database is the authority, not the screen.** Route access is enforced by `rbac.ts`, route-group guards, and page checks, but state changes are also protected by Row Level Security, guarded updates, transition checks, and unique/exclusion constraints. Hiding a button is never the security boundary.

**One shared domain layer.** Booking, PSS-10 scoring, referral triage, chat, notifications, analytics suppression, and RBAC live in `packages/shared-services`. The web and mobile apps render and adapt; they do not reimplement the rules.

**A real pre-session safety gate.** Completing a session requires a PSS-10 linked to that appointment and submitted within seven days before the start, or a 10–500 character operational waiver that is audited. Answers and scores never enter the audit record.

**Realtime without leaking content.** New messages, board changes, and notifications arrive through subscriptions that patch React Query caches. Realtime payloads carry IDs and status only; message bodies, note text, and check-in answers are not broadcast.

**Small-cell suppression in analytics.** Any report cell below five is hidden before display and export, so a small cohort cannot be re-identified from an office report.

**Honest documentation.** Features that are partial, narrowed, or unmeasured are labelled as such. See [OBJECTIVE_STATUS.md](OBJECTIVE_STATUS.md) and the [system objectives guide](docs/objectives/system-objectives-guide.md).

---

## 3. Roles and platforms

| Role | Platform | Purpose |
|---|---|---|
| **Student** | Mobile only | Register, book, check in, attend, chat, rate sessions, manage profile. |
| **Counselor** | Web | Dashboard, appointment queue, session calendar, availability, student records, notes, chat, referrals, feedback. |
| **Guidance head** | Web | Office oversight: assignment, reports, users, announcements, security review, backups. |
| **Faculty** | Web | Refer a student by exact student number, track own referrals, read faculty announcements. |
| **Admin** | Web (narrow) | Sign in and manage own settings. Office administration belongs to `guidance_head`. |
| **Guidance personnel** | None in this revision | Exists in the type system but has no route or action policy entry. |

Platform split, stated plainly:

- **Students are mobile-only.** The web staff layout rejects the student role.
- **Staff are web-only.** There is no counselor, faculty, or head mobile app.
- **One backend.** Both clients use the same Supabase project and the same shared services.

---

## 4. Feature map by role

### Student (mobile)

| Feature | Screen | What it does |
|---|---|---|
| First-run onboarding | `/` | Three welcome pages; the "seen" flag stays on the device. |
| Register / sign in | `/register`, `/login` | Email/password or Google; creates `profiles` and `students` rows. |
| Home | `/(tabs)/home` | Next session, announcements, mood self-check (not saved), breathing exercise, quick actions. |
| Book a session | `/book` | Concern, mode, day, slot, and optional alias. |
| PSS-10 check-in | `/check-in` | Booking step 2, pre-session check-in, or standalone screening. |
| Sessions | `/(tabs)/sessions` | Upcoming, past, and canceled; reschedule, cancel, rate, start a pre-session check-in. |
| Chat | `/chat` | Threads with counselors from confirmed/completed sessions. |
| Notifications | `/notifications` | Generic status messages with deep links. |
| Profile | `/(tabs)/profile` | Profile details, avatar, photo-sharing consent, onboarding replay, logout. |

### Counselor (web)

| Feature | Route | What it does |
|---|---|---|
| Dashboard | `/dashboard` | Today's sessions, confirmation queue, referral queue, unread messages, missing notes. |
| Appointment board | `/appointments` | Confirm, reschedule, complete, no-show, waiver, Meet link. |
| Session calendar | `/sessions` | Month/week/day view; open details and notes. |
| Availability | `/availability` | Create, edit, and delete weekly availability windows. |
| Student directory | `/students` | Alias directory with workload context. |
| Student record | `/students/[id]` | One case timeline grouped by month. |
| Session notes | Notes dialog | Freeform or S.O.A.P.; up to five private images. |
| Chat | `/chat` | Student threads and staff messages. |
| Referrals | `/referrals` | Confirm into a session, resolve, escalate, reject. |
| Feedback | `/feedback` | Ratings and comments from completed sessions. |
| Reports | `/reports` | Own scoped report. |
| Emergency | `/emergency` | Log break-glass access and reveal after review. |

### Guidance head (web)

Everything a counselor can read, plus:

| Feature | Route | What it does |
|---|---|---|
| Assignment | `/appointments` | Assign, unassign, and reject pending requests. |
| Office reports | `/reports` | Office-wide aggregates, cohorts, trends, data quality, Excel export, digest. |
| User management | `/users`, `/users/new` | Search, filter, activate/deactivate, create staff accounts. |
| Security review | `/security`, `/security/events` | Review break-glass grants; read the audit trail. |
| Backups | `/backups` | Run a manual backup, download an artifact, read run history. |
| Announcements | `/announcements` | Compose, target, draft, publish, unpublish, delete, read insights. |
| Referral oversight | `/referrals` | Assign, reject, and watch the pipeline. |

### Faculty (web)

| Feature | Route | What it does |
|---|---|---|
| Dashboard | `/dashboard` | Own referral history and status. |
| Refer a student | `/refer-student` | Exact student-number lookup; concern, priority, paper-form fields. |
| Referrals | `/referrals` | Track own referrals and read the action trail. |
| Reports | `/reports` | Own-referral report only. |
| Chat | `/chat` | Coordinate with counselors and the head. |
| Announcements | `/announcements` | Read faculty-targeted posts. |

### Admin (web, narrow)

`/settings` only. The admin account can sign in, edit its own profile, and sign out. It cannot open office boards, reports, security, backups, or user management.

---

## 5. Route map

### Web pages

```text
/                                Public landing page
├── /login                       Sign in (password or Google)
├── /register                    Student self-registration
├── /reset-password              Request a password reset
└── /update-password             Set a new password from the email link

Staff shell
├── /dashboard                   Role-specific overview
├── /reports                     Role-scoped reports
├── /about                       Staff handbook
├── /sessions                    Session calendar
├── /appointments                Appointment board and actions
├── /availability                Counselor availability
├── /chat                        Threads and direct messages
├── /students                    Alias directory
│   └── /students/[id]           One-student timeline
├── /referrals                   Referral pipeline
├── /refer-student               Faculty referral form
├── /emergency                   Break-glass access and reveal
├── /announcements               Feed, composer, insights
├── /feedback                    Student feedback
├── /notifications               Notification inbox
└── /settings                    Profile and preferences

Admin shell (guidance_head)
├── /users                       User directory and status
├── /users/new                   Create a staff account
├── /security                    Break-glass review console
├── /security/events             Audit event trail
└── /backups                     Backup runs and downloads
```

There are **26 web page files**: 1 landing, 4 public auth pages, 16 staff pages (including the dynamic student record), and 5 head-only admin pages.

### Mobile screens

```text
/                                Launch gate and first-run onboarding
├── /login                       Student sign-in
├── /register                    Student registration
└── (tabs)
    ├── /(tabs)/home             Greeting, next session, announcements, mood check, breathing
    ├── /(tabs)/sessions         Upcoming / Past / Canceled
    └── /(tabs)/profile          Profile, avatar, consent, logout

Root stack (pushed over the tabs)
├── /book                        Booking step 1 of 2
├── /check-in                    PSS-10 in three modes
├── /chat                        Counselor inbox and conversation
└── /notifications               Notification inbox
```

The tab bar shows **Home, Book, Chat, Sessions, Profile**. Only Home, Sessions, and Profile are real tab screens; Book and Chat are root stack screens presented as tab items.

### API route handlers

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/register`, `GET /auth/confirm` |
| Dashboards | `GET /api/dashboard/{head,counselor,faculty}` |
| Reports | `GET /api/reports/{head,counselor,faculty}`, `GET /api/reports/digest/cron` |
| Meet | `POST`, `PATCH`, `DELETE /api/appointments/meet` |
| Session notes | `GET`, `POST`, `PATCH /api/session-notes`; `POST /api/session-notes/attachments` |
| Chat contacts | `GET /api/chat/contacts` |
| Notifications | `POST /api/staff/notify` |
| Security | `POST /api/staff/security/{log,review}-break-glass`, `POST /api/staff/security/reveal` |
| Users | `POST /api/staff/users/status` |
| Backups | `GET`, `POST /api/admin/backups`; `GET /api/admin/backups/download`; `GET /api/admin/backups/cron` |

Full request/response contracts are in [`docs/architecture/api-reference.md`](docs/architecture/api-reference.md).

---

## 6. End-to-end workflows

### 6.1 Student: first run to a completed session

```text
/ (onboarding) -> /register -> /login -> /(tabs)/home
  -> /book (concern, mode, day, slot, alias)
  -> /check-in (PSS-10)
  -> /chat (lands here after booking)
  -> /(tabs)/sessions (pending -> assigned -> confirmed)
  -> reschedule or cancel (rules apply)
  -> /check-in?appointmentId=... (pre-session, from 7 days before)
  -> session happens
  -> /(tabs)/sessions -> rate once
```

1. **Register.** The student supplies name, email, student number, program, year level, and a password. Supabase Auth creates the user; `profiles` and `students` rows are provisioned.
2. **Book.** The student picks a concern, mode, day, and a real availability slot, and optionally turns on **Book under my alias**.
3. **Check in.** The PSS-10 is step 2 of booking. Submitting it creates a `pending` appointment with an idempotency key.
4. **Wait for assignment.** The guidance head sees the request on `/appointments` and assigns a counselor. The row becomes `assigned`; the student and counselor are notified.
5. **Confirmation.** The counselor confirms a final time inside their availability. Online sessions require a `meet.google.com` link, either created through the API or pasted manually. The row becomes `confirmed`.
6. **Pre-session check-in.** Seven days before the session, the same `/check-in` screen opens in pre-session mode and links the assessment to the appointment.
7. **Session.** The counselor completes the appointment after the scheduled time, or records a no-show.
8. **Notes.** Completion opens the notes editor: freeform or S.O.A.P., with optional private attachments and an optional follow-up.
9. **Rating.** The student rates the completed session once.

Rules that surprise first-time testers:

- Booking ends in **Chat**, not Sessions.
- The pre-session check-in is the **same screen** with an `appointmentId` parameter.
- A confirmed session can be moved by the student until **24 hours** before start.
- The UI spells the status **Canceled**; the database value is `cancelled`.

### 6.2 Counselor: a working day

```text
login -> /dashboard
  -> /appointments (confirm assigned requests)
  -> /sessions (calendar view)
  -> complete -> notes (freeform or S.O.A.P.)
  -> /students -> /students/[id] (timeline)
  -> /availability (keep windows current)
  -> /chat, /referrals, /feedback
```

1. **Dashboard.** Today's sessions, requests waiting for confirmation, referral queue, unread messages, and sessions that still need a note.
2. **Confirm.** Open an assigned request, choose a time inside availability, add a Meet link if online, save. The student is notified.
3. **Complete.** After the session, complete it. If there is no fresh linked check-in, enter an operational waiver reason (10–500 characters). The waiver is audited; clinical content must not be written there.
4. **Document.** Write one note per session. Only the assigned counselor writes; the head may read for oversight.
5. **Review the case.** Open the alias in `/students` and read the timeline. Note bodies are fetched on demand, not in the bulk timeline.
6. **Maintain availability.** Students can only book inside these windows, and confirmation/reschedule must stay inside them.

### 6.3 Guidance head: office operations

```text
login -> /dashboard
  -> /appointments (assign / unassign / reject)
  -> /reports (date range, cohort, trends, quality, export)
  -> /users, /users/new (accounts)
  -> /announcements (compose, target, publish)
  -> /security (review break-glass grants)
  -> /backups (run and download)
  -> /referrals (oversight)
```

- **Assignment.** A pending row can be rejected. An assigned row must be unassigned before it can be rejected.
- **Reports.** Choose a date range and cohort grouping (program, year level, or college). Read sessions, referrals, feedback, screenings, wellbeing trend, cohort stress, and data quality. Cells below five are suppressed before display and export.
- **Accounts.** Create counselor/faculty accounts, search and filter users, activate or deactivate. Deactivation takes effect at the next sign-in or page check.
- **Announcements.** Audience-targeted posts with optional image and event date. Drafts are hidden from non-head staff. Publishing fans out notifications.
- **Security.** Review break-glass grants promptly; a counselor cannot reveal identity until the head reviews. `/security/events` shows the audit trail.
- **Backups.** Manual run creates a compressed, checksummed artifact in the private backup bucket. Download links are short-lived and audit-logged. Restore is a runbook, not a button.

### 6.4 Faculty: refer and track

```text
login -> /dashboard -> /refer-student
  -> exact student-number lookup
  -> concern, priority, case classification, reason
  -> submit (referral + first referral_actions row)
  -> /referrals (track status and trail)
```

1. Enter the **exact student number**. There is no browse-all directory; this protects student privacy.
2. Choose the concern and priority, complete the case classification, and write factual observations.
3. Submit. The referral goes to the head for triage and assignment.
4. Track status and the action trail. Faculty never see clinical notes, check-in answers, or another faculty member's referrals.
5. When the counselor confirms, the system creates or links a real appointment through `source_referral_id`; it does not duplicate the referral.

---

## 7. Status reference

### Appointment status

| Status | Meaning | Who sets it |
|---|---|---|
| `pending` | Student request received; no counselor assigned. | Student booking |
| `assigned` | Head chose a counselor; counselor has not confirmed. | Guidance head |
| `confirmed` | Final time set inside availability; Meet link required for online. | Counselor |
| `completed` | Session happened; notes may be written. | Counselor |
| `no_show` | Session did not take place. | Counselor |
| `cancelled` | Student or office canceled. | Student / office |
| `rejected` | Request declined; assigned rows must be unassigned first. | Guidance head |

Transition shape:

```text
pending ──assign──▶ assigned ──confirm──▶ confirmed ──complete──▶ completed
   │                   │                     └──no_show──▶ no_show
   │                   └──cancel (student)──▶ cancelled
   └──reject (head)──▶ rejected
```

### Referral status

| Status | Meaning |
|---|---|
| `pending` | Filed; not yet triaged. |
| `assigned` | Head assigned a counselor. |
| `acknowledged` | Counselor has seen it. |
| `in_progress` | Being worked. |
| `confirmed` | Converted to or linked with a real appointment. |
| `resolved` | Closed with an outcome. |
| `escalated` | Needs head attention. |
| `rejected` | Declined with a reason. |

The database also accepts legacy values (`submitted`, `under_review`, `action_taken`, `closed`) from earlier migrations. New UI flows use the statuses above.

### Notification and chat states

- Chat threads are `open` or `closed`. A closed thread remains readable but read-only until the office reopens it.
- Notifications are generic status messages. They never contain PSS-10 answers/scores, note text, chat bodies, aliases, names, or student numbers.
- Backup runs are `running`, `completed`, `partial`, or `failed`.

---

## 8. Rules the system enforces

### Booking and scheduling

- **Idempotent booking.** A retry with the same idempotency key does not create a duplicate appointment.
- **Future slots only.** A student cannot book a past time or a slot outside counselor availability.
- **Double-booking is blocked in the database.** A slot exclusion constraint plus guarded updates means two simultaneous confirmations cannot both succeed. A 50-way race test produced 1 success and 49 `23P01` rejections.
- **Reschedule preserves duration.** `ends_at` follows `scheduled_at`.
- **24-hour student window.** A confirmed session can be moved by the student until 24 hours before start. Inside that window the app tells the student to contact the office.
- **Availability scopes confirmation.** A counselor can only confirm or reschedule inside their own availability windows.

### PSS-10

- **Booking freshness.** A PSS-10 used for booking must be within 30 days.
- **Pre-session freshness.** A check-in linked to a confirmed session must be submitted within 7 days before the session start.
- **Completion gate.** A session cannot be completed without a fresh linked check-in or a waiver reason of 10–500 characters.
- **Waiver is operational, not clinical.** The reason is audited but must not contain clinical detail.
- **Retakes are allowed.** The latest linked assessment is the one readers use.
- **Score is private.** The student is not shown the total; the counselor sees the band. Scores never appear in notifications, chat, analytics exports, or audit rows.

### Identity and access

- **Alias-first reads.** Routine staff views read `students.anonymous_alias`, not identity.
- **RLS denies routine identity reads.** Migration `00069` hardens identity access; hiding a page is not the boundary.
- **Exact lookup for referrals.** Faculty enter a student number; there is no browse-all student directory.
- **Break-glass is time-limited.** A justification of at least 20 characters creates a 30-minute grant.
- **Review before reveal.** A counselor's reveal requires head review; the head is the reviewer.
- **Caseload restriction.** A counselor can only reveal a student on their caseload (an assigned appointment or referral).
- **Everything is audited.** Log, review, and reveal each write audit rows; expired grants cannot be reused.

### Documentation and reporting

- **One note per session.** App-enforced, not a database constraint.
- **Completed sessions only.** Notes are available only after completion.
- **Assigned counselor writes.** Heads may read for oversight but do not author notes.
- **Small cells are suppressed.** Report cells below five are hidden before display and export.
- **No clinical content in audit or realtime.** Audit rows record who, when, and why; realtime payloads carry IDs and status.
- **No Server Actions.** Ordinary writes use the browser Supabase client plus shared services; privileged writes live in `app/api/**` with a role re-check.

---

## 9. Analytics and reports

Reports are role-scoped:

- **Head:** office-wide aggregates across sessions, referrals, feedback, screenings, wellbeing trend, cohort stress, and data quality.
- **Counselor:** own caseload report.
- **Faculty:** own-referral report.

Available sections:

| Section | What it shows |
|---|---|
| Sessions | Volume, completion, no-show, response time. |
| Referrals | Pipeline by status and concern. |
| Feedback | Rating distribution and comments coverage. |
| Screenings | PSS-10 volume and band mix. |
| Wellbeing trend | Daily volume, band mix, average score over time. |
| Cohort stress | Aggregates grouped by program, year level, or college. |
| Data quality | Missing notes, unlinked screenings, unassigned referrals, feedback coverage, summary freshness. |

Supporting objects:

- `analytics_daily_summary` — daily view used by the dashboard.
- `report_digests` — stored in-app digest.
- Head-only RPCs: `head_appointment_daily_counts`, `head_referral_status_counts`, `head_wellbeing_trends`, `head_cohort_stress`, `head_data_quality`, `head_report_digest`.

Export is an Excel workbook built in `apps/web/lib/reports/`. Suppression is applied before display and export. The digest is in-app only; it is not emailed.

---

## 10. Technology stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm 9.7.0 workspaces, Turborepo 2.5, Node >= 22.13.0 |
| Web | Next.js 14.2 App Router, React 18.3, TypeScript 5.6 strict, Tailwind 3.4, TanStack Query v5, Supabase SSR |
| Mobile | Expo SDK 58, React Native 0.88, React 19.3, expo-router, TypeScript 6.x, StyleSheet + `theme.ts` tokens |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Row Level Security |
| Shared packages | `shared-services` (domain), `shared-schemas` (Zod), `shared-types` (rows/domain), `supabase-client`, `ui-tokens`, `db` (Prisma mirror) |
| Reports | ExcelJS, Recharts |
| Icons | `lucide-react` (web), `lucide-react-native` per-icon imports (mobile) |
| Tests | Vitest (shared services), RLS integration suite, Playwright role smoke, performance harness |
| Deploy | Vercel (web), Expo/EAS (mobile), Supabase (backend) |

Two React majors coexist by design: web runs React 18, mobile runs React 19. Shared packages must stay framework-free.

Prisma is a **dictionary mirror**, not the runtime data path. Runtime access uses Supabase clients; migrations are the schema source of truth.

---

## 11. Repository layout

```text
apps/
  web/
    app/(public)/            login, register, reset/update password
    app/(staff)/             staff pages (role-filtered shared shell)
    app/(admin)/             head-only: users, security, backups
    app/api/                 privileged route handlers
    components/              feature UI + shared shell/nav
    lib/
      supabase/              browser, server, admin, middleware clients
      auth/                  requireRole, home route
      hooks/                 React Query board hooks + mutation helper
      reports/               Excel/report builders
      notify.ts, log-event.ts, pagination.ts, rate-limit.ts, patch-board.ts
    middleware.ts            session refresh via @supabase/ssr
  mobile/
    app/                     expo-router: index, login, register, (tabs), book, check-in, chat
    components/              primitives, mascot, illustrations, UI pieces
    lib/supabase/            AsyncStorage client + ensureStudent
    theme.ts                 design tokens for mobile
packages/
  shared-services/src/       appointments, assessments, referrals, chat, notifications,
                             security, analytics, rbac
  shared-schemas/src/        Zod input contracts
  shared-types/src/          database.ts row types + domain.ts
  supabase-client/src/       URL/key resolution + typed client type
  ui-tokens/src/             brand palette, typography, spacing
  db/                        Prisma schema + trusted-script client
supabase/migrations/         SQL source of truth (RLS, triggers, RPCs, indexes)
tests/rls/                   RLS integration suite
e2e/                         Playwright role smoke tests
perf-tests/                  standalone measurement harness
scripts/                     repository utilities
docs/                        architecture, objectives, UX, security, quality, operations, plans
```

---

## 12. Getting started

### Prerequisites

- **Node.js >= 22.13.0**
- **pnpm 9.7.0** — this repository does not support npm or yarn at the root
- A Supabase project (or local Supabase via the Supabase CLI)
- Optional: a Google Cloud OAuth app for Google sign-in and Meet creation

### Install

```bash
pnpm install
```

### Run the web portal

```bash
pnpm dev:web
```

Open `http://localhost:3000`.

### Run the mobile app

```bash
pnpm --filter @dorsu/mobile dev
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

### Run everything

```bash
pnpm dev
```

### Verify a change

```bash
pnpm --filter @dorsu/web typecheck
pnpm --filter @dorsu/mobile typecheck
pnpm --filter @dorsu/web lint
pnpm --filter @dorsu/web build
pnpm --filter @dorsu/shared-services test
```

`pnpm typecheck` at the root runs Turbo and depends on dependency builds, so it can be slower than a filtered run.

---

## 13. Environment variables

Names only. Never commit values or real student data.

### Required for both clients

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Web browser and SSR |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web browser and SSR |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile |

Both names resolve through `packages/supabase-client`. The mobile app reads the same project URL and anon key.

### Server-only

| Variable | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged route handlers only |
| `SUPABASE_PROJECT_ID` | Type generation |
| `CRON_SECRET` | Backup and digest cron routes |
| `DATABASE_URL`, `DIRECT_URL` | Prisma validation and trusted scripts |

### Google Meet / Calendar

| Variable | Used by |
|---|---|
| `GOOGLE_MEET_ENABLED` | Meet creation route |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REFRESH_TOKEN` | Office-account Calendar access |
| `GOOGLE_CALENDAR_ID` | Target calendar (`primary` by default) |

Without these, Meet creation returns 503 and the counselor can paste a `meet.google.com` link manually. The feature degrades rather than breaks.

### Test and performance harnesses

| Variable | Used by |
|---|---|
| `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY` | RLS and Playwright suites |
| `E2E_BASE_URL`, `E2E_WEB_COMMAND` | Playwright |
| `PERF_*` | Performance harness |

A template lives in `.env.example`. Never point test variables at staging or production; the suites create disposable users and clinical fixtures.

### Google sign-in setup

Both apps support **Continue with Google** against the same Supabase project:

1. Enable Google in Supabase Auth and paste the client ID/secret.
2. Add `https://<project-ref>.supabase.co/auth/v1/callback` as the authorized redirect URI in Google Cloud.
3. Add the app redirects to Supabase URL Configuration: `http://localhost:3000/**`, the production domain, `dorsu-mental://**`, and `exp://**`.

Full steps are in [`docs/operations/google-signin.md`](docs/operations/google-signin.md).

---

## 14. Database and migrations

- Migrations live in `supabase/migrations/`, named `000NN_snake_case.sql`, and are applied in order.
- There are **74 migration files** across the `00000`–`00074` range; `00055` is intentionally absent.
- RLS policies, triggers, RPCs, and constraints are part of the migration chain, not a separate layer.
- `packages/shared-types/src/database.ts` is a hand-maintained scaffold. Regenerate it when the schema changes.
- `packages/db/prisma/schema.prisma` mirrors the dictionary but does not include every table; migrations remain authoritative.

Useful commands:

```bash
pnpm db:validate        # prisma validate
pnpm db:generate        # prisma generate
pnpm db:types           # supabase gen types -> shared-types/src/database.ts
pnpm db:push            # DESTRUCTIVE-ISH: explicit approval only
```

On PowerShell, the root `db:types` script needs Git Bash/WSL because it uses shell redirection, or use `pnpm exec supabase gen types ... | Out-File`.

Never weaken RLS to make a query work. Fix the query or add a policy in a new migration.

---

## 15. Scripts

### Root

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps through Turbo |
| `pnpm dev:web` | Run the web app only |
| `pnpm build` | Build all packages/apps |
| `pnpm build:web` | Build the web app only |
| `pnpm lint` | Run linters across the workspace |
| `pnpm typecheck` | Typecheck through Turbo |
| `pnpm test` | Run package tests where defined |
| `pnpm e2e` | Run Playwright role smoke tests |
| `pnpm db:validate` | Validate the Prisma mirror |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:types` | Regenerate Supabase row types |
| `pnpm db:push` | Push Prisma schema (destructive-ish) |

### Performance sandbox

`perf-tests/` is a separate npm project, never imported by the apps:

```bash
cd perf-tests
npm install
npm run seed
npm run measure:pages
npm run measure:booking
npm run measure:mutations
npm run concurrency
npm run realtime
npm run explain
```

---

## 16. Testing and quality

| Layer | Command | Scope |
|---|---|---|
| Typecheck | `pnpm --filter @dorsu/web typecheck`, `pnpm --filter @dorsu/mobile typecheck` | Static correctness |
| Unit | `pnpm --filter @dorsu/shared-services test` | 86 Vitest cases across 9 files |
| RLS integration | `pnpm --filter @dorsu/rls-tests test:rls` | 14 cases against real Postgres/RLS |
| Browser smoke | `pnpm e2e` | 4 Playwright specs / 6 tests: student, counselor, faculty, head |
| Performance | `npm run measure:*` in `perf-tests/` | Page load, booking, mutations, concurrency, realtime, query plans |
| CI | `.github/workflows/ci.yml` | Typecheck, unit, build, RLS, browser smoke, nightly staging guards |

Unit coverage includes PSS-10 integrity and scoring, booking gates, idempotency, slot races, Meet URL validation, RBAC, and suppression. RLS coverage includes cross-student and cross-role isolation, note privacy, audit scope, and alias-only timeline reads.

The RLS and Playwright suites need a running local Supabase with all migrations applied:

```bash
supabase start
supabase db reset
```

CI runs the same stack with a pinned Supabase CLI.

---

## 17. Performance evidence

Measured against a staging dataset (11 and 23 October 2026). These are staging numbers, not production SLAs.

| Measure | Result |
|---|---|
| Normal page LCP | 168–540 ms |
| Throttled login LCP | 4,964 / 5,620 ms |
| Booking p50 | 1,179 ms unassigned / 1,464 ms assigned |
| Chat send p50 / p95 | 263 ms / 372 ms |
| Realtime delivery p50 / p95 | 379 ms / 495 ms, 0 lost |
| Slot race, 50 concurrent | 1 success, 49 rejected with `23P01` |
| Notification fan-out, 50 concurrent | 50 / 50 successful |

Raw results are in `perf-tests/results/*.json`. The interpretation and known gaps are in [`docs/quality/iso-25010-evaluation.md`](docs/quality/iso-25010-evaluation.md).

---

## 18. Security and privacy

### Identity model

- Students are known to routine staff by an **alias**.
- `students.anonymous_alias` is the routine identifier; `appointments.is_anonymous` records the booking preference.
- RLS in `00069_identity_rls_hardening.sql` denies routine identity reads.
- Faculty referrals use an exact student-number lookup, not a browse-all directory.
- Break-glass access is logged, time-limited (30 minutes), reviewed, caseload-scoped, and audited.

### What is guaranteed

A normal staff browser session cannot see a student's real identity without an audited, time-limited, reviewed action.

### What is not guaranteed

This is **not** mathematical anonymity. The alias-to-identity mapping exists in the same database. Service-role code and database administrators can correlate records. There is no field-level encryption for note bodies, chat messages, or PSS-10 answers; platform disk encryption applies. There is no external penetration test yet.

### Secure-coding rules

- The service-role client is server-only and must re-check role and ownership in code.
- Every state change uses a guarded update and, where relevant, a transition table or role check.
- Notifications are fire-and-forget and must never contain clinical content, aliases, names, or tokens.
- Realtime payloads carry IDs and status only.
- Audit rows record who, when, and why, never note text or check-in answers.
- Session-note attachments go through a privileged route and a private bucket.
- Secrets belong in environment variables, never in the repository.

Read the full model in [`docs/security/security-privacy.md`](docs/security/security-privacy.md) and the alias threat model in [`docs/security/anonymity-threat-model.md`](docs/security/anonymity-threat-model.md).

---

## 19. Deployment

### Web

Vercel builds the web app from the repository root:

- Install: `pnpm install`
- Build: `pnpm --filter @dorsu/web build`
- Output: `apps/web/.next`

`vercel.json` declares two cron routes:

| Route | Schedule | Requirement |
|---|---|---|
| `/api/admin/backups/cron` | `0 18 * * *` | `CRON_SECRET`; returns 503 when unset |
| `/api/reports/digest/cron` | `0 8 * * *` | `CRON_SECRET`; returns 503 when unset |

### Mobile

Expo/EAS builds from `apps/mobile` (`eas.json`). Google sign-in requires the mobile redirect scheme to be allowed in Supabase.

### Database

Migrations are applied manually/in order against the Supabase project. There is no automatic migration step in the Vercel build.

### Backup and restore

Manual and nightly backups write compressed, checksummed artifacts to a private bucket. Restore is intentionally not a UI button; follow [`docs/operations/backup-restore.md`](docs/operations/backup-restore.md).

---

## 20. Troubleshooting

| Problem | Likely cause | What to do |
|---|---|---|
| `pnpm install` fails | npm/yarn used at the root, or wrong Node version | Use pnpm 9.7.0 and Node >= 22.13.0. |
| Web build fails on types | `@types/react` duplicated in the graph | Keep one `@types/react` version; do not add a second copy. |
| Mobile Metro cannot resolve a workspace package | Metro not watching the repo root | Keep `metro.config.js` root watch settings. |
| Login loops or session is lost | Supabase URL/key mismatch or missing redirect URL | Check `.env` and Supabase URL Configuration. |
| Booking button does nothing | No saved check-in | Complete the PSS-10 first. |
| No available slots | Counselor has no availability or the next seven days are full | Set availability or try another day. |
| Cannot reschedule a confirmed session | Inside the 24-hour window | Contact the Guidance Office. |
| Meet creation returns 503 | Google credentials not configured | Paste a `meet.google.com` link manually. |
| Report cell looks blank | Cell suppressed because the group is smaller than five | Not an error; read the data-quality panel. |
| Backup download fails | Download link expired (30 minutes) | Run or open the backup again. |
| Cron returns 503 | `CRON_SECRET` unset | Configure the secret in Vercel. |
| RLS tests skip | `TEST_SUPABASE_*` not exported | Start local Supabase and export credentials. |

---

## 21. Documentation map

The `docs/` folder holds the evidence behind every claim in this README.

### Start here

| Document | Purpose |
|---|---|
| [`docs/objectives/system-objectives-guide.md`](docs/objectives/system-objectives-guide.md) | Objective-by-objective narrative: where each lives, how it works, what to demo, honest limits. |
| [`OBJECTIVE_STATUS.md`](OBJECTIVE_STATUS.md) | Plain-language status of the eleven study objectives with demo steps. |
| [`Objective_Achievement_Report.md`](Objective_Achievement_Report.md) | Detailed technical achievement audit and evidence log. |
| [`AGENTS.md`](AGENTS.md) | Repository operating rules for contributors. |

### Architecture

| Document | Purpose |
|---|---|
| [`docs/architecture/architecture.md`](docs/architecture/architecture.md) | Stack, modules, request/data flow, deployment, boundaries. |
| [`docs/architecture/database-diagram.md`](docs/architecture/database-diagram.md) | ER diagrams, connection reference, privacy map, schema invariants. |
| [`docs/architecture/api-reference.md`](docs/architecture/api-reference.md) | Route handlers, RPCs, shared-service entry points, status codes. |
| [`docs/architecture/realtime-audit.md`](docs/architecture/realtime-audit.md) | Realtime channels, notification fan-out, board refresh. |

### Objectives and workflows

| Document | Purpose |
|---|---|
| [`docs/objectives/objective-focus-workflow.md`](docs/objectives/objective-focus-workflow.md) | Booking -> PSS-10 -> session -> notes -> analytics, with sequence/state diagrams. |
| [`docs/objectives/objective-7-announcement-scope.md`](docs/objectives/objective-7-announcement-scope.md) | Why Objective 7 is announcement management, not events/RSVP. |

### User experience

| Document | Purpose |
|---|---|
| [`docs/ux/user-guide.md`](docs/ux/user-guide.md) | Step-by-step use for every role, privacy in plain words, troubleshooting, FAQ. |
| [`docs/ux/ui-sitemap.md`](docs/ux/ui-sitemap.md) | Route trees, sitemap diagram, screen inventory, role access matrix, journeys. |
| [`docs/ux/usability-accessibility-protocol.md`](docs/ux/usability-accessibility-protocol.md) | UAT/SUS and WCAG protocol - protocol only; no sessions run yet. |

### Security and quality

| Document | Purpose |
|---|---|
| [`docs/security/security-privacy.md`](docs/security/security-privacy.md) | Anonymity model, break-glass, RBAC, data protection, threat model, audit rules. |
| [`docs/security/anonymity-threat-model.md`](docs/security/anonymity-threat-model.md) | Threat model for aliases, routine staff reads, and identity reveal. |
| [`docs/security/pss10-license-note.md`](docs/security/pss10-license-note.md) | PSS-10 provenance, permission status, and compliance caveat. |
| [`docs/quality/iso-25010-evaluation.md`](docs/quality/iso-25010-evaluation.md) | ISO/IEC 25010 mapping, measured results, evidence gaps, measurement plan. |

### Operations and planning

| Document | Purpose |
|---|---|
| [`docs/operations/backup-restore.md`](docs/operations/backup-restore.md) | Backup artifacts, restore procedure, cron behaviour, drill requirements. |
| [`docs/operations/google-meet-integration.md`](docs/operations/google-meet-integration.md) | Google Calendar/Meet setup, scopes, fallback, failure modes. |
| [`docs/operations/google-signin.md`](docs/operations/google-signin.md) | Google OAuth configuration for Supabase, web, and mobile. |
| [`docs/plans/`](docs/plans/) | Phase and remediation records. |
| [`docs/sql/`](docs/sql/) | One-off SQL applied outside the migration chain. |
| [`docs/assets/`](docs/assets/) | Spreadsheet artifacts used by the study. |

### App and test documentation

| Document | Purpose |
|---|---|
| [`apps/mobile/README.md`](apps/mobile/README.md) | Mobile routes, wired-vs-mocked history, design tokens, gotchas. |
| [`e2e/README.md`](e2e/README.md) | Playwright setup, fixtures, and role journeys. |
| [`tests/rls/README.md`](tests/rls/README.md) | RLS integration test setup and scope. |

Documentation conventions:

- Top-level documents use `UPPER-KEBAB.md`; documents inside a folder use `lowercase-kebab.md`.
- `Implemented` means the route, service, and schema exist and are wired.
- `PARTIAL` means the capability exists but a stated part is missing or unverified.
- `PROPOSED` means a design only; no implementation exists.
- File references use repository-relative paths.
- Diagrams use Mermaid and render on GitHub.

---

## 22. Glossary

| Term | Meaning |
|---|---|
| **Alias** | The name routine staff see instead of a student's real identity. |
| **Appointment / session** | A booked counseling meeting, in person or online. |
| **Assigned** | The head chose a counselor; the counselor has not confirmed. |
| **Break glass** | Emergency, time-limited, logged access to a real identity. |
| **Cohort** | A report grouping such as program, year level, or college. |
| **Digest** | An in-app summary of office activity; not emailed. |
| **Idempotency key** | A token that prevents a retried booking from creating a duplicate. |
| **Meet link** | A Google Meet address for an online session. |
| **Migration** | A versioned SQL schema change in `supabase/migrations/`. |
| **PSS-10** | A 10-item perceived-stress screening questionnaire, not a diagnosis. |
| **RLS** | Row Level Security: database rules that decide which rows a user may read or change. |
| **RPC** | A database routine the app calls to read or change data safely. |
| **S.O.A.P.** | Subjective, Objective, Assessment, Plan - a session-note format. |
| **Suppression** | Hiding report cells smaller than five people to protect privacy. |
| **Waiver** | A short, audited operational reason a pre-session check-in was not completed. |

---

## 23. Known limits and honest status

### Objective verdicts

| # | Objective | Verdict |
|---:|---|---|
| 1 | User-friendly interface | **Partial** - built and role-aware; no participant usability study, SUS score, or WCAG audit yet. |
| 2 | Booking, rescheduling, cancellation, PSS-10 | **Implemented.** |
| 3 | Secure anonymous identity | **Implemented** as pseudonymity plus audited re-identification. |
| 4 | Counselor dashboard, records, notes | **Implemented.** |
| 5 | Analytics, stress trends, reports | **Implemented.** |
| 6 | Realtime chat | **Implemented.** |
| 7 | Announcement management | **Partial** - scope narrowed; no events, RSVP, venue, or attendance. |
| 8 | Google Meet link | **Implemented** with manual-paste fallback. |
| 9 | Break-glass emergency access with audit | **Implemented.** |
| 10 | Faculty referral feature | **Implemented.** |
| 11 | ISO/IEC 25010 evaluation | **Partial** - performance and automated tests exist; no usability study, accessibility audit, or penetration test. |

### Known gaps

- **No participant usability study.** The protocol exists; the sessions have not been run.
- **No WCAG/screen-reader audit.** Accessibility is designed for, not measured.
- **No external penetration test.** The threat model and RLS tests exist.
- **Notes and chat are plain text at rest.** Platform disk encryption applies; there is no application-layer field encryption.
- **No student web portal or staff mobile app.** The split is deliberate.
- **No push-delivery worker.** The notification contract exists; a delivery worker is not in this repository.
- **No email delivery.** Digest and referral updates are in-app only.
- **Admin is narrow.** Only `/settings` is allowed; office administration is performed by `guidance_head`.
- **The mood picker is not saved.** It is a self-check moment, not mood history.
- **Some RBAC entries are stale.** `/analytics`, `/resources`, and `/appointments/new` are listed in policy but have no pages.
- **What to say if challenged.** If someone claims "the system is anonymous," correct it: alias by default, identity only through logged break-glass.

The full, evidence-linked version of this section is [`docs/objectives/system-objectives-guide.md`](docs/objectives/system-objectives-guide.md).

---

## License and ownership

This is an academic and institutional project for the DOrSU Guidance Office. No open-source license file is included in this repository, so default copyright applies. The PSS-10 instrument has its own provenance and permission caveat; see [`docs/security/pss10-license-note.md`](docs/security/pss10-license-note.md). Do not deploy with real student data until the Guidance Office approves the data-processing arrangement and the restore drill has been run.
