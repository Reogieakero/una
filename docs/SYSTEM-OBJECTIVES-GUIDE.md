# System Objectives Guide

This document takes each of the eleven study objectives, names the screen that proves it, the service that enforces it, the table that stores it, and the test or migration that backs the claim. It is the bridge between the plain-language [OBJECTIVE_STATUS.md](../OBJECTIVE_STATUS.md) and the detailed audit in [Objective_Achievement_Report.md](../Objective_Achievement_Report.md).

**Audience:** thesis panel, adviser, demo presenter, and new developers.

**Rule for this document:** code and migrations win. Where the original objective wording promises more than the repository implements, the gap is stated in the objective's **Limit** row instead of being smoothed over.

---

## 1. Status legend

| Label | Meaning |
|---|---|
| **Implemented** | The end-to-end path exists, is wired to Supabase, and has supporting tests or constraints. |
| **Partial** | The core exists, but a stated promise is missing (scope narrowed, or evidence not collected). |
| **Proposed** | A design only; no code exists. |

There is no "Done" label here on purpose. "Done" invites the question "done against what wording?" The labels above force the wording to be explicit.

---

## 2. Status at a glance

| # | Objective (short) | Status | Why that status | Primary evidence |
|---:|---|---|---|---|
| 1 | User-friendly interface for students, counselors, head | **Partial** | Interface is built and role-aware; no participant usability study, SUS score, or WCAG audit has been run. | Mobile onboarding and tabs; web staff shell; `docs/usability-accessibility-protocol.md` (protocol only). |
| 2 | Book, reschedule, cancel, PSS-10 before session | **Implemented** | All transitions, the 7-day pre-session gate, audited waiver, and slot guard work. | `bookAppointment`, `mutations.ts`, migration `00068`, `no_counselor_overlap`. |
| 3 | Secure anonymous identity | **Implemented** | Alias-first staff views plus time-limited, reviewed, audited reveal. Mathematical anonymity is not claimed. | `00069_identity_rls_hardening.sql`, `break-glass-service.ts`, `docs/anonymity-threat-model.md`. |
| 4 | Counselor dashboard, records, notes | **Implemented** | Dashboard, appointment board, calendar, student timeline, and S.O.A.P./freeform notes are wired. | `apps/web/app/(staff)/dashboard`, `/sessions`, `/students/[id]`, `session_notes`. |
| 5 | Analytics, stress trends, reports | **Implemented** | Head-only aggregates, cohort views, quality panel, suppression, and Excel export exist. | `00061`, `00071` RPCs, `suppression.ts`, `lib/reports/`. |
| 6 | Real-time chat | **Implemented** | Student and staff threads persist and update through realtime; notifications fire on new messages. | `chat-service.ts`, `chat_threads`, `chat_messages`, realtime provider. |
| 7 | Announcement management | **Partial** | Publishing, targeting, drafts, images, and insights work. Events, venue, date range, RSVP, and attendance do **not** exist. | `announcements`, `docs/objective-7-announcement-scope.md`. |
| 8 | Google Meet link | **Implemented** | Server-side event creation plus validated manual paste fallback; link is stored and surfaced. | `/api/appointments/meet`, `meeting.ts`, migration `00072`. |
| 9 | Break-glass emergency access with audit | **Implemented** | Grant, caseload check, head review, reveal, expiry, and audit rows are all present. | `break-glass-service.ts`, `/api/staff/security/*`, `break_glass_logs`, `audit_logs`. |
| 10 | Faculty referral feature | **Implemented** | Faculty file referrals by exact student number; head assigns; counselor confirms into a real session, resolves, escalates, or rejects. | `referrals/mutations.ts`, `referral_actions`, `/refer-student`, `/referrals`. |
| 11 | ISO/IEC 25010 evaluation | **Partial** | Performance harness and automated tests exist; no usability study, accessibility audit, or penetration test. | `perf-tests/`, Vitest suites, RLS tests, Playwright, CI; [ISO-25010-EVALUATION.md](ISO-25010-EVALUATION.md). |

**Nine objectives are implemented, two are partial.** Objective 1 is partial only for evidence, not for software. Objective 7 is partial because its wording was narrowed from event management to announcement management. Objective 11 is partial because the evaluation instrument is not fully exercised.

---

## 3. Role capability matrix

Roles come from `packages/shared-types/src/database.ts` and `packages/shared-services/src/rbac.ts`. `guidance_personnel` exists as a type but is intentionally absent from the route and action policies in this revision, so it has no granted capability.

| Capability | Student | Counselor | Guidance head | Faculty | Admin | Guidance personnel |
|---|---|---|---|---|---|---|
| Sign in (web) | No (mobile only) | Yes | Yes | Yes | Yes | No policy entry |
| Sign in (mobile) | Yes | No | No | No | No | No |
| Book appointment | Yes | No | No | No | No | No |
| Submit PSS-10 / feedback | Yes | No | No | No | No | No |
| Assign or reject appointment | No | No | Yes | No | No | No |
| Confirm, complete, no-show | No | Yes | No (read oversight) | No | No | No |
| Reschedule | Yes (own) | Yes | No | No | No | No |
| Cancel | Yes (own) | No | No | No | No | No |
| Manage availability | No | Yes | Yes (route) | No | No | No |
| View appointment board | Own (mobile) | Yes | Yes | No | No | No |
| View student alias directory | No | Yes | Yes | No | No | No |
| Write session notes | No | Yes | Yes (action policy) | No | No | No |
| Create referral | No | No | Yes | Yes | No | No |
| Assign/reject referral | No | No | Yes | No | No | No |
| Confirm/resolve/escalate referral | No | Yes | No | No | No | No |
| Publish announcement | No | No | Yes | No | No | No |
| View office analytics | No | Own report | Yes | Own referrals | No | No |
| Break-glass access | No | Yes | Yes | No | No | No |
| Review break-glass | No | No | Yes | No | No | No |
| Manage users / backups | No | No | Yes | No | No | No |
| Reach `/settings` | No | Yes | Yes | Yes | Yes | No |

Notes:

- Route access and action access are different checks. For example, the head can reach `/availability` but `availability.manage` is granted only to `counselor` in `actionPolicy`.
- The student is **mobile-only**. `apps/web/app/(staff)/layout.tsx` rejects the student role; students are redirected away from the web shell.
- `admin` is a narrow account: it may enter the staff shell but only `/settings` is written to allow it, and the sidebar hides everything else. Head-only tools live under `app/(admin)` and require `guidance_head`.
- `rbac.ts` lists `/analytics`, `/resources`, and `/appointments/new`, but no page exists for those URLs. See [UI-SITEMAP.md](UI-SITEMAP.md); the entries are stale policy, not hidden features.

---

## 4. Objective-by-objective detail

Each objective uses the same six rows: **What the objective asks**, **Where it lives**, **How it works**, **Where it is saved**, **Status**, and **Limit or caveat**.

### Objective 1 — User-friendly interface for students, counselors, and the guidance head

| Row | Detail |
|---|---|
| **What the objective asks** | Provide a usable interface for the three primary audiences. |
| **Where it lives** | Student: mobile onboarding → login → `/(tabs)/home` → `/book` → `/check-in` → `/(tabs)/sessions` → `/chat` → `/(tabs)/profile`. Staff: web `/dashboard`, `/appointments`, `/sessions`, `/students`, `/chat`, `/reports`, `/about`. |
| **How it works** | One role-aware shell (`components/shared/staff-shell.tsx`, `staff-nav.tsx`) hides links a role cannot open. Mobile uses `theme.ts` tokens, large tap targets, plain-language errors, and empty/loading states. The `/about` page is a role-scoped staff handbook. |
| **Where it is saved** | Interface state only: onboarding flag on the device, local UI state. Content comes from Supabase. |
| **Status** | **Partial.** |
| **Limit or caveat** | No usability study with non-technical participants, no SUS score, task-success rate, or time-on-task. The protocol exists in `docs/usability-accessibility-protocol.md`; no sessions have been run. Also, the split is students = mobile, staff = web; there is no student web portal. |

### Objective 2 — Booking, rescheduling, cancellation, and PSS-10 before the session

| Row | Detail |
|---|---|
| **What the objective asks** | Students can book, reschedule, and cancel; a stress screening is administered before each session. |
| **Where it lives** | Mobile `/book` (concern, mode, slot, anonymous toggle) and `/check-in` (PSS-10). Web `/appointments` (head assigns; counselor confirms, reschedules, completes, marks no-show, records waivers). Mobile `/(tabs)/sessions` (cancel, reschedule, rate). |
| **How it works** | `bookAppointment` writes `pending` with an idempotency key. `submitPss10` writes the assessment. Head calls `assignAppointment`; counselor calls `confirmAppointment` inside `counselor_availability`. Completion runs the pre-session gate: a linked PSS-10 within seven days before the session, or an audited waiver of 10–500 characters. Reschedule preserves duration; the student may move a confirmed session until 24 hours before start. |
| **Where it is saved** | `appointments`, `pss10_assessments`, `counselor_availability`, `feedback`, `audit_logs`. |
| **Status** | **Implemented.** |
| **Limit or caveat** | The "one note per session" rule is app-enforced, not a database constraint. PSS-10 retakes are allowed since `00068`; readers take the latest row. Slot conflicts are race-proof only for `assigned`/`confirmed` windows, not for availability windows. |

### Objective 3 — Secure anonymous identity

| Row | Detail |
|---|---|
| **What the objective asks** | Protect student confidentiality during counseling. |
| **Where it lives** | Mobile booking anonymous toggle. Staff lists show aliases in `/appointments`, `/sessions`, `/students`, `/chat`, `/reports`, `/feedback`. Reveal happens on `/emergency`; review happens on `/security`. |
| **How it works** | `students.anonymous_alias` is the routine staff identifier. RLS in `00069` denies routine staff direct reads of student identity. Faculty referrals use an exact student-number lookup, not a browse-all directory. A counselor logs break-glass access with a justification; a 30-minute grant is created; the head reviews it; only then can the counselor reveal. The reveal is checked against caseload and expiry and writes an audit row. |
| **Where it is saved** | `students.anonymous_alias`, `appointments.is_anonymous`, `break_glass_logs`, `audit_logs`. |
| **Status** | **Implemented**, with a precise definition: pseudonymity plus audited re-identification. |
| **Limit or caveat** | This is **not** mathematical anonymity. The alias → identity mapping exists in the same database. Service-role code and database administrators can correlate records. There is no alias rotation and no alias history table. What is guaranteed is that a normal staff browser session cannot see identity without an audited, time-limited, reviewed action. |

### Objective 4 — Counselor dashboard, schedules, records, and notes

| Row | Detail |
|---|---|
| **What the objective asks** | Give a counselor one place for schedule, student records, and session documentation. |
| **Where it lives** | Web `/dashboard` (queue, today, pipeline), `/appointments` (full board), `/sessions` (month/week/day calendar), `/availability`, `/students` (alias directory), `/students/[id]` (case timeline), notes dialog on a completed session. |
| **How it works** | Board hooks (`use-*-board.ts`) paginate and patch incrementally. The student record RPC returns one timeline grouped by month: sessions, referrals, screenings, feedback, note markers, follow-ups. Note bodies are fetched on demand, not in the bulk timeline. `completeAppointment` gates completion; `session_notes` accepts freeform or S.O.A.P. columns. A documented follow-up mints or moves a confirmed follow-up appointment through `follow_up_of`. |
| **Where it is saved** | `appointments`, `session_notes`, `counselor_availability`, `follow_up_of`, `audit_logs`. |
| **Status** | **Implemented.** |
| **Limit or caveat** | The record is metadata-first, not a single free-text case narrative. Session notes are plain text at rest; there is no field-level encryption. Only the assigned counselor writes notes; heads may read for oversight. |

### Objective 5 — Analytics, stress trends, and reports

| Row | Detail |
|---|---|
| **What the objective asks** | Collect counseling data, identify student stress trends, and generate guidance-head reports. |
| **Where it lives** | Web `/reports` for head, counselor, and faculty. Sections: sessions, referrals, feedback, screenings, wellbeing trend, cohort stress, data quality. Filters: date range, cohort grouping (program / year level / college), section. Excel export and an in-app digest. |
| **How it works** | Head-only RPCs return aggregates: `head_appointment_daily_counts`, `head_referral_status_counts`, `head_wellbeing_trends`, `head_cohort_stress`, `head_data_quality`, `head_report_digest`. `analytics_daily_summary` backs the daily view. `MIN_CELL = 5` suppresses small cells before display and export. `report_digests` stores the generated digest. The counselor and faculty routes return scoped report payloads, not office-wide data. |
| **Where it is saved** | `analytics_daily_summary` (view), `report_digests`, and the underlying appointment, referral, PSS-10, and feedback rows. |
| **Status** | **Implemented.** |
| **Limit or caveat** | Predictive modelling is out of scope; the objective asks for trends, which longitudinal and cohort views provide. The digest is in-app only, not emailed. Aggregates are only as good as the data: unlinked screenings and missing notes are surfaced in the data-quality panel rather than hidden. |

### Objective 6 — Real-time chat

| Row | Detail |
|---|---|
| **What the objective asks** | Students and guidance staff can message in real time. |
| **Where it lives** | Student mobile `/chat` (inbox, conversation). Staff web `/chat` (threads, unread counts, notifications). |
| **How it works** | `messageableCounselors` limits the student inbox to counselors from that student's confirmed or completed sessions. `openThread` reuses the one thread per student–counselor pair; `sendMessage` persists and triggers a generic notification. Realtime subscriptions patch the thread and unread badges without a refresh. Opening a conversation clears unread chat notifications. |
| **Where it is saved** | `chat_threads`, `chat_messages`, `notifications`. |
| **Status** | **Implemented.** |
| **Limit or caveat** | No typing indicator or verified read receipt; no offline queue. Messages require a connection. Realtime payloads carry IDs and status only, never message bodies. |

### Objective 7 — Announcement management

| Row | Detail |
|---|---|
| **What the objective asks (as adjusted)** | Publish announcements and activities to the right audience. The original event-management wording is narrowed and recorded in `docs/objective-7-announcement-scope.md`. |
| **Where it lives** | Web `/announcements` (compose, draft, publish, unpublish, delete, insights). Mobile `/(tabs)/home` feed. Staff feed in the same web page for counselor and faculty audiences. |
| **How it works** | `announcements` stores title, body, audience role array, optional `event_date`, image URL, and `published_at`. Drafts have no `published_at` and are hidden from non-head staff. Publishing fans out notifications to the targeted roles. Images live in the public `announcement-images` bucket with head-only writes. Insights read engagement and reach. |
| **Where it is saved** | `announcements`, `notifications`, `storage.objects` (announcement images). |
| **Status** | **Partial** because the scope is narrower than the original objective: this is announcement management, not event management. |
| **Limit or caveat** | No event calendar, venue, date range, RSVP, capacity, or attendance tracking. `event_date` is a single optional date on a post. No email delivery. |

### Objective 8 — Google Meet link for online counseling

| Row | Detail |
|---|---|
| **What the objective asks** | Attach a Google Meet link to online counseling sessions. |
| **Where it lives** | Web confirm dialog on `/appointments` and referral confirmation. Join and remove actions on the appointment row and session detail. The student receives the link in the confirmation notification and session card. |
| **How it works** | `/api/appointments/meet` calls Google Calendar/Meet server-side when credentials are configured. The confirm dialog also accepts a pasted `meet.google.com` link. `packages/shared-services/src/appointments/meeting.ts` validates the URL and provider. The link is stored on the appointment. Reschedule moves the calendar event; rejection cleans it up. |
| **Where it is saved** | `appointments.meeting_url`, `meeting_provider`, `meeting_event_id`, `meeting_created_at` (migration `00072`). |
| **Status** | **Implemented.** |
| **Limit or caveat** | Automatic creation needs `GOOGLE_MEET_ENABLED` plus OAuth credentials and a refresh token. Without them, the manual paste path still works, so the feature degrades rather than breaks. There is no per-counselor Google login; the office account is used. The URL is stored in plain text. |

### Objective 9 — Break-glass emergency access with audit

| Row | Detail |
|---|---|
| **What the objective asks** | In an emergency, authorized staff can see a real identity, and the action is logged. |
| **Where it lives** | Web `/emergency` (log access, reveal), `/security` (head review), `/security/events` (audit trail). |
| **How it works** | `breakGlassAccess` validates a justification (minimum 20 characters) and inserts a `break_glass_logs` row with `expires_at = now() + 30 minutes`. The reveal route checks the active grant, head review, caseload (`isStudentOnCounselorCaseload`), and expiry. The head can reveal without a separate review because the head is the reviewer. A database trigger appends the audit record. |
| **Where it is saved** | `break_glass_logs`, `audit_logs`. |
| **Status** | **Implemented.** |
| **Limit or caveat** | There is no automatic alert pushed to the head; the head sees unreviewed entries in the console. The full expiry/review path is covered by unit and RLS tests, but not by a browser-driven end-to-end test. Realtime payloads must stay ID-only. |

### Objective 10 — Faculty referral feature

| Row | Detail |
|---|---|
| **What the objective asks** | Faculty can refer a student who needs counseling and track what happens. |
| **Where it lives** | Web `/refer-student` (exact student-number lookup, concern, priority, paper-form fields), `/referrals` (board), `/dashboard` and `/reports` (faculty history). |
| **How it works** | `createReferral` validates the input and writes a referral plus the first `referral_actions` row. `triageReferral` and `assignReferral` move it to a counselor. `confirmReferralWithSession` creates or links a real appointment through `source_referral_id` instead of duplicating the record. `rejectReferral` and escalation paths are also present. Faculty see status and trail but never clinical notes. |
| **Where it is saved** | `referrals`, `referral_actions`, `appointments.source_referral_id`. |
| **Status** | **Implemented.** |
| **Limit or caveat** | Faculty use the web only; there is no faculty mobile app. There is no external email delivery of referral letters. The paper form is digitized in the UI and export, not scanned. |

### Objective 11 — ISO/IEC 25010 evaluation

| Row | Detail |
|---|---|
| **What the objective asks** | Evaluate the system against software-quality characteristics. |
| **Where it lives** | `perf-tests/` (page load, booking, mutations, concurrency, realtime, query plans), `packages/shared-services/**/*.test.ts` (86 Vitest cases), `tests/rls/rls.test.ts` (14 RLS cases), `e2e/specs/` (4 Playwright role journeys), `.github/workflows/ci.yml`. |
| **How it works** | Performance scripts record JSON results. Unit tests cover PSS-10 integrity and scoring, booking gates, idempotency, slot races, Meet URL validation, RBAC, and suppression. RLS tests cover cross-student and cross-role isolation, note privacy, and audit scope. Playwright covers student, counselor, faculty, and head journeys. CI runs typecheck, unit tests, web build, RLS, and browser smoke. |
| **Where it is saved** | Test files, `perf-tests/results/*.json`, CI logs, and [ISO-25010-EVALUATION.md](ISO-25010-EVALUATION.md). |
| **Status** | **Partial.** |
| **Limit or caveat** | Missing a participant usability study (SUS, task success, time-on-task), a WCAG/screen-reader audit, and an external penetration test. The protocol exists; the participants have not been run. Performance numbers are staging measurements, not production SLAs. |

---

## 5. Traceability table

Every objective maps to a route, a service entry point, a schema object, and a verification artifact. Use this table when a reviewer asks "where is that?"

| # | Routes / screens | Service entry points | Tables / views / RPCs | Verification |
|---:|---|---|---|---|
| 1 | Mobile `/(tabs)/home`, `/book`, `/check-in`; web shell, `/about` | UI only; shared `rbac.ts` shapes navigation | `profiles`, `students` (read) | `docs/usability-accessibility-protocol.md`; no results yet |
| 2 | Mobile `/book`, `/check-in`, `/(tabs)/sessions`; web `/appointments`, `/sessions` | `bookAppointment`, `submitPss10`, `assignAppointment`, `confirmAppointment`, `completeAppointment`, `cancelAppointment`, `markAppointmentNoShow`, `rescheduleAppointment`, `submitFeedback` | `appointments`, `pss10_assessments`, `counselor_availability`, `feedback`; `no_counselor_overlap` | `booking-service.test.ts`, `mutations.test.ts`, `mutations-pss10.test.ts`, `pre-session-pss10.test.ts` |
| 3 | Mobile `/book`; web `/appointments`, `/sessions`, `/students`, `/chat`, `/reports`, `/emergency`, `/security` | `breakGlassAccess`, `isStudentOnCounselorCaseload`, reveal/review route handlers | `students.anonymous_alias`, `appointments.is_anonymous`, `break_glass_logs`, `audit_logs` | RLS tests; `docs/anonymity-threat-model.md`; `00069` |
| 4 | Web `/dashboard`, `/appointments`, `/sessions`, `/availability`, `/students`, `/students/[id]` | `listAppointmentPage`, `completeAppointment`, `syncFollowUpSession`, note routes | `appointments`, `session_notes`, `session_note_attachments`, `counselor_availability` | `mutations.test.ts`; session-note route tests; RLS note privacy |
| 5 | Web `/reports` | `getDailySummary`, `getStressOverview`, `suppressCohorts`; head RPCs | `analytics_daily_summary`, `report_digests`, `head_*` RPCs | `suppression.test.ts`; `00061`, `00071`; Excel builders |
| 6 | Mobile `/chat`; web `/chat` | `messageableCounselors`, `listThreads`, `openThread`, `sendMessage`, `listStaffMessages` | `chat_threads`, `chat_messages`, `staff_messages`, `notifications` | `chat-service` tests; realtime provider; RLS |
| 7 | Web `/announcements`; mobile `/(tabs)/home` | announcement page actions; notification service | `announcements`, `notifications`, `announcement-images` bucket | migration `00025`; `00044` tone; `docs/objective-7-announcement-scope.md` |
| 8 | Web `/appointments`, session detail, referral confirm | `meeting.ts`, `/api/appointments/meet` | `appointments.meeting_url`, `meeting_provider`, `meeting_event_id` | `meeting.test.ts`; `00072`; `docs/google-meet-integration.md` |
| 9 | Web `/emergency`, `/security`, `/security/events` | `breakGlassAccess`, `isStudentOnCounselorCaseload`, `reviewBreakGlass` | `break_glass_logs`, `audit_logs` | RLS tests; `00027`, `00069`; break-glass service tests |
| 10 | Web `/refer-student`, `/referrals`, `/dashboard`, `/reports` | `createReferral`, `triageReferral`, `assignReferral`, `confirmReferralWithSession`, `rejectReferral`, `escalateStaleUrgent` | `referrals`, `referral_actions`, `appointments.source_referral_id` | `referrals/mutations` tests; `00039`, `00040`; Playwright faculty journey |
| 11 | CI, performance harness, test suites | N/A | N/A | `perf-tests/results/*.json`, 86 Vitest cases, 14 RLS tests, 4 Playwright specs, `ci.yml` |

### Migration anchors

| Migration | What it establishes | Objective |
|---|---|---|
| `00008_pss10_assessments.sql` | PSS-10 row shape, score and band checks | 2 |
| `00009_session_notes.sql` | Counselor-private notes and RLS | 4 |
| `00019_analytics_daily_summary.sql` | Analytics view | 5 |
| `00021` + `00046` | Idempotency key and notification dedupe | 2, 6 |
| `00025_announcement_images.sql` | Public read, head-only write image bucket | 7 |
| `00027` + `00069` | Break-glass log and identity RLS hardening | 3, 9 |
| `00029_appointments_assigned_rejected.sql` | Appointment status check | 2 |
| `00033_referral_assigned_confirmed_rejected.sql` | Referral status check | 10 |
| `00039` + `00040` | Concern type and paper-form fields | 10 |
| `00045` | Audit event triggers | 3, 4, 9 |
| `00059` + `00067` | Slot exclusion constraint and `ends_at` trigger | 2 |
| `00061` + `00071` | Report RPCs, trends, cohort stress, quality, digest | 5 |
| `00068_pre_session_pss10.sql` | Pre-session gate, retakes, waiver constraint | 2 |
| `00034` + `00072_appointment_meeting_provider.sql` | Meeting URL and provider columns | 8 |
| `00074_counselor_directory_role.sql` | Chat contact directory excludes non-participants | 6 |

---

## 6. Ten-minute demo script

Run this against staging, not production data. Each step deliberately touches a different objective so one failure does not collapse the whole demo.

| Minute | Do this | Shows objective | Say this while it loads |
|---:|---|---|---|
| 0:00 | Open mobile app, sign in as a student. | 1 | "Students are mobile-only; staff use the web portal." |
| 0:45 | Open **Book a session**, turn on **Anonymous**, pick a slot, answer PSS-10. | 2, 3 | "The alias is what staff will see; the identity is not in routine reads." |
| 2:00 | On web, sign in as head, open **Appointments**, assign the pending request. | 2 | "Assignment is a head action; the student and counselor are notified." |
| 2:45 | Sign in as the counselor, **Confirm** the session, create or paste a Meet link. | 2, 8 | "Online confirmation requires a real meet.google.com URL." |
| 3:45 | Return to mobile **Sessions** tab. | 2 | "The student sees the counselor, time, and join link; reschedule is allowed until 24 hours before." |
| 4:30 | Web **Sessions** calendar → **Complete** → write a S.O.A.P. note. | 2, 4 | "Completion is gated by a fresh check-in or an audited operational waiver." |
| 5:30 | Web **Students** → open the alias → show the timeline. | 4 | "The record is metadata-first; note bodies open on demand." |
| 6:15 | Web **Reports** → switch cohort grouping → show data quality → export. | 5 | "Small cells under five are suppressed before display and export." |
| 7:15 | Web **Refer a student** as faculty → head assigns → counselor confirms. | 10 | "Confirmation mints a real session through source_referral_id; it does not duplicate the referral." |
| 8:15 | Web **Announcements** → publish to students → show it on mobile Home. | 7 | "This is announcement management; there is no RSVP or event calendar." |
| 9:00 | Web **Security** → show a logged break-glass access → review → reveal. | 3, 9 | "Alias by default; identity only through logged break-glass." |
| 9:40 | Send a chat message both ways. | 6 | "Realtime patches the thread; the payload carries IDs, not message text." |
| 10:00 | Show the green CI run. | 11 | "Automated tests and a performance harness exist; usability and penetration testing do not." |

**If the demo runs short:** skip step 10 (referral) and step 12 (chat). **If it runs long:** stop after step 9 and show the CI screenshot.

**Do not demo:** a student logging in on the web, an event RSVP flow, a mood-history chart, or an emailed digest. None exist.

---

## 7. ISO/IEC 25010 mapping

This is a preview. The full evaluation method and evidence slots are in [ISO-25010-EVALUATION.md](ISO-25010-EVALUATION.md).

| ISO characteristic | Where DCAS addresses it | Evidence state |
|---|---|---|
| Functional suitability | Objective coverage, guarded state transitions, RLS | Implemented; unit and RLS tests |
| Performance efficiency | Board pagination, indexes, perf harness, realtime instead of polling | Measured on staging; not a production SLA |
| Compatibility | One Supabase backend, web + Expo clients, shared Zod contracts | Implemented by construction |
| Usability | Role-aware shell, plain language, empty/loading states | Designed for; **not measured** with participants |
| Reliability | Idempotent booking, slot exclusion, dedupe keys, guarded updates | Implemented; race test exists |
| Security | RLS, break-glass, audit, RBAC, service-role isolation | Implemented; no external penetration test |
| Maintainability | Shared services, single RBAC source, typed rows, migrations | Implemented; some stale docs and a Prisma mirror gap |
| Portability | Vercel web, Expo/EAS mobile, Supabase backend | Implemented; environment-specific config |

---

## 8. Contradictions and stale claims to avoid

These are the places where an older document or comment disagrees with the code. Use the right-hand column in the defense.

| Claim you may hear | What the code says | Correct statement |
|---|---|---|
| "Session notes are encrypted at rest by the app layer." | The Prisma comment says so, but no encryption code exists. | Notes are plain text at rest; only platform disk encryption applies. |
| "The system provides anonymous counseling." | Alias-first with audited reveal. | Pseudonymity plus audited re-identification, not mathematical anonymity. |
| "There is event management with RSVP." | `announcements` has an optional `event_date` only. | Announcement management; no RSVP or attendance. |
| "Students can use the web portal." | The staff layout rejects students. | Students are mobile-only by design. |
| "The README says confirmed reschedules are locked." | Code allows confirmed reschedules until 24 hours before start. | The README line is stale; the 24-hour rule is current. |
| "There is no test runner." | 86 Vitest cases, 14 RLS tests, 4 Playwright specs, and CI exist. | AGENTS.md's early note is stale; the test setup is current. |
| "Faculty referrals send email." | Referral records and actions are in-app only. | No external email delivery. |
| "The admin role can run the office." | `admin` reaches `/settings`; head-only tools require `guidance_head`. | Head performs office administration; `admin` is narrow. |

**Why keep this section:** a panel that finds one overclaim will doubt the rest. Naming the gaps before they are found is the point of an evidence-based report.

---

## 9. How to verify this document

1. Open `packages/shared-services/src/rbac.ts` and compare the role matrix in §3.
2. Open `supabase/migrations/` and confirm each migration anchor in §5 exists.
3. Run `pnpm --filter @dorsu/shared-services test` and count the suites.
4. Run `pnpm --filter @dorsu/rls-tests test:rls` against a test project.
5. Open `apps/web/app/(staff)` and `apps/mobile/app` and confirm every route named in §5 exists.
6. Re-check the contradictions in §8 against the files they cite.

If a row in this document cannot be reproduced from those steps, the document is wrong and should be corrected before the defense.
