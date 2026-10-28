# Objective Status — Plain-Language Guide

**Project:** DOrSU Guidance / “Chekie” — Digital Counseling and Appointment System with Analytics
**Date of this status:** 28 October 2026
**Written for:** non-technical readers (panel, adviser, demo audience), while still pointing to the exact screens and files for verification.
**Companion document:** `Objective_Achievement_Report.md` (the technical audit). This file is the friendly version plus the end-to-end workflows.

---

## How to read this

Each objective has the same five parts:

| Part | Meaning |
|---|---|
| **What the objective asks** | The requirement in one sentence. |
| **Where you see it** | The actual web page or mobile screen. |
| **Step-by-step** | Who clicks what, in order. This is the workflow you can demo. |
| **Where it is saved** | Which real database tables/records are written. |
| **Status and honest note** | Done / mostly done / partly done, and the one caveat a panel may ask about. |

**Verdict scale**

- **DONE** — works end-to-end and is saved in the database.
- **DONE — scope adjusted** — works, but the wording was narrowed and that narrowing is documented.
- **ALMOST** — the feature works; the *proof* (a study, an audit) is not complete yet.
- **PARTLY** — a real part exists, but a central promise is still missing evidence.

---

## 1. The short answer

| Question | Answer |
|---|---|
| Is the web app done? | **Yes, functionally.** It is the staff portal: guidance head, counselors, faculty, and admin. Every page is connected to live data. |
| Is the mobile app done? | **Yes, functionally.** It is the student app: onboarding, register/login, home, booking, PSS-10 check-in, sessions, chat, notifications, profile. No mock data remains. |
| Do web and mobile share one backend? | **Yes.** One Supabase project (Postgres + Auth + Storage + Realtime + Row Level Security). Both apps read and write the same records. |
| Is everything wired to the database? | **Yes for every data-bearing screen.** The only “not saved” items are intentional local things: the onboarding flag, the breathing exercise, the mood picker, and the static DOrSU program/year list used at registration. See §3. |
| How many objectives are fully done? | **9 of 11 fully done**, 1 almost (user-friendliness lacks a participant study), 1 partly (ISO/IEC 25010 evaluation). |

**One-line honest claim for the defense:**

> “Nine of eleven objectives are fully working software wired to one database; the user-friendly interface objective works but has not yet been measured with real non-technical participants; the ISO/IEC 25010 evaluation has performance and automated-test evidence but not a usability study or penetration test.”

---

## 2. Status at a glance

| # | Objective | Web | Mobile | Saved in DB? | Status |
|---:|---|---|---|---|---|
| 1 | User-friendly interface for students, counselors, head | Staff portal | Student app | Yes (all screens) | **ALMOST** — design is good, no participant usability study yet |
| 2 | Book / reschedule / cancel + PSS-10 before session | Head assigns, counselor confirms/completes | Student books, checks in, reschedules, cancels | Yes | **DONE** |
| 3 | Secure anonymous identity | Alias-only staff views + audited reveal | Anonymous booking toggle | Yes | **DONE** (pseudonymity + logged reveal, not mathematical anonymity) |
| 4 | Counselor dashboard: schedules, records, notes | Dashboard, calendar, student record, S.O.A.P. notes | — | Yes | **DONE** |
| 5 | Analytics: collect data, stress trends, reports | Head reports, cohorts, trends, quality, export, digest | — | Yes | **DONE** |
| 6 | Real-time chat | Counselor/head/faculty inbox | Student inbox + conversation | Yes | **DONE** |
| 7 | Announcement management | Compose, target, draft, publish, insights | Home feed | Yes | **DONE — scope adjusted** (announcements, not events/RSVP) |
| 8 | Google Meet link | Create/paste link on confirm, join button, remove | “Join” via counselor message/link | Yes | **DONE** (server-side API with manual paste fallback) |
| 9 | Break-glass emergency access with audit | Emergency log → head review → reveal → audit | — | Yes | **DONE** |
| 10 | Faculty referral feature | Refer a student, track, assign, confirm, resolve | — | Yes | **DONE** (web only, by design) |
| 11 | ISO/IEC 25010 evaluation | Performance harness + automated tests | — | — | **PARTLY** — no participant study, accessibility audit, or penetration test |

---

## 3. Is it all wired to the database?

### 3.1 What “wired” means here

A screen is **wired** when it reads from Supabase and writes back to Supabase through the shared service layer — not from a hardcoded list in the app.

- The search for leftover mock/demo data (`mock`, `dummy`, `sample`, `fake`, `lorem`) across both apps returned **no matches**.
- The old mobile fixture file `apps/mobile/data/mock.ts` **no longer exists**.
- Every staff page loads through a React Query hook under `apps/web/lib/hooks/` or a server route under `apps/web/app/api/`.
- Every student screen calls `getSupabase()` and a function from `@dorsu/shared-services`.

### 3.2 Screen-by-screen

| Screen | Platform | Reads from DB | Writes to DB |
|---|---|---|---|
| Onboarding carousel | Mobile | No (first-launch flag on device) | Device only |
| Register / Login / Reset password | Mobile + Web | Supabase Auth | `auth.users`, `profiles`, `students` |
| Home | Mobile | appointments, announcements, notifications, profile | — |
| Book a session | Mobile | `counselor_availability` | Creates `appointments` (pending) |
| PSS-10 check-in | Mobile | canonical instrument | `pss10_assessments` |
| Sessions | Mobile | own appointments, feedback, check-ins | cancel, reschedule, feedback |
| Chat | Mobile | `chat_threads`, `chat_messages` | sends messages |
| Notifications | Mobile | `notifications` | mark read |
| Profile | Mobile | `profiles`, `students` | avatar upload, share-photo opt-in |
| Dashboard | Web | role-scoped dashboard API | — |
| Appointments | Web | appointments board | assign, reject, confirm, reschedule, complete, no-show, waiver, Meet link |
| Sessions calendar | Web | confirmed sessions | complete, no-show, notes |
| Availability | Web | `counselor_availability` | create/edit/delete slots |
| Students + Student record | Web | alias directory, record/timeline RPCs | — (notes written per session) |
| Chat | Web | threads/messages | send, close |
| Referrals | Web | referrals + `referral_actions` | assign, confirm (mints session), resolve, escalate, reject |
| Refer a student | Web | exact student lookup | creates referral + audit trail |
| Announcements | Web | `announcements` | draft, publish, unpublish, delete, insights |
| Reports | Web | analytics RPCs + daily summary | export only |
| Feedback | Web | `feedback` | — |
| Notifications | Web | `notifications` | mark read |
| Emergency | Web | break-glass grants, alias directory | log access, reveal, review |
| Users / Security / Backups | Web (head/admin) | profiles, audit logs, `backup_runs` | status changes, reviews, backups |
| Settings | Web | own profile | profile edits |

### 3.3 The honest exceptions (local-only by design)

These look like data but are intentionally not saved:

1. **Onboarding carousel** — shown once per install; the “seen” flag lives on the device.
2. **Breathing exercise** — follows a bundled audio file and a script; nothing clinical is stored.
3. **Mood picker on Home** — this is the one item worth knowing: choosing a mood is **not persisted**. It is a self-check moment, not a screening. If the panel expects “mood history,” that does not exist today.
4. **Program / year-level list at registration** — a fixed reference list of DOrSU programs, not user data.
5. **Quick-reply chips in chat** — text shortcuts only.

### 3.4 External dependency

**Google Meet** can create links automatically only when Google credentials/refresh token are configured on the server. If they are not, the system cleanly falls back to **pasting a `meet.google.com` link**. Either way the link is stored on the appointment. No feature silently breaks.

---

## 4. What lives where (web vs mobile)

This is the most common source of confusion, so it is stated plainly:

| Role | Uses | Why |
|---|---|---|
| **Student** | **Mobile only** | The student portal is the Expo app. The web shell intentionally rejects student sign-in (`apps/web/app/(staff)/layout.tsx`). |
| **Counselor** | Web | Dashboard, appointments, sessions, availability, students, chat, referrals, reports, feedback |
| **Guidance head** | Web | Everything a counselor sees, plus office-wide analytics, users, security console, backups |
| **Faculty** | Web | Dashboard, own referrals, refer-a-student, reports (own referrals), chat, announcements feed |
| **Admin** | Web | Limited: settings only; head-only tools live in the admin area |

**Important honest note for Objective 1:** The objective says “web and mobile interface for students, counselors, and the guidance head.” In practice the split is **students = mobile, staff = web**. There is no student web portal and no counselor mobile app. That is a deliberate design choice, not an unfinished page — but say it that way, because a panel may otherwise look for a student login on the website.

---

## 5. The core workflow — Objective 2, step by step

This is the “appointment assigned counselor to student” flow you asked about.

### 5.1 The full journey

```
STUDENT (mobile)                HEAD (web)                 COUNSELOR (web)              SYSTEM
────────────────                ──────────                 ───────────────              ──────
1. Book a session
   concern, mode,
   day, time, anonymous
        │
2. Answer PSS-10
   check-in
        │
        └── creates appointment ──▶ 3. Sees "pending"
            status = pending           on /appointments
                                       │
                                       4. Picks counselor
                                          from the Assign
                                          dropdown
                                          │
                                          └── status = assigned ──▶ 5. Sees it in queue
                                                                     /appointments or
                                                                     /dashboard
                                                                        │
                                                                        6. Clicks Confirm
                                                                           sets final time
                                                                           inside own
                                                                           availability
                                                                           online → Meet link
                                                                           │
                                                                           └── status = confirmed
        ◀────────────── student notified: counselor name, time, join link ──┘
        │
7. Sees it in Sessions tab
   (Upcoming)
        │
8. Up to 7 days before:
   pre-session check-in
   linked to this session
        │
9. Session happens ──────────────────────────────────────▶ 10. Counselor clicks Complete
                                                              (or No-show)
                                                              │
                                                              ├─ fresh check-in? → complete
                                                              └─ no check-in? → waiver dialog
                                                                 (10–500 char reason, audited)
                                                              │
                                                              └── status = completed
                                                                 opens Notes modal
                                                                 Freeform or S.O.A.P.
        ◀────────────── student notified: session completed ──┘
        │
11. Student rates
    the session
```

### 5.2 What each person actually sees

**Student (mobile)**

1. On **Home**, tap **Book a session**.
2. Step 1 — pick the **concern**, the **mode** (In person / Online), a **day and time** from real counselor availability, and optionally turn on **anonymous**.
3. Step 2 — answer the **PSS-10** items. The total score is **not shown** to the student.
4. Submit → the request is saved as **pending**. The student lands in chat.
5. On **Sessions → Upcoming**, the card shows status and, once assigned, the **counselor’s name**.
6. **Cancel** and **Reschedule** are available from the session card. A confirmed session can be moved until **24 hours** before the start; inside 24 hours the app tells the student to contact the Guidance Office.
7. From **7 days** before the session, a **pre-session check-in** becomes available.
8. After the session, the student can **rate** it once.

**Guidance head (web)**

1. Open **Appointments**. New requests sit at **pending**.
2. In the **Counselor** column, use the **Assign** dropdown to pick a counselor. The row becomes **assigned**.
3. The student and the counselor are notified automatically.
4. A pending row can be **Rejected**. An assigned row must be **unassigned first** — the board says so on screen (“Assigned — unassign to reject”).

**Counselor (web)**

1. The assigned session appears in the **Appointments** queue and on the **Dashboard**.
2. Click **Confirm**. The dialog asks for a final date/time **inside the counselor’s own availability**.
3. If the mode is **Online**, the counselor either **creates a Google Meet link** or **pastes** one. The system validates it is a real `meet.google.com` link.
4. Confirm → status becomes **confirmed**; the student is notified with the schedule and link.
5. **Reschedule** is available for assigned or upcoming confirmed sessions.
6. Once the scheduled time has passed, **Complete** and **No-show** appear.
7. **Complete** requires a fresh pre-session check-in. If there is none (walk-in, referral, paper form), the counselor records a short **operational reason**; that waiver is saved on the appointment and written to the audit log — **answers and scores are never written to the audit**.
8. Completing opens the **session notes** dialog: Freeform or S.O.A.P. (Subjective, Objective, Assessment, Plan). Notes are visible only to the assigned counselor and the head.

### 5.3 Where it is saved

| Action | Table / field |
|---|---|
| Booking | `appointments` (`status = pending`, concern, mode, `is_anonymous`, `scheduled_at`) |
| PSS-10 | `pss10_assessments` (answers + band; total not shown to student) |
| Assignment | `appointments.counselor_id`, `status = assigned` |
| Confirmation | `status = confirmed`, `confirmed_datetime`, `meeting_url`, `meeting_provider`, `meeting_event_id` |
| Reschedule | `scheduled_at`, `ends_at` (duration preserved) |
| Completion | `status = completed`; optional `pss10_waived_at`, `pss10_waiver_reason` |
| Notes | `session_notes` (`note_format`, `subjective`, `objective`, `assessment`, `plan`, `content`) |
| Rating | `feedback` |
| Audit | `audit_logs` (waiver, reveal, reviews — never clinical content) |

### 5.4 The two guards worth mentioning

- **Double-booking is blocked by the database**, not just the screen. Two counselors (or two requests) cannot hold the same slot; a race returns “That time was just taken.” This was tested with 50 simultaneous confirmations: **1 succeeded, 49 were rejected**.
- **Booking is idempotent**: a network retry does not create a duplicate appointment.

---

## 6. Objective-by-objective detail

### Objective 1 — User-friendly mobile and web interface

**What the objective asks:** A usable interface for students, counselors, and the guidance head.

**Where you see it**

| Audience | Where |
|---|---|
| Student | Mobile: onboarding → login → Home → Book → Check-in → Sessions → Chat → Profile |
| Counselor / Head / Faculty | Web: `/dashboard`, `/appointments`, `/sessions`, `/students`, `/chat`, `/reports`, `/about` |
| Help for staff | Web `/about` — a role-scoped handbook explaining the pipeline and each page |

**Step-by-step (first-time student)**
1. Open the app → three-page onboarding with the mascot → **Get started**.
2. **Register** (name, email, student number, program, year level, strong password) → confirm email → **Log in**.
3. **Home** greets the student by name, shows the next session, announcements, a breathing exercise, and quick actions.
4. **Book a session** is a two-step flow; labels are plain language, buttons are large, and errors are short and actionable.

**Where it is saved:** Interface preferences are local; all actual content is from the database (see §3).

**Status: ALMOST.**
The interface is consistent (shared colours/typography), role-aware, and has loading and empty states. The honest gap is **proof**: there is no usability study with non-technical participants yet — no SUS score, task-success rate, or time-on-task. Also note the **web is staff-only**; students use mobile.

---

### Objective 2 — Appointments + PSS-10 before each session

**What the objective asks:** Students can book, reschedule, and cancel; a PSS-10 stress check is administered before the session.

**Where you see it**

| Step | Platform | Screen |
|---|---|---|
| Book | Mobile | `/book` then `/check-in` |
| Assign counselor | Web | `/appointments` (head) |
| Confirm / reschedule / complete | Web | `/appointments`, `/sessions` (counselor) |
| Cancel / reschedule / rate | Mobile | Sessions tab |

**Step-by-step:** See §5 in full.

**Where it is saved:** `appointments`, `pss10_assessments`, `counselor_availability`, `feedback`, `audit_logs`.

**Status: DONE.**
Booking, assignment, confirmation, reschedule, cancellation, completion, no-show, the 7-day pre-session gate, and the audited waiver all work. Two plain-language rules to explain in a demo:

- **30 days** — a PSS-10 used for booking must be recent (within 30 days).
- **7 days** — a check-in linked to a specific confirmed session must be submitted within 7 days before it starts.
- **24 hours** — a confirmed session can still be moved by the student until 24 hours before start.

---

### Objective 3 — Secure anonymous identity

**What the objective asks:** Protect student confidentiality during counseling.

**Where you see it**

| Piece | Where |
|---|---|
| Anonymous toggle | Mobile booking step 1 |
| Alias instead of name | Every staff list: appointments, sessions, students, chat, reports, feedback |
| Identity reveal | Web `/emergency` → log access → head reviews → reveal |
| Audit trail | Web `/security` (head console), `/security/events` |

**Step-by-step (what staff can and cannot see)**
1. A student books with **anonymous** on. Staff see an **alias** (for example, a generated code name), never the student number or real profile.
2. Routine staff cannot browse the student table or a student’s profile at all — the database denies it, not just the page.
3. Faculty referrals use an **exact student-number lookup**, not a browse-all directory.
4. In an emergency, a counselor opens **Emergency**, selects the alias, and **logs access** with a reason. A **30-minute grant** opens.
5. A counselor’s reveal waits for **head review**. The head reviews it in the **Security** console.
6. The reveal action is written to `audit_logs`; grants are time-limited.

**Where it is saved:** `students.anonymous_alias`, `appointments.is_anonymous`, `break_glass_logs`, `audit_logs`; RLS policies in `supabase/migrations/00069_identity_rls_hardening.sql`.

**Status: DONE — with a precise definition.**
This is **pseudonymity with audited re-identification**, not mathematical anonymity. The database still holds the alias → identity mapping so an emergency reveal is possible; service-role/database administrators can correlate records. What the system guarantees is that a **normal staff browser session cannot** see identity without an audited, time-limited, reviewed action. Say the exact sentence: *“Alias by default; identity only through logged break-glass.”*

---

### Objective 4 — Counselor dashboard: schedules, records, notes

**What the objective asks:** One place for a counselor to manage their schedule, student records, and session documentation.

**Where you see it**

| Function | Where |
|---|---|
| Work queue and today | Web `/dashboard` |
| Full appointment board | Web `/appointments` |
| Calendar (month/week/day) | Web `/sessions` |
| Availability slots | Web `/availability` |
| Alias directory | Web `/students` |
| One-student case timeline | Web `/students/[id]` |
| Session notes | Notes button on a completed session |

**Step-by-step (a counselor’s day)**
1. Log in → land on **Dashboard**. See the queue, upcoming sessions, and pipeline signals.
2. Open **Appointments** to confirm assigned requests.
3. Use **Sessions** for the calendar view; click a day, then a session, to see details.
4. After a session, click **Complete** → write notes (Freeform or S.O.A.P.).
5. Open **Students** → pick an alias → **Student record** shows one timeline grouped by month: sessions, referrals, screenings, feedback, note markers, and follow-ups.
6. Note text is **not** loaded into the timeline in bulk; each session’s note opens on demand. That is a privacy decision, not a missing feature.
7. Set or change weekly **Availability** so booking and confirmation only offer real slots.

**Where it is saved:** `appointments`, `session_notes` (including the four S.O.A.P. columns), `counselor_availability`, `follow_up_of`, `audit_logs`.

**Status: DONE.**
The record is intentionally **metadata-first**; it is not a single free-text case narrative. Note bodies stay per session and are readable by the owning counselor and the head.

---

### Objective 5 — Analytics module

**What the objective asks:** Collect counseling data, identify student stress trends, and generate reports for the guidance head.

**Where you see it**

| Function | Where |
|---|---|
| Office-wide reports | Web `/reports` (head) |
| Personal report | Web `/reports` (counselor) |
| Own-referral report | Web `/reports` (faculty) |
| Sections | Sessions, referrals, feedback, screenings, wellbeing trend, cohort stress, data quality |
| Filters | Date range, cohort grouping (program / year / college), section |
| Export | Excel workbook with a “Quality & trends” sheet |
| Daily digest | In-app, saved by a scheduled job |

**Step-by-step (head preparing a report)**
1. Log in → **Reports**.
2. Choose a **date range** and the **section** you need.
3. Review the **Wellbeing trend** panel: daily screening volume, band mix, average score.
4. Open **Cohort stress** and switch the grouping between **program**, **year level**, and **college**.
5. Check **Data quality**: missing notes, unlinked screenings, unassigned referrals, feedback coverage, summary freshness.
6. Export to Excel if a printed/office copy is needed.
7. The daily digest is generated in-app and stored; it is **not emailed** (that was explicitly out of scope).

**Where it is saved:** `analytics_daily_summary`, `report_digests`, and the report RPCs from migrations `00061` and `00071`; all reads go through head-only guards.

**Status: DONE.**
Two honest scope notes: **predictive modelling is out of scope** — the objective asks to identify stress *trends*, which longitudinal and cohort views do; and **small groups are hidden** — any cohort with fewer than 5 screenings is withheld so no individual can be inferred.

---

### Objective 6 — Real-time chat

**What the objective asks:** Students and guidance staff can message in real time.

**Where you see it**

| Side | Where |
|---|---|
| Student | Mobile **Chat** — inbox of counselors, then conversation |
| Staff | Web `/chat` — threads, unread counts, notifications |
| Faculty | Web `/chat` (faculty-to-staff messaging rules apply) |

**Step-by-step**
1. A student’s chat inbox lists only counselors from their **confirmed or completed** sessions. There is no anonymous “Guidance Office” thread.
2. Tapping a counselor opens (or creates) the one thread for that pair.
3. Messages send immediately and are stored.
4. The other side receives a **notification** and the message appears through a live subscription — no refresh needed.
5. Opening the conversation clears unread chat notifications.

**Where it is saved:** `chat_threads`, `chat_messages`, `notifications`; a database trigger creates the generic “New message” notification (no message text, no clinical content).

**Status: DONE.**
Known limits: no typing indicator or read receipt was verified, and there is no offline queue. Messages need a connection.

---

### Objective 7 — Announcement management

**What the objective asks (adjusted wording):** Publish announcements/activities to the right audience.

**Where you see it**

| Piece | Where |
|---|---|
| Compose / draft / publish | Web `/announcements` (head) |
| Read feed | Web `/announcements` (counselor, faculty) and mobile **Home** |
| Insights | Web `/announcements` → **Insights** tab |

**Step-by-step (head publishing)**
1. Open **Announcements** → compose a post with a title, body, and optional image.
2. Choose the **audience** (for example students, faculty, or counselors).
3. **Save as draft** or **Publish**.
4. Publishing triggers notifications to the targeted roles; the post appears on the mobile Home feed and the staff feed.
5. **Insights** shows reach/engagement for the posts.
6. Drafts are invisible to non-head staff.
7. A published post can be **unpublished** or deleted.

**Where it is saved:** `announcements` (`published_at`, audience/role, image path), `notifications`, storage bucket for images.

**Status: DONE — scope adjusted.**
This is **announcement management**, not event management. There is **no event calendar, venue, date range, RSVP, or attendance tracking**. That boundary is written in `docs/objective-7-announcement-scope.md`. Say it before the panel asks.

---

### Objective 8 — Google Meet link

**What the objective asks:** An embedded/attached Google Meet link for online counseling.

**Where you see it**

| Piece | Where |
|---|---|
| Create / paste link | Web confirm dialog (Appointments), also referral confirm |
| Join button | Appointments row (“Join Meet”), session detail |
| Remove link | Session detail modal |
| Student access | The link is included in the confirmation notification |

**Step-by-step (counselor confirming an online session)**
1. Confirm an **Online** session.
2. In the dialog, click **Create Meet link** (server calls Google Calendar/Meet) **or paste** a `meet.google.com` link.
3. The link is validated and saved on the appointment with provider `google_meet`.
4. The student is notified with the schedule **and** the link.
5. If the session is rescheduled, the calendar event is moved; if the request is rejected, the event is cleaned up.
6. Staff can remove the link from the session detail modal.

**Where it is saved:** `appointments.meeting_url`, `meeting_provider`, `meeting_event_id` (migration `00072`).

**Status: DONE.**
Honest caveat: automatic creation needs configured Google credentials. Without them, the **manual paste** path is always available — the feature still works. There is no per-counselor Google login; the office account is used.

---

### Objective 9 — Break-glass emergency access with audit

**What the objective asks:** In an emergency, authorized staff can see a student’s real identity, and the action is logged.

**Where you see it**

| Piece | Where |
|---|---|
| Emergency board | Web `/emergency` |
| Log access + reason | Same page |
| Head review | Web `/security` |
| Audit events | Web `/security/events` |

**Step-by-step**
1. A counselor opens **Emergency** and finds the student by **alias**.
2. They **log emergency access** with a justification. A **30-minute grant** opens.
3. The head sees the unreviewed entry in the **Security** console and marks it **reviewed**.
4. Only then can a counselor **reveal** the identity. The head can reveal without the review step because the head is the reviewer.
5. Every reveal writes its own audit row. The grant expires automatically.
6. The reveal is restricted to students on the counselor’s **caseload** (assigned appointments or referrals).

**Where it is saved:** `break_glass_logs`, `audit_logs`.

**Status: DONE.**
Caveats: there is no automatic alert to the head (they see it in the console), and the full expiry/review path is covered by unit/RLS tests but not a browser-driven end-to-end test.

---

### Objective 10 — Faculty referral feature

**What the objective asks:** Faculty can refer a student who needs counseling and track what happens.

**Where you see it**

| Piece | Where |
|---|---|
| Refer a student | Web `/refer-student` |
| Referral board | Web `/referrals` |
| Faculty dashboard/history | Web `/dashboard`, `/reports` |
| Official form / Excel | Referral modal and export |

**Step-by-step**
1. Faculty opens **Refer a student** and enters the **exact student number** (there is no browse-all directory, for privacy).
2. They add the concern, priority, and details, then submit. A referral is created and an entry is written to the referral trail.
3. The **head** sees it on **Referrals** and **assigns a counselor**.
4. The **counselor** reviews it and **confirms** — this **creates or links a real appointment** (`source_referral_id`), it does not duplicate the record.
5. The counselor can **resolve** (with notes/follow-up), **escalate** (urgent), or **reject**.
6. Every move leaves a row in the referral trail so the faculty member can follow the status without seeing clinical notes.
7. If the linked session is rescheduled, the trail records the move so faculty see it.

**Where it is saved:** `referrals`, `referral_actions`, `appointments.source_referral_id`.

**Status: DONE.**
Faculty use the **web only** — there is no faculty mobile app. Referral letters are handled inside the system; there is no external email delivery.

---

### Objective 11 — ISO/IEC 25010 evaluation

**What the objective asks:** Evaluate the system against software-quality characteristics.

**Where the evidence lives**

| Evidence | What it shows |
|---|---|
| `perf-tests/results/*.json` | Page load, booking, mutations, concurrency, realtime, query plans |
| 69 unit tests (Vitest) | PSS-10 integrity/scoring, booking gate, idempotency, slot races, Meet URL validation, RBAC, suppression |
| 8 RLS integration tests | Cross-student/cross-role isolation, note privacy, audit scope |
| 4 Playwright role specs | Student, counselor, faculty, head journeys |
| CI workflow | Typecheck, unit tests, web build, RLS, browser smoke |
| This status file + the technical report | Mapping of objectives to evidence |

**Step-by-step (what was measured)**
1. Page performance was timed against a staging dataset (roughly 135–240 ms p50 on normal staff pages, 0 layout shift on most).
2. Chat delivery was measured at 50/50 messages with **p50 ≈ 379 ms**, **p95 ≈ 495 ms**, 0 lost.
3. The slot-race test was re-run after the fix: **1 confirmed, 49 rejected**.
4. Role journeys were automated so a regression is visible in CI.

**Status: PARTLY.**
This is the one objective still short of full evidence. Missing: a **participant usability study** (SUS, task success, time-on-task), a **WCAG/accessibility audit**, and a **penetration test**. The protocol exists (`docs/usability-accessibility-protocol.md`) but no participants have been run.

---

## 7. Remaining gaps before the defense

| Gap | Objective affected | How serious | What to say / do |
|---|---|---|---|
| No participant usability study | 1, 11 | Medium | Run 5–10 non-technical users on 4 tasks; record success rate and time |
| No WCAG/screen-reader audit | 1, 11 | Medium | Do a keyboard + contrast pass; document findings |
| No penetration test | 3, 11 | Medium | Say “threat model + RLS tests, no external pentest yet” |
| Mood picker is not saved | 1 | Low | Either remove it or call it a “self-check moment,” not a screening |
| No student web portal | 1 | Low (scope) | State clearly: students = mobile, staff = web |
| Mobile README says confirmed reschedules are locked | 2 | Low (docs) | Code allows confirmed reschedules until 24 h — the README line is stale |
| Google Meet needs credentials | 8 | Low | Manual paste fallback is always available |
| Announcements ≠ events | 7 | Low (scope) | Point to `docs/objective-7-announcement-scope.md` |
| No email delivery | 5, 7 | Low (scope) | In-app digest/notifications only, by decision |
| Admin role is limited | 1 | Low (scope) | Head performs admin duties; `admin` is settings-only |

---

## 8. Ten-minute demo script

Use this order; each step touches a different objective.

1. **Mobile: register/login** (Objective 1) → Home loads real name and next session.
2. **Mobile: Book a session** with anonymous on (Objectives 2, 3) → answer PSS-10 → request is pending.
3. **Web head: Appointments** (Objective 2) → assign the counselor → point out the student notification.
4. **Web counselor: Confirm** (Objectives 2, 8) → pick a slot, create/paste Meet link.
5. **Mobile: Sessions** → show the confirmed session, counselor name, reschedule/cancel rules.
6. **Web counselor: Sessions calendar** (Objective 4) → complete the session, write a S.O.A.P. note.
7. **Web counselor: Students → record** (Objective 4) → show the timeline.
8. **Web head: Reports** (Objective 5) → switch cohort grouping, show quality panel and export.
9. **Web faculty: Refer a student** (Objective 10) → then head assigns → counselor confirms.
10. **Web head: Announcements** (Objective 7) → publish → show it on mobile Home.
11. **Web head: Security** (Objective 9) → show a logged access, review it, reveal.
12. **Mobile/Web chat** (Objective 6) → send a message both ways.
13. **CI page** (Objective 11) → show the green test run, then state the honest gaps.

---

## 9. Glossary for non-technical readers

| Term | Plain meaning |
|---|---|
| **Supabase** | The online database + login + file storage + live updates service the whole system uses |
| **Table** | A list of records, like a spreadsheet tab (e.g. all appointments) |
| **RLS (Row Level Security)** | Database rules that decide which rows a signed-in user may read or change |
| **RPC** | A saved database routine the app calls to get or change data safely |
| **Alias** | The code name a student appears under instead of their real name |
| **Break-glass** | Emergency access that unlocks identity for 30 minutes and is logged |
| **PSS-10** | A 10-item stress questionnaire |
| **S.O.A.P.** | A standard note format: Subjective, Objective, Assessment, Plan |
| **Waiver** | A recorded reason for skipping the pre-session check-in (walk-in, referral, paper form) |
| **Realtime** | Updates arriving without refreshing the page |
| **Migration** | A versioned database change file (`00068_...sql`) |
| **CI** | Automated checks that run after every code change |

---

## 10. How this status was checked

- Read the current web routes, mobile routes, shared services, RLS migrations (`00067`–`00074`), and CI workflow.
- Searched both apps for mock/demo/placeholder data — none found.
- Matched each objective to the screen that implements it and the table that stores it.
- Cross-checked against `Objective_Achievement_Report.md` and kept its honest verdicts.

**Limit of this document:** it is a **code-and-evidence review**, not a live end-to-end walkthrough on the deployed database. The behaviours described are what the current code enforces; the recorded CI and staging runs support them. If a panel asks “show me it is deployed,” run the demo script in §8 against staging.

---

### Bottom line

The web portal and the mobile app are **both functionally complete for their roles**, and **everything that represents real information is stored in one backend database**. Nine objectives are fully working. Objective 1 works but still needs proof from real users; Objective 11 is the only one that is genuinely still partial. The most important thing to do before the defense is not more code — it is **running the usability study and writing down the numbers**.
