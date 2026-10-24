# Objective Achievement and ISO/IEC 25010 Evaluation Report

**Project:** Digital Counseling and Appointment System with Analytics (DOrSU Guidance / “Chekie”)
**Repository assessed:** `C:\Users\Akiro\OneDrive\Desktop\Chekie\una`
**Report date:** 23 October 2026
**Assessment type:** Code-and-artifact review (web, mobile, shared services, database migrations, performance results)
**Prepared for:** Capstone objective verification and software-quality evaluation

---

## 1. Executive Summary

### 1.1 Purpose

This report answers one question honestly:

> **For each of the 11 specific objectives of the study, is the requirement actually implemented in the system — and where?**

The report separates three things that are often confused:

1. **Implemented and usable** — the feature exists in the running product and is wired to real data.
2. **Implemented with a material gap** — the core feature exists, but a stated part of the objective is missing, mocked, manual, or unverified.
3. **Not implemented / not demonstrated** — the requirement is absent, or only described in documentation.

### 1.2 Headline verdict

| Verdict | Count | Objectives |
|---|---:|---|
| **Fully achieved** | 3 | 6 (real-time chat), 9 (break-glass), 10 (faculty referrals) |
| **Substantially achieved** | 5 | 1 (interfaces), 2 (scheduling + PSS-10), 3 (anonymity), 4 (counselor dashboard), 5 (analytics) |
| **Partially achieved** | 3 | 7 (events), 8 (Google Meet), 11 (ISO/IEC 25010 evaluation) |
| **Not achieved** | 0 | — |

“Substantially achieved” is deliberate. The core requirement works, but at least one stated word in the objective is not fully satisfied — for example, “prior to **each** session,” “**secure** anonymous,” or “**user-friendly** for non-technical users.”

### 1.3 Most important findings

**Strengths**

- The system is not a prototype shell. It has a complete appointment lifecycle, role-based access control, PSS-10 gating, anonymous aliases, audit logs, break-glass access, referrals, real-time chat, announcements, feedback, reports, and backups.
- Domain rules live in shared services (`packages/shared-services`) and are enforced again in the database through RLS and guarded writes — not only in the UI.
- Normal web page loads are fast: roughly **135–240 ms** p50 TTFB and LCP, with **0 CLS** on most staff pages.
- Real-time chat delivered **50/50** messages in the measured run, with **p50 ≈ 379 ms**, **p95 ≈ 495 ms**, and **0 lost messages**.

**Honest weaknesses**

- The performance artifacts contain a **failed same-slot concurrency test**: 50 concurrent confirmations of overlapping appointments produced **50 confirmed rows** where exactly 1 was expected (`perf-tests/results/concurrency.json`, E1 `pass: false`). The code contains an exclusion constraint intended to prevent this (`00059_phase1_perf_indexes_slotguard.sql`), but the constraint is wrapped in a `DO … EXCEPTION` block that silently skips creation if overlapping rows already exist. This must be verified in the deployed database. **This is the single highest-risk finding in the review.** **Fixed and re-measured on staging on 24 October 2026 — see §1.5.**
- The same artifacts show the analytics RPCs `head_appointment_daily_counts` and `head_referral_status_counts` as **missing** in the measured environment (`perf-tests/results/explain.json`), even though they exist in migration `00061_phase3b_report_rpcs.sql`. This is migration drift, not necessarily a code defect — but it means reports may silently degrade if deployment is not verified. **Resolved on staging on 24 October 2026 — see §1.5.**
- ~~The mobile app still uses local mock data for the profile identity card and the PSS-10 question wording/labels.~~ **Closed in P1 — see §1.6.** The profile card reads `profiles` + `students`, and PSS-10 wording/labels come from `packages/shared-services/src/assessments/pss10-instrument.ts`; `apps/mobile/data/mock.ts` was removed.
- Objective 7 was originally worded as “event management.” It is now explicitly **announcement management**: targeted news posts with drafts, images, realtime delivery, and insights. There is no event calendar, venue, date range, RSVP, or attendance tracking; that boundary is recorded in `docs/objective-7-announcement-scope.md`.
- Google Meet is a **manually pasted URL field with validation**, not a Google Calendar/Meet API integration.
- ~~There is no unit-test runner, no automated end-to-end suite, and no formal usability study with non-technical users.~~ **Partly closed in P1 — see §1.6.** Unit tests (41), RLS integration tests (8), and four Playwright role specs now run in CI. The formal usability/accessibility study still has no participants, so Objective 11 remains only partially demonstrated by evidence.

### 1.4 Bottom line

The system **does achieve the functional intent of most objectives**. It is strongest in scheduling, privacy controls, referrals, real-time communication, and announcement management. It is weakest in formal quality evaluation: concurrency and analytics migration drift were verified and fixed on staging, and P1 added an automated test foundation, but the participant-based usability/accessibility study is still outstanding.

For a capstone defense, the honest claim is:

> “Nine of eleven objectives are implemented in software to a substantial degree. Two are partially evidenced: Google Meet is a validated manual link rather than an API integration, and the ISO/IEC 25010 evaluation is supported by performance measurements and a new automated test foundation, but not yet by a participant-based usability/accessibility study.”

### 1.5 Post-review P0 remediation — 24 October 2026

This section records work done **after** the original review. The findings above are preserved as the state at review time; they are not retracted.

**Both P0 findings were real, and both are now fixed and re-measured on staging.**

Root cause of the slot-guard failure was worse than “seed rows exist”:

- `00059_phase1_perf_indexes_slotguard.sql` used `tstzrange(scheduled_at, coalesce(ends_at, scheduled_at + interval '1 hour'))` in an exclusion constraint.
- `timestamptz + interval` is **STABLE, not IMMUTABLE** (it depends on the session TimeZone), so PostgreSQL rejects that expression in an index/constraint. The `DO … EXCEPTION` block hid the error.
- Therefore the guard could not be created **even on a clean database**, and `00059`/`00061` were also missing from the measured database.

Remediation applied in order: `00059`, `00061`, then new `00067_fix_slot_overlap_guard.sql`.

`00067` does four things:

1. Backfills `ends_at` for all rows that lacked it (136 rows) and installs a `BEFORE INSERT/UPDATE` trigger so it stays filled. The constraint can then index the immutable `tstzrange(scheduled_at, ends_at)`.
2. Resolves connected overlap groups per counselor: keep earliest `confirmed`, else earliest `assigned`; cancel the rest and write one `audit_logs` row per cancellation. On staging this cancelled **21** duplicate active rows (27 pending rows untouched).
3. Fails loudly if any overlap remains — it does not repeat `00059`’s silent skip.
4. Adds the constraint and verifies `convalidated = true`.

**Dated verification evidence (staging `xueqvjozlyayggsyfzsq`):**

| Check | Result |
|---|---|
| `perf-tests/concurrency-slots.mjs` E1 (50 confirms racing into one slot) | `success: 1`, `fail: 49`, all 49 rejected with `23P01`, `confirmed: 1`, `pass: true` |
| Same run, E2 (50 distinct-slot inserts) | `50/50`, `pass: true` |
| `perf-tests/check-schema.mjs` | all required objects present; `SCHEMA OK` |
| `perf-tests/check-rpc.mjs` | both report RPCs return `OK` |
| `no_counselor_overlap` | present and validated |
| Overlap pairs remaining | `0` |
| Web typecheck | passed |
| Web production build | passed (47 routes generated) |
| Web lint | **not available** — `next lint` opens the interactive ESLint setup because the repo has no ESLint config; this is pre-existing and not a P0 regression |

The stale review artifact was replaced by `perf-tests/results/concurrency.json` (`at: 2026-10-23T16:07:55Z`, E1/E2 both `pass: true`), and `perf-tests/check-schema.mjs` was added as a cheap regression gate.

**What this does not prove:** the fix was validated against the approved **staging** database, not production. No browser-driven E2E or live role smoke test was added in P0. The report’s broader conclusions about analytics depth, mobile mock data, announcement scope, and formal usability testing were unchanged **at that point**; P1 work is recorded in §1.6.

### 1.6 Post-review P1 evidence — 24 October 2026

This section records the P1 work completed after the review. The findings in §4–§7 are preserved as the review-time state; the notes below say which of them are now closed and which remain open.

**Closed or materially reduced**

| Gap at review time | P1 work | Verification |
|---|---|---|
| No unit-test runner | Vitest in `@dorsu/shared-services`; 41 tests for PSS-10 integrity/scoring, freshness, booking gate/idempotency/`23P01`, Meet URL validation, RBAC | `pnpm test` → 41 passed; CI `verify` job |
| No RLS regression tests | `tests/rls` with 8 cases: cross-student appointment/PSS/profile isolation, cross-role insert denial, counselor-note isolation with head oversight, self-promotion blocking, audit read scope/append-only, content-free notification fan-out | CI `rls` job, green run **#39990715576** |
| No browser-driven role smoke test | `e2e/` Playwright, 4 specs (student route boundary, counselor Complete → note save, faculty referral history/form, head referral board + populated report sections) | CI `e2e` job, green run **#39994834656** (4/4 specs) |
| Mobile PSS-10 wording was local mock text | Canonical instrument in `packages/shared-services/src/assessments/pss10-instrument.ts`; mobile check-in and scoring import it; `apps/mobile/data/mock.ts` removed | Unit-test instrument-integrity cases; mobile typecheck |
| Objective 7 was described as events | Renamed to **announcement management**; calendar/RSVP/attendance documented as out of scope | `docs/objective-7-announcement-scope.md` |
| “No automated test for note authorization” | Counselor-note isolation covered in the RLS suite; note save exercised in Playwright | Run **#39990715576**, **#39994834656** |

**Still open**

- P1.6 usability/accessibility study: protocol and participant plan exist, but **no participants have been run**. There is no SUS score, task-success rate, time-on-task, or WCAG audit result yet. Objective 11 therefore remains partially achieved.
- PSS-10 licensing/permission is recorded in `docs/pss10-license-note.md` but is **not verified** in writing.
- No penetration test, SAST/DAST, or production deployment verification.
- Staging guard secrets are not configured, so the scheduled staging job has not run in CI.

**How to reproduce locally**

```bash
# Unit tests (no external services)
pnpm install
pnpm test

# Typecheck/build
pnpm --filter @dorsu/web typecheck
pnpm --filter @dorsu/mobile typecheck
pnpm --filter @dorsu/web build

# RLS suite — needs a local Supabase stack and the three TEST_SUPABASE_* vars
pnpm --filter @dorsu/rls-tests test:rls

# Playwright role smoke — needs local Supabase vars plus a built web app
pnpm e2e
```

CI runs the same suites against a pinned Supabase CLI (`2.122.0`); the e2e job uploads `e2e/playwright-report/` and `e2e/test-results/` (traces/screenshots) on every run.

---


## 2. Scope, Method, and Evidence Rules

### 2.1 What was reviewed

| Layer | Locations reviewed |
|---|---|
| Web application | `apps/web/app/**` (public, staff, admin, API routes) |
| Mobile application | `apps/mobile/app/**`, `apps/mobile/README.md` |
| Shared domain logic | `packages/shared-services/src/**` (appointments, referrals, chat, security, analytics, RBAC, notifications) |
| Database | `supabase/migrations/**` (schema, RLS, triggers, RPCs, constraints) |
| Performance evidence | `perf-tests/results/*.json` (pages, throttled pages, booking, mutations, concurrency, realtime, explain plans) |
| Automated tests (P1) | `packages/shared-services/src/**/*.test.ts` (Vitest), `tests/rls/rls.test.ts`, `e2e/specs/*.spec.ts`, `.github/workflows/ci.yml` |
| Product documentation | `AGENTS.md`, `apps/mobile/README.md`, `docs/realtime-audit.md`, `docs/BACKUP_RESTORE.md` |

### 2.2 Evidence hierarchy

When sources disagreed, this report trusted them in this order:

1. **Database migrations and shared-service code** — the actual rules.
2. **Route handlers and page components** — what the user can reach and do.
3. **Measured performance artifacts** — what was observed in the test environment.
4. **README / documentation** — treated as a claim, not proof.

### 2.3 Important limits of this review

- No live end-to-end walkthrough was performed for this report. Findings are based on source inspection and existing measurement artifacts.
- Performance numbers come from a single measurement run dated **2026-10-11** against a test/staging dataset. They are indicative, not a production SLA.
- No real student records, session notes, PSS-10 answers, or chat content were read.
- “User-friendly” is assessed from interface structure, microcopy, touch target sizes, empty states, and flow complexity — **not** from a moderated usability test. This distinction matters in Objective 1 and Objective 11.
- A feature existing in code does not prove it is deployed. Two artifacts in this review show exactly that gap (E1 concurrency and missing analytics RPCs).

### 2.4 Verdict scale

| Verdict | Meaning |
|---|---|
| **Fully achieved** | Every material part of the objective is implemented and wired to real data, with no known material gap. |
| **Substantially achieved** | Core requirement works end-to-end, but a stated element is incomplete, mocked, manual, or unverified. |
| **Partially achieved** | A meaningful part exists, but a central promise of the objective is missing. |
| **Not achieved** | No meaningful implementation, or only documentation. |

---

## 3. Objective-by-Objective Summary

| # | Objective (short form) | Verdict | Strongest evidence | Main gap |
|---:|---|---|---|---|
| 1 | User-friendly mobile and web interface | Substantially achieved | `apps/web/app/**`, `apps/mobile/app/**`, design tokens, onboarding, role-specific navigation; P1 removed mobile mock data | No participant-based usability test with non-technical users yet |
| 2 | Book / reschedule / cancel + PSS-10 before session | Substantially achieved | `apps/mobile/app/book.tsx`, `check-in.tsx`, `booking-service.ts`, `00008`, `00059`, `00067` | PSS-10 gate is 30-day freshness at booking, not literally before every session; E1 concurrency fixed 2026-10-24 (1 confirmed / 49 rejected) |
| 3 | Secure anonymous identity | Substantially achieved | Alias system, `is_anonymous`, RLS, reveal API, audit logs | Pseudonymity, not cryptographic anonymity; staff with database access can correlate IDs |
| 4 | Counselor dashboard for schedules, records, notes | Substantially achieved | `/dashboard`, `/appointments`, `/sessions`, `/students`, `/availability`, session-note API | No dedicated “student record” timeline; notes are per completed session |
| 5 | Analytics module: collect data, stress trends, reports | Substantially achieved | `/reports`, `head-reports-view.tsx`, `analytics-queries.ts`, `00019`, `00061` | Aggregate reporting, not predictive analytics; report RPC drift resolved 2026-10-24; no scheduled report delivery |
| 6 | Real-time chat | Fully achieved | `/chat` (web + mobile), Supabase Realtime, `realtime.json` | No typing indicators/read receipts verified; no offline queue |
| 7 | Announcement management for publishing announcements/activities | Fully achieved (renamed scope) | `/announcements`, drafts, audience targeting, images, insights, mobile home feed | Event calendar, date/venue, RSVP, attendance are explicitly out of scope (`docs/objective-7-announcement-scope.md`) |
| 8 | Embedded Google Meet link | Partially achieved | `meeting_url` column, `isMeetUrl()` validation, online-confirm gate | Manual URL paste; no Google Calendar/Meet API or automatic link creation |
| 9 | Break-glass emergency access with audit | Fully achieved | `/emergency`, `break-glass-service.ts`, `/api/staff/security/*`, `00017`, `00018`; caseload unit tests + audit RLS tests | No automated alerting to the head; full expiry/review flow not browser-tested |
| 10 | Faculty referral feature | Fully achieved | `/refer-student`, `/referrals`, `referrals/mutations.ts`, `referral_actions` | No mobile faculty app (web only); no external referral letter delivery |
| 11 | ISO/IEC 25010 evaluation | Partially achieved | Performance harness and results; this report | No formal usability study, accessibility audit, security test, or complete ISO 25010 instrument |

---

## 4. Detailed Objective Assessment

### Objective 1 — Develop a user-friendly mobile and web interface for students, counselors, and the guidance head

**Verdict: Substantially achieved.**

#### Where it is implemented

| Surface | Route / file | What it provides |
|---|---|---|
| Public web | `apps/web/app/(public)/login/page.tsx`, `register/page.tsx`, `reset-password/page.tsx`, `update-password/page.tsx` | Sign-in, self-registration, password recovery |
| Public landing | `apps/web/app/page.tsx` | Branded entry point and journey |
| Staff web shell | `apps/web/app/(staff)/layout.tsx`, `apps/web/components/shared/staff-nav.tsx` | Role-filtered navigation and consistent shell |
| Student mobile | `apps/mobile/app/index.tsx` | Three-page onboarding carousel with mascot |
| Student mobile auth | `apps/mobile/app/login.tsx`, `register.tsx` | Supabase email/password auth and student registration |
| Student mobile tabs | `apps/mobile/app/(tabs)/home.tsx`, `sessions.tsx`, `profile.tsx` | Home, sessions, profile |
| Student mobile flows | `apps/mobile/app/book.tsx`, `check-in.tsx`, `chat.tsx`, `notifications.tsx` | Booking, PSS-10 check-in, chat, notifications |
| In-app help | `apps/web/app/(staff)/about/page.tsx` | Role-scoped handbook: pipeline, daily checklist, page-by-page reference, rules |
| Design system | `packages/ui-tokens/src/**`, `apps/mobile/theme.ts` | Shared palette, typography, spacing, radii, hit targets |
| Loading/empty states | Per-route `loading.tsx` skeletons; empty states in boards and reports | Perceived performance and guidance |

#### What works

- Both platforms exist and are role-aware. Students use the Expo app; counselors, faculty, and the guidance head use the web portal; the head also gets admin tools.
- The interface uses plain-language labels (“Book a session,” “How are you feeling today?”), large touch targets on mobile (44 px inputs, 32 px buttons with hit slop), and sentence-case error messages.
- Navigation is role-filtered in one place (`packages/shared-services/src/rbac.ts`), so users do not see links they cannot use.
- The `/about` handbook is a strong non-technical support feature: it explains the pipeline, what each page shows, what a role may do, and where work goes next.
- The design is consistent across web and mobile through shared color/typography tokens.

#### Gaps and honest caveats

1. ~~**Mobile profile is not fully real.**~~ **Closed in P1 (§1.6).** The profile card now reads `profiles` + `students`, with private-bucket avatar upload; `apps/mobile/README.md` no longer lists an identity-card mock.
2. ~~**PSS-10 question wording/labels are mocked on mobile.**~~ **Closed in P1 (§1.6).** The canonical instrument lives in `packages/shared-services/src/assessments/pss10-instrument.ts`; mobile check-in and scoring import it, and the unit suite asserts instrument integrity. Licensing/permission remains unverified — see `docs/pss10-license-note.md`.
3. **No formal usability test with non-technical users.** The interface *looks* approachable, but there is no SUS score, task-success rate, time-on-task, or error-rate evidence. “User-friendly” is therefore an informed design judgment, not a measured result.
4. **Accessibility is not verified.** There is no WCAG audit, no screen-reader test, and no documented keyboard/focus review. Color contrast and reduced-motion behavior are not evidenced.
5. **Web bundle weight on login is high** — about **1.13 MB JS** in the normal run (`perf-tests/results/pages.json`), which is heavy for low-end devices and slow connections.

#### Non-technical user lens

A first-time student can plausibly complete onboarding → login → book → check-in without training, because the flow is linear and the mobile copy is friendly. A counselor can learn the pipeline from `/about`. The main risk is not visual complexity; it is **trust**: mock profile data and non-validated PSS-10 wording can make the product feel less real than it is.

---

### Objective 2 — Develop an online appointment scheduling feature that enables students to book, reschedule, and cancel counseling sessions, and administer PSS-10 stress assessments prior to each session

**Verdict: Substantially achieved.**

#### Where it is implemented

| Capability | Evidence |
|---|---|
| Booking step 1 (concern, mode, day, time, anonymous toggle) | `apps/mobile/app/book.tsx` |
| Booking step 2 (PSS-10 + appointment creation) | `apps/mobile/app/check-in.tsx` |
| PSS-10 scoring and persistence | `packages/shared-services/src/appointments/booking-service.ts`; migration `00008_pss10_assessments.sql` |
| Server-side PSS-10 freshness gate | `booking-service.ts`, lines 29–35 and 69–90 (30-day window, 5-minute clock-skew tolerance) |
| Slot validation | `booking-service.ts`, lines 91–99; `validateCounselorSchedule()` in `appointments/mutations.ts` |
| Idempotent booking and race handling | `booking-service.ts`, lines 48–53, 117–134 (unique idempotency key; `23P01` mapped to “That time was just taken”) |
| Appointment lifecycle | `pending → assigned → confirmed → completed`, plus `cancelled`, `rejected`, `no_show` |
| Student cancel / reschedule | `apps/mobile/app/(tabs)/sessions.tsx`; `components/SessionDetailsModal.tsx`, `RescheduleModal.tsx` |
| Staff assignment / confirmation | `apps/web/app/(staff)/appointments/page.tsx`; `appointments/mutations.ts` |
| Availability windows | `apps/web/app/(staff)/availability/page.tsx`; `counselor_availability` table |
| Slot-race backstop | `supabase/migrations/00059_phase1_perf_indexes_slotguard.sql` |

#### What works

- The flow is genuinely end-to-end: the student picks a concern and mode, sees real counselor availability, answers PSS-10, and the appointment lands as **pending** for the head to assign.
- The PSS-10 gate is enforced **inside `bookAppointment()`**, not only in the UI. A caller cannot skip the assessment by calling the service directly. This is the correct architecture.
- Expired or missing assessments produce friendly, actionable errors (“Complete a PSS-10 check-in before booking,” “PSS-10 expired — please retake the check-in before booking”).
- Booking is idempotent, so a retry after a network timeout does not create a duplicate appointment.
- The lifecycle is role-separated and guarded: the head assigns/rejects, the counselor confirms/completes/no-shows, the student cancels/reschedules where allowed.
- Normal booking service time is about **1.18 s** unassigned and **1.46 s** assigned (p50), which is acceptable for a multi-step mobile flow.

#### Gaps and honest caveats

1. **“Prior to each session” is stronger than what is implemented.** The gate requires a PSS-10 within **30 days before booking**. It does not require a fresh assessment before every session, and it does not re-check at session time. That is a reasonable product decision, but it is not literal compliance with the objective.
2. ~~**The concurrency test failed.**~~ **Fixed and re-measured on staging 2026-10-24 — see §1.5.** The review-time run reported 50 concurrent confirmations all succeeding; migration `00067` replaced the silent `DO … EXCEPTION` guard, cleaned duplicate active rows, and installed a validated `no_counselor_overlap` constraint. The re-run gives **1 confirmation and 49 × `23P01`**.
3. **Reschedule is restricted for confirmed sessions.** Mobile allows reschedule only for `pending`/`assigned`; once a session is confirmed, the student must go through the Guidance Office (`apps/mobile/README.md`, line 75). That is defensible operationally, but the objective says students can reschedule — this is a partial restriction.
4. ~~**No automated booking tests.**~~ **Closed in P1 (§1.6).** The Vitest suite covers PSS-10 freshness, the booking gate, idempotency, and `23P01` mapping; RLS tests cover cross-student isolation.

#### Non-technical user lens

The two-step mobile flow is understandable: choose a concern → choose how/when → answer a short check-in → done. The main usability risk is the **PSS-10**: ten items with numeric frequency scales can feel clinical. If the labels are not the validated wording, non-technical students may misinterpret them. The 30-day rule also needs a plain explanation (“Your last check-in is over 30 days old — please answer again”) rather than a technical error.

---

### Objective 3 — Implement a secure anonymous identity system that protects student confidentiality during counseling sessions

**Verdict: Substantially achieved.**

#### Where it is implemented

| Control | Evidence |
|---|---|
| Student aliases and profile bootstrap | `apps/mobile/lib/supabase/ensureStudent.ts` (idempotent profile/student creation, alias collision retry) |
| Anonymous booking flag | `createAppointmentSchema`; `appointments.is_anonymous`; `booking-service.ts`, lines 101–113 |
| Role-scoped access | `packages/shared-services/src/rbac.ts`; RLS policies in `supabase/migrations/**` |
| Identity reveal endpoint | `apps/web/app/api/staff/security/reveal/route.ts` |
| Break-glass logs | `supabase/migrations/00017_break_glass_logs.sql` |
| Audit trail | `supabase/migrations/00018_audit_logs.sql`; `apps/web/lib/log-event.ts` |
| Emergency UI | `apps/web/app/(staff)/emergency/page.tsx` |
| No sensitive content in notifications | `AGENTS.md` rules; `notifyStaff()` usage; `docs/realtime-audit.md` |

#### What works

- Students are represented by an **alias** in staff-facing views. The real identity is not simply printed everywhere.
- Anonymous appointments carry `is_anonymous`, and the reveal path is a **separate, audited action**, not a normal read.
- Counselor access is constrained by caseload in the break-glass flow (`isStudentOnCounselorCaseload()` in `break-glass-service.ts`, lines 27–63).
- Identity reveals write separate `audit_logs` rows, and break-glass grants expire after **30 minutes** (`apps/web/app/(staff)/emergency/page.tsx`, lines 41–42).
- Notification payloads intentionally avoid clinical content, aliases, note text, and tokens.
- Sensitive tables are protected by RLS; privileged reads use the service-role client only in server routes.

#### Gaps and honest caveats

1. **This is pseudonymity, not mathematical anonymity.** The database links an alias to a `student_id`, and staff with sufficient access (or a service-role key) can correlate records. The system protects against casual disclosure, not against a determined insider.
2. **“During counseling sessions” is broader than the technical control.** Chat, session notes, and appointment records may still contain identity-revealing content typed by the student or counselor. The system cannot guarantee anonymity if a participant self-identifies.
3. **No data-retention or alias-rotation policy is evidenced.** Old aliases, audit logs, and chat history can accumulate indefinitely unless a retention process exists.
4. **No security test or threat model was found.** The design is thoughtful, but it has not been penetration-tested.

#### Non-technical user lens

The anonymous toggle in `/book` is simple and visible. The risk is **expectation management**: students may believe “anonymous” means no one can ever know who they are. The UI should state plainly who can see the real identity, when, and why — for example, “Your counselor sees your alias. The Guidance Head can reveal your identity only in an emergency, and that action is logged.”

---

### Objective 4 — Develop a counselor dashboard for efficient management of schedules, student records, and session documentation

**Verdict: Substantially achieved.**

#### Where it is implemented

| Function | Route / file |
|---|---|
| Counselor dashboard | `apps/web/app/(staff)/dashboard/page.tsx`; `apps/web/app/api/dashboard/counselor/route.ts` |
| Appointment queue and actions | `apps/web/app/(staff)/appointments/page.tsx` |
| Session calendar/list | `apps/web/app/(staff)/sessions/page.tsx` |
| Student directory | `apps/web/app/(staff)/students/page.tsx` |
| Availability management | `apps/web/app/(staff)/availability/page.tsx` |
| Session notes | `apps/web/app/api/session-notes/route.ts`; `apps/web/app/api/session-notes/attachments/route.ts` |
| Follow-ups | `packages/shared-services/src/appointments/mutations.ts`; `follow_up_of` field |
| Role policy | `packages/shared-services/src/rbac.ts` (`/dashboard`, `/sessions`, `/students`, `/availability`, `session-note.write`) |

#### What works

- The dashboard is the counselor’s landing page and surfaces the work queue, upcoming sessions, and pipeline signals.
- Sessions have a real calendar/list view with status, time, mode, and assigned counselor.
- The student directory gives counselors a caseload-oriented view rather than a raw database table.
- Availability windows are managed by counselors and used by booking/confirmation.
- Session notes are constrained to the **assigned counselor**, only for **completed** appointments, one note per session. Heads may read for oversight. Note content is not logged, notified, or audited.
- Follow-up appointments can be minted from a documented session, linking via `follow_up_of`.

#### Gaps and honest caveats

1. **There is no single “student record” page** that consolidates appointments, referrals, notes, PSS-10 bands, and feedback into one longitudinal timeline. The information exists across pages, but the counselor must navigate between them.
2. **Session documentation is per-session, not a full case file.** That is appropriate for privacy, but it limits continuity for long-term counseling.
3. **No rich-text or structured note template** was evidenced; notes are text plus optional attachments.
4. ~~**No automated test for note authorization.**~~ **Closed in P1 (§1.6).** Counselor-note isolation with head oversight is covered by the RLS suite, and the counselor note-save flow is exercised by Playwright.

#### Non-technical user lens

A counselor can run a day from one dashboard: see the queue, open a session, write a note, set availability. The main friction is mental overhead — the absence of a unified student timeline means a counselor may open several pages to reconstruct a case.

---

### Objective 5 — Implement an Analytics Module that collects counseling data, identifies student stress trends, and generates reports to support data-driven decision-making by the guidance head

**Verdict: Substantially achieved.**

#### Where it is implemented

| Function | Evidence |
|---|---|
| Head reports page | `apps/web/app/(staff)/reports/page.tsx` |
| Report UI and sections | `apps/web/components/shared/head-reports-view.tsx` |
| Report data endpoint | `apps/web/app/api/reports/head/route.ts` |
| Dashboard endpoint | `apps/web/app/api/dashboard/head/route.ts` |
| Aggregate analytics queries | `packages/shared-services/src/analytics/analytics-queries.ts` |
| Daily summary view | `supabase/migrations/00019_analytics_daily_summary.sql` |
| Report RPCs | `supabase/migrations/00061_phase3b_report_rpcs.sql` |
| Charts | `apps/web/components/shared/reports-charts.tsx` |
| Excel/print export | `apps/web/lib/reports/**`; reports page export actions |

#### What the reports actually show

From `head-reports-view.tsx`:

- Sessions trend over the selected range (`SessionsTrend`, `ReportTrendChart`).
- Referrals by status and priority.
- Referral pipeline health: unassigned, escalated, oldest open.
- Satisfaction from student feedback.
- PSS-10 stress bands (low / moderate / high), average score, and high-band count.
- Counselor workload.
- Top concerns.
- Export to Excel and print for meetings/sign-off.

The page includes an explicit note that PSS-10 bands are **signals, not diagnoses**, and that satisfaction only covers students who left feedback. This is good analytic hygiene.

#### Gaps and honest caveats

1. **It is aggregate reporting, not advanced analytics.** There is no predictive model, no risk scoring, no cohort comparison, and no anomaly detection. “Identifies stress trends” is satisfied at the level of band distribution and session trends over a date range — not longitudinal per-student trend analysis (which would also raise privacy concerns).
2. **The measured environment was missing the report RPCs.** `perf-tests/results/explain.json` records:
   - `head_appointment_daily_counts(...) does not exist`
   - `head_referral_status_counts() does not exist`

   Both functions are defined in `00061_phase3b_report_rpcs.sql`. This strongly suggests the performance database had not applied migration 00061. The reports may still work through fallback queries, but the mismatch must be resolved and verified in the deployed environment.
3. **No scheduled or emailed reports.** Reports are viewed/exported on demand.
4. **No data-quality indicators.** The head cannot see how many records are incomplete, how many sessions lack notes, or how fresh the summary view is.
5. **Small-cell privacy risk.** Aggregate reports can still expose individuals in small groups (e.g., one high-stress student in a program). No minimum-cell suppression is evidenced.

#### Non-technical user lens

The reports page is visually structured and includes explanatory hints, which helps a non-technical head. However, terms like “PSS-10 band,” “pipeline,” and “satisfaction coverage” need the existing inline definitions to be read. A one-page “What this report means” summary would improve first-use comprehension.

---

### Objective 6 — Implement a real-time chat communication feature to facilitate interaction between students and counselors

**Verdict: Fully achieved.**

#### Where it is implemented

| Surface | Evidence |
|---|---|
| Web chat | `apps/web/app/(staff)/chat/page.tsx` |
| Mobile chat | `apps/mobile/app/chat.tsx` |
| Chat domain service | `packages/shared-services/src/chat/**` |
| Contact discovery | `apps/web/app/api/chat/contacts/route.ts` |
| Realtime subscriptions | Supabase Realtime `chat_messages` INSERT subscription (web and mobile) |
| Realtime behavior audit | `docs/realtime-audit.md` |
| Schema and policies | `supabase/migrations/**` (`chat_threads`, `chat_messages`, RLS) |
| Measured latency | `perf-tests/results/realtime.json` |

#### What works

- Students have an inbox of their `chat_threads`, then a conversation view. Counselors/head/faculty have the corresponding web chat.
- Sending is optimistic; the first message lazily opens a thread, so browsing does not create empty threads.
- Staff replies arrive through a realtime `chat_messages` subscription; the mobile app clears unread chat notifications when a dialog is opened.
- Threads are participant-private under RLS. Notification payloads avoid message content.
- Measured delivery: **n = 50**, p50 **378.6 ms**, p95 **494.7 ms**, max **502.8 ms**, **0 lost**. Reconnect test recovered **3/3** expected messages (1 replayed live, 3 via refetch overall).
- Chat send mutation p50 is **263 ms**; direct message p50 is **131 ms** (`perf-tests/results/mutations.json`).

#### Gaps and honest caveats

- No typing indicators, read receipts, or message editing/deletion were verified.
- No offline outbox/queue was found; a send while offline depends on the client library’s retry behavior.
- Real-time delivery depends on a healthy websocket; the reconnect test shows refetch is the safety net, which is good, but the UX during reconnect is not documented.
- There is no automated chat E2E suite; the measurement harness remains the primary realtime evidence. P1 added domain/RLS tests but no chat send/reconnect browser test.

#### Non-technical user lens

Chat is one of the most familiar surfaces in the product. The inbox → conversation pattern, quick replies, and unread badges are appropriate for non-technical users. The main risk is expectations: students may assume a counselor is online 24/7. The UI should set response-time expectations.

---

### Objective 7 — Announcement management for publishing announcements and counseling-related activities (renamed from “event management”)

**Verdict: Fully achieved for the renamed scope.** The original “event management” wording is withdrawn; see `docs/objective-7-announcement-scope.md` for the decision record.

#### Where it is implemented

| Function | Evidence |
|---|---|
| Announcements page | `apps/web/app/(staff)/announcements/page.tsx` |
| Announcement form | `apps/web/components/announcements/AnnouncementForm.tsx` |
| Image upload/validation | `apps/web/components/announcements/image-upload.tsx` |
| Audience targeting | `student`, `counselor`, `faculty`, or everyone; role-filtered feeds |
| Draft / publish / unpublish | `save(publish)` and `togglePublish()` in the page |
| Insights tab | Published/draft/with-image counts and audience mix |
| Mobile feed | `apps/mobile/app/(tabs)/home.tsx` announcements section |

#### What works

- The head can write a post, attach an image, target an audience, save as draft, publish, unpublish, and delete.
- Publishing sends role-filtered notifications (fire-and-forget, deduplicated).
- Staff see only published posts aimed at their role; drafts never reach them.
- The page includes an insights tab with basic content statistics.
- The mobile home screen surfaces announcements to students.

#### Scope boundary: no event entity

The renamed objective covers announcements only. The system deliberately does **not** have:

- event title separate from announcement body,
- event date and time range,
- venue or online link,
- capacity or registration,
- RSVP / attendance tracking,
- calendar view or “add to calendar,”
- reminders specific to an event,
- recurrence.

In short: the implementation is an **announcement manager**, not an event management module. This is a documented scope decision, not an unfinished feature; see `docs/objective-7-announcement-scope.md`.

#### Non-technical user lens

For posting an announcement, the flow is simple and familiar (compose → choose audience → publish). For a student, announcements appear on Home, which is discoverable. The gap is that a student cannot answer “What counseling activities are happening next week?” from a calendar.

---

### Objective 8 — Embed a Google Meet link within the application to facilitate online counseling sessions and consultations between students and counselors

**Verdict: Partially achieved.**

#### Where it is implemented

| Function | Evidence |
|---|---|
| Meeting URL column | `supabase/migrations/00034_appointments_meeting_url.sql` |
| URL validation | `packages/shared-services/src/appointments/mutations.ts`, `isMeetUrl()` around lines 436–441 |
| Online confirmation gate | `appointments/mutations.ts`, lines 274, 471–481 (“Add the Google Meet link for this online session”) |
| Referral session minting | `packages/shared-services/src/referrals/mutations.ts`, lines 326, 354–360 |
| Display / join link | Appointment and session detail UIs |

#### What works

- An online session cannot be confirmed without a valid `meet.google.com` URL.
- The URL must start with `https://`, and invalid links produce a clear error (“That doesn't look like a Google Meet link — paste a meet.google.com link”).
- The link is stored on the appointment and is available in the session details for the student and counselor.
- Referral confirmation can mint a session with a mode and Meet link in one flow.

#### What is missing

- **No Google Calendar/Meet API integration.** The counselor or head must create the meeting in Google and paste the URL manually. The system does not create, update, or delete meetings.
- **No automatic link generation**, no OAuth consent, no calendar invite, no attendance verification.
- **No link expiry/rotation**; a stale link can remain on a future session.
- If the link is pasted incorrectly but still matches the domain pattern, there is no reachability check.

#### Non-technical user lens

The manual paste step is the weak point. A non-technical counselor must know how to create a Google Meet and copy the correct link. A “Create Meet link” button (with Google OAuth) would remove this friction. At minimum, the field needs a short “How to get a Meet link” helper and a “Test link” action.

---

### Objective 9 — Implement a Break-Glass Emergency Access Protocol that allows authorized counselors to temporarily override student anonymity in critical situations, with all actions recorded through audit logs for accountability and transparency

**Verdict: Fully achieved.**

#### Where it is implemented

| Control | Evidence |
|---|---|
| Emergency page | `apps/web/app/(staff)/emergency/page.tsx` |
| Log access API | `apps/web/app/api/staff/security/log-break-glass/route.ts` |
| Reveal identity API | `apps/web/app/api/staff/security/reveal/route.ts` |
| Head review API | `apps/web/app/api/staff/security/review-break-glass/route.ts` |
| Domain rules | `packages/shared-services/src/security/break-glass-service.ts` |
| Break-glass table | `supabase/migrations/00017_break_glass_logs.sql` |
| Audit table | `supabase/migrations/00018_audit_logs.sql` |
| RBAC action | `rbac.ts`, `break-glass.access`: counselor + guidance head |

#### What works

- An authorized counselor or the head can log emergency access with a **minimum 20-character justification**.
- A counselor may only target a student on their caseload (assigned appointment or assigned referral); the head can access the full directory.
- Logging access opens a **30-minute grant**. The UI shows a countdown and restores an unexpired grant after refresh.
- Counselors need **head review** before identity reveal; the head reviews and marks the event.
- Reveals write separate `audit_logs` rows; the audit trail records who, when, and why.
- The grant is stored and reconciled against the server board, not trusted blindly from local storage. A stored grant from another account is rejected (shared-device safety).
- Notification/realtime payloads carry IDs, not names or content.

#### Gaps and honest caveats

1. **No automated alerting** to the head when a break-glass event occurs. The head can review later, but there is no push/email/SMS escalation. In a real emergency protocol, passive review is weaker than active notification.
2. ~~**No automated tests for the caseload rule, expiry, or review flow.**~~ **Partly closed in P1 (§1.6).** The unit suite covers break-glass caseload logic, and the RLS suite covers break-glass audit read scope; the full expiry/review workflow still has no browser test.
3. **Audit logs are only as good as their retention and monitoring.** There is no evidence of tamper-evident storage, off-box shipping, or regular audit review reports.
4. **The protocol is application-level.** A database administrator or service-role key can bypass it entirely. This is inherent, but should be stated in policy.

#### Non-technical user lens

The emergency page is deliberately separate from normal workflows, which is correct. The justification field and countdown make the seriousness clear. A non-technical counselor needs a short on-screen script: when to use it, what to write, and who will review it. The 20-character minimum prevents empty justifications but not meaningless ones.

---

### Objective 10 — Develop a faculty referral feature that enables faculty members to identify and refer students with observed academic, behavioral, or relational concerns to the Guidance Office for consultation through a referral form

**Verdict: Fully achieved.**

#### Where it is implemented

| Function | Evidence |
|---|---|
| Referral form | `apps/web/app/(staff)/refer-student/page.tsx` |
| Referral board / triage | `apps/web/app/(staff)/referrals/page.tsx` |
| Domain logic | `packages/shared-services/src/referrals/mutations.ts` |
| Referral action trail | `referral_actions` table and writes on triage moves |
| Session minting | Referral confirmation creates/updates a linked appointment (`source_referral_id`) |
| RBAC | `rbac.ts`: `referral.create` = faculty + head; assign/reject = head; confirm/resolve/escalate = counselor |
| Faculty dashboard | `apps/web/app/(staff)/dashboard/page.tsx` (faculty view) |

#### What works

- Faculty can submit a referral with the student, concern category (academic, behavioral, relational), priority, and narrative.
- The head assigns the referral; the counselor confirms, resolves, escalates, or rejects it.
- Every triage move should leave a `referral_actions` audit row.
- Confirming a referral mints a linked session rather than duplicating the appointment, with mode and Meet link where online.
- Faculty see their own referrals and status; they do not see counseling notes or PSS-10 results.
- The faculty dashboard summarizes the faculty member’s referrals and outcomes.

#### Gaps and honest caveats

1. **Web-only.** There is no faculty mobile app; faculty must use the web portal. That is acceptable for the stated objective, but it limits field use.
2. **No external delivery.** The referral stays inside the system; there is no printable/emailed referral letter to the Guidance Office, though internal tracking is complete.
3. **Referral classification is a fixed list.** If the categories do not match the institution’s taxonomy, they must be changed in code/schema.
4. ~~**No automated tests for permission boundaries** (e.g., faculty attempting to read notes).~~ **Closed in P1 (§1.6).** Cross-role insert denial, counselor-note isolation, and self-promotion blocking are covered by the RLS suite; the faculty referral flow is covered by Playwright.

#### Non-technical user lens

The referral form is the most policy-heavy screen for a non-technical faculty member. It needs clear definitions of academic vs. behavioral vs. relational, guidance on what *not* to write (avoid clinical diagnosis), and a confirmation that the referral was received. The existing form and status tracking are a solid base; the main usability need is **explanatory microcopy and examples**.

---

### Objective 11 — Evaluate the performance, usability, reliability, and security of the proposed Digital Counseling and Appointment System in accordance with the ISO/IEC 25010 Software Quality Model

**Verdict: Partially achieved.**

#### What exists

| Quality area | Evidence |
|---|---|
| Performance | `perf-tests/` harness; `results/pages.json`, `pages-throttled.json`, `booking.json`, `mutations.json`, `realtime.json`, `explain.json` |
| Reliability | Realtime reconnect test, 0 lost messages; concurrency test re-run green after `00067` (§1.5); 41 unit + 8 RLS + 4 role smoke tests in CI (§1.6) |
| Security | RBAC, RLS, audit logs, break-glass, guarded writes, server-only service role, Zod validation, rate limiting |
| Usability | Interface review only; no SUS or task-based study |
| ISO/IEC 25010 structure | This report provides a structured evaluation; no formal instrument was found in the repo |

#### What is genuinely evaluated

- **Performance** is measured with real artifacts: page TTFB/FCP/LCP/CLS, booking service timings, mutation timings, realtime latency, DB explain plans.
- **Reliability** is partially measured: message delivery under load and reconnect recovery; slot concurrency (failed at review time, fixed and re-measured on staging — §1.5); targeted automated tests now run in CI (§1.6).
- **Security** is design-reviewed: access control, audit, anonymity, secret handling.
- **Usability** is **not empirically evaluated**. There is no user study, no SUS score, no task-success measurement, no accessibility audit.

#### Why this is only partial

ISO/IEC 25010 is not satisfied by a performance script alone. A defensible evaluation needs, at minimum:

1. A defined quality model with characteristics and sub-characteristics.
2. Metrics and acceptance criteria per characteristic.
3. Evidence from representative users and environments.
4. A threat model / security test, not only a design review.
5. Reliability evidence beyond a single happy-path run (failure injection, recovery, long-run stability).
6. A documented limitations section (this report provides one).

This report supplies the structure and the honest evidence, but it cannot manufacture user-study data that was never collected. That is why Objective 11 is marked **partially achieved** — the evaluation is real but incomplete.

---

## 5. ISO/IEC 25010 Evaluation

### 5.1 Rating approach

Ratings are on a 1–5 scale, judged against the evidence available for **non-technical users in a school guidance context**:

| Score | Meaning |
|---:|---|
| 5 | Excellent; measured and consistently meets the need |
| 4 | Good; strong evidence, minor gaps |
| 3 | Adequate; works, but material gaps or unverified claims |
| 2 | Weak; significant gaps |
| 1 | Unacceptable / absent |

### 5.2 Summary ratings

| ISO/IEC 25010 characteristic | Score | Justification |
|---|---:|---|
| Functional suitability | **4 / 5** | Broad, real coverage of scheduling, PSS-10, chat, referrals, reports, audit, and announcement management. Gaps in Meet automation; one gate is 30-day rather than per-session. Calendar/RSVP/attendance are explicitly out of the renamed Objective 7 scope. |
| Performance efficiency | **3.5 / 5** | Normal pages 135–240 ms; booking ~1.2–1.5 s; chat p50 379 ms. Throttled login LCP ~5.0 s and heavy login JS (~1.13 MB) pull the score down. |
| Compatibility | **3 / 5** | Web + iOS/Android via Expo + Supabase. No offline mode, no browser/device matrix, no integration with Google Calendar. |
| Usability | **3 / 5** | Clear flows, plain language, large touch targets, role-specific navigation, in-app handbook; mobile mock content removed in P1. Still no participant-based usability test or accessibility audit, so the score remains a design judgment. |
| Reliability | **3 / 5** | Realtime 0 lost messages and reconnect recovery. Concurrency failure fixed and re-measured on staging (`00067`); P1 adds 41 unit tests, 8 RLS tests, and four role smoke specs. Still no soak/failure-injection test and no automated chat reconnect test. |
| Security | **4 / 5** | Strong layered design: RBAC, RLS, guarded writes, audit logs, break-glass, private storage, no PHI in notifications. No penetration test; pseudonymity can be correlated by privileged staff. |
| Maintainability | **4 / 5** | Shared services, single RBAC policy, sequential migrations, strict TypeScript, documented architecture, and a CI test foundation (unit + RLS + Playwright). Remaining risk is environment drift, not absence of tests. |
| Portability | **3.5 / 5** | Next.js + Expo are portable by design; environment-based config. Mobile device coverage and offline behavior are unverified. |

**Overall evidence-weighted quality: approximately 3.6 / 5 (“adequate to good, with material verification gaps”).**

This is not a failing score. It reflects a system that is functionally rich and thoughtfully designed, but not yet formally validated.

### 5.3 Performance efficiency — measured results

#### Normal conditions (`perf-tests/results/pages.json`, 2026-10-11)

| Page | TTFB p50 | FCP/LCP p50 | CLS | JS |
|---|---:|---:|---:|---:|
| `/login` | 8 ms | 520 ms | ~0.0001 | 1,133 KB |
| `/dashboard` (head) | 146 ms | 204 ms | 0 | 259 KB |
| `/reports` (head) | 158 ms | 200 ms | 0 | 259 KB |
| `/appointments` (head) | 188 ms | 240 ms | 0 | 259 KB |
| `/referrals` (head) | 146 ms | 184 ms | 0 | 2–259 KB |
| `/chat` (head) | 135 ms | 168 ms | 0 | 2 KB |
| `/announcements` (head) | ~135 ms | ~168 ms | 0 | — |

Normal staff pages are comfortably fast.

#### Throttled conditions (`perf-tests/results/pages-throttled.json`)

| Page | LCP p50 | LCP p95 | CLS |
|---|---:|---:|---:|
| `/dashboard` | 1,608 ms | 2,132 ms | 0.056 |
| `/reports` | 1,632 ms | 1,824 ms | 0 |
| `/chat` (counselor) | 1,572 ms | 1,840 ms | 0 |
| `/login` | **4,964 ms** | **5,620 ms** | ~0.0001 |

Throttled staff pages remain usable (~1.6 s), but **login is poor on slow connections** (~5 s LCP). The login page also ships ~1.13 MB JS, which is the main performance debt.

#### Booking (`perf-tests/results/booking.json`)

| Path | Total service p50 | p95 |
|---|---:|---:|
| Unassigned booking | 1,179 ms | 1,427 ms |
| Assigned booking | 1,464 ms | 1,683 ms |

Acceptable for a multi-step flow, but on the slower side for mobile. The dominant costs are auth (~250–275 ms), screen (~432 ms), and the PSS-10/gate/insert sequence (~130 ms each).

#### Mutations (`perf-tests/results/mutations.json`)

| Action | p50 | p95 |
|---|---:|---:|
| Chat send | 263 ms | 372 ms |
| Direct message | 131 ms | 320 ms |
| Referral submit | 129 ms | 261 ms |
| Referral triage | 248 ms | 373 ms |
| Feedback | 379 ms | 461 ms |
| Student reschedule | 248 ms | 340 ms |
| Cancel | 266 ms | 378 ms |
| Announce | 127 ms | 263 ms |

All measured mutations are sub-second at p50.

#### Real-time (`perf-tests/results/realtime.json`)

| Metric | Value |
|---|---:|
| Delivered | 50 / 50 |
| p50 | 378.6 ms |
| p95 | 494.7 ms |
| Max | 502.8 ms |
| Lost | 0 |
| Reconnect recovery | 3 / 3 expected |

#### Database query plans (`perf-tests/results/explain.json`)

Measured query execution times are low (0.088–7.117 ms). However, two report RPCs were missing in the measured database (see Objective 5), which is an environment/deployment issue rather than a query-performance issue.

### 5.4 Usability — evidence and gaps

**Positive evidence**

- Linear onboarding and booking flows; a student does not need to understand the appointment lifecycle to book.
- Plain-language labels and actionable errors.
- Mobile touch targets: 44 px inputs, 32 px buttons with `hitSlop`; consistent spacing and type scale (`apps/mobile/theme.ts`).
- Role-filtered navigation reduces clutter.
- In-app `/about` handbook explains the pipeline and page purpose for staff.
- Skeletons, empty states, and status pills reduce uncertainty.
- Real-time unread badges and reminders support timely action.

**Gaps**

- No moderated usability test, task-success rate, time-on-task, or SUS score.
- No accessibility audit (screen reader, keyboard, contrast, reduced motion, text scaling).
- ~~Mobile PSS-10 wording is mocked.~~ **Closed in P1 (§1.6):** the shared instrument is now the only source. Licensing/permission is still unverified.
- ~~The mobile profile card is partly mock.~~ **Closed in P1 (§1.6):** it reads `profiles` + `students`.
- Dense staff pages (reports, referrals) assume familiarity with terms like “pipeline,” “band,” and “triage.”

**Assessment for non-technical users:** The product is **approachable in structure** but **unproven in use**. It is likely usable by students for booking/chat and by counselors for daily queues. It is less certain for faculty referrals and head analytics without training.

### 5.5 Reliability

**Strengths**

- Real-time reconnect recovered all expected messages (3/3), with refetch as a safety net.
- Booking is idempotent; duplicate submissions do not create duplicate appointments.
- Guarded updates use `.eq("status", expectedFrom)` to avoid lost updates in normal flows.
- Database constraints/triggers backstop several rules.
- Backups exist with a documented restore procedure (`docs/BACKUP_RESTORE.md`), and scheduled runs require `CRON_SECRET`.
- Session reminders run in Postgres and arrive through the same notification path.

**Weaknesses**

- **E1 concurrency failure:** 50 concurrent confirmations of overlapping same-slot appointments all ended `confirmed` in the measured run.
- The exclusion constraint that should prevent this is created in a `DO` block that catches all exceptions and only raises a notice. A pre-existing overlap can cause it to be skipped without failing deployment.
- ~~No unit/integration/e2e test suite; regressions rely on manual checks.~~ **Reduced in P1 (§1.6):** 41 unit tests, 8 RLS integration tests, and four Playwright role specs run in CI. Coverage is still targeted, not exhaustive.
- Single-run performance evidence; no long-run soak test or failure injection.
- Migration drift observed (missing report RPCs in the measured DB).

**Verdict:** Reliable in normal single-user flows; **not proven reliable under concurrency**.

### 5.6 Security and privacy

| Control | Implemented? | Evidence | Residual risk |
|---|---|---|---|
| Authentication | Yes | Supabase Auth; login/register/reset routes | No MFA evidenced |
| Role-based access | Yes | `rbac.ts`; route guards; RLS | Policy drift if pages bypass shared policy |
| Row-level security | Yes | Migrations | Must be verified per table in deployment |
| Guarded writes | Yes | `.eq("status", expectedFrom)` patterns | 0-row updates can look like success to naive clients |
| Anonymity/aliases | Yes | Alias bootstrap; `is_anonymous`; reveal API | Pseudonymity, correlatable by privileged staff |
| Break-glass | Yes | 30-min grant; justification; caseload; head review; audit | No active alerting; no tamper-evident audit |
| Audit logs | Yes | `audit_logs`, `break_glass_logs`, `referral_actions` | Retention/monitoring not evidenced |
| Sensitive data in notifications | Avoided | `notifyStaff()` rules; `docs/realtime-audit.md` | Human error in future changes |
| Service-role isolation | Yes | Server-only `lib/supabase/admin.ts` | Any server-route bug could expose it |
| Input validation | Yes | Zod schemas in shared packages | Coverage depends on every route using them |
| File storage | Private buckets | Session-note attachments; avatar signed URLs | Signed-URL leakage if logs capture URLs |
| Backups | Yes | `/api/admin/backups/*`; `CRON_SECRET` | Restore drills not evidenced |
| Rate limiting | Yes | `apps/web/lib/rate-limit.ts` | Distributed deployment behavior unverified |
| Security testing | **No** | — | No pen test, SAST/DAST, or threat model |

**Security verdict:** Strong design, not yet independently validated. The most important security-adjacent defect is the concurrency/slot-guard issue, because it can create conflicting sessions and undermine trust in scheduling.

---

## 6. Usability Review for Non-Technical Users

### 6.1 Student journey

| Step | Experience | Honest assessment |
|---|---|---|
| Install/open | Branded onboarding carousel with mascot | Friendly; low cognitive load |
| Register/login | Email/password; student number/program/year | Familiar, but email confirmation adds a step |
| Home | Next session, announcements, quick actions, breathing exercise, mood check | Warm and supportive; not clinical |
| Book | Concern → mode → day/time → anonymous toggle | Clear linear flow |
| Check-in | PSS-10 items → submit → chat | The highest-friction step; wording must be validated |
| Sessions | Upcoming/past/canceled; details, cancel, reschedule, rating | Clear status model; confirmed reschedule is restricted |
| Chat | Inbox → conversation; realtime replies | Familiar and responsive |
| Profile | Student card, photo, logout | Real `profiles` + `students` data; mock removed in P1 |

**Main student risk:** the PSS-10. It is the point where a non-technical user is most likely to feel confused or judged. The app correctly hides the numeric total and uses bands, which is good. But the item wording and response labels must be the validated instrument, not local mock text.

### 6.2 Counselor journey

- Dashboard → queue → appointment → confirm/complete → session note → follow-up.
- Availability management is separate but discoverable.
- `/about` provides a page-by-page handbook.
- Strong: role-specific work queues, status pills, realtime updates.
- Weak: no unified student timeline; reports use analytics vocabulary.

### 6.3 Faculty journey

- Dashboard → refer a student → track status.
- The referral form is the most policy-sensitive screen.
- Weak: no examples/definitions on-screen for academic vs. behavioral vs. relational; no mobile access.

### 6.4 Guidance head journey

- Analytics/reports → workload/pipeline → assign/reject → security review → users/backups.
- Strong: the head sees the widest picture and has explicit explanations in reports.
- Weak: dense terminology; small-cell privacy risk; no scheduled report delivery.

### 6.5 What would materially improve non-technical usability

1. ~~Replace all mock mobile content (profile card, PSS-10 wording).~~ **Done in P1 (§1.6).**
2. Add a one-screen “How anonymous am I?” explanation in the booking flow.
3. Add “What happens next?” confirmations after booking, referral, and break-glass.
4. Add inline definitions for “band,” “pipeline,” “triage,” and “satisfaction coverage.”
5. Run a task-based usability test with 5–8 representative users per role and report task success/time/SUS.
6. Conduct a WCAG 2.1 AA audit and fix contrast, focus, labels, and screen-reader order.
7. Reduce login JS weight and improve slow-network login.

---

## 7. Risk Register

| ID | Risk | Likelihood | Impact | Evidence | Priority |
|---|---|---|---|---|---|
| R1 | Double-booking / overlapping confirmed sessions under concurrency | Medium | High | Original: `concurrency.json` E1 50 confirmed vs expected 1; `00059` constraint could be skipped. **Fixed 2026-10-24 — see §1.5; E1 now 1 confirmed / 49 × `23P01`.** | **P0 — resolved** |
| R2 | Report RPCs missing in deployed DB, causing degraded/failed analytics | Medium | High | Original: `explain.json` functions did not exist. **Fixed 2026-10-24 — `00061` applied; both RPCs return OK.** | **P0 — resolved** |
| R3 | No automated tests; regressions reach production | High | High | Original: no test runner. **Reduced 2026-10-24 — §1.6:** 41 unit tests, 8 RLS tests, 4 Playwright role specs in CI | **P1 — substantially reduced; staging guard job still unrun** |
| R4 | Mobile profile and PSS-10 wording are mock data | High | Medium–High | Original: mobile README. **Closed 2026-10-24 — §1.6:** profile reads Supabase; shared PSS-10 instrument; `data/mock.ts` removed | **P1 — resolved (licensing note still unverified)** |
| R5 | “Events” lacks calendar/date/venue/RSVP | High | Medium | Original: `/announcements` only. **Resolved 2026-10-24 — §1.6:** objective renamed to announcement management; boundary documented | **P1 — resolved by scope decision** |
| R6 | Google Meet is manual paste, no API integration | High | Medium | `isMeetUrl()`; no Google API code | **P2** |
| R7 | No empirical usability/accessibility validation | High | Medium | No SUS/WCAG artifacts | **P1** |
| R8 | Break-glass has no active alerting | Medium | Medium–High | Head review is passive | **P2** |
| R9 | PSS-10 not required before every session | Medium | Medium | 30-day booking gate only | **P2** |
| R10 | Pseudonymity can be correlated by privileged staff | Medium | Medium | Alias ↔ student_id linkage | **P2** (policy + monitoring) |
| R11 | Throttled login ~5 s LCP and 1.13 MB JS | High | Medium | `pages-throttled.json` | **P2** |

---

## 8. Recommendations

### P0 — Before claiming production readiness

> **Status: completed on staging, 24 October 2026.** See §1.5 for the migration, cleanup, and re-measured evidence. Production still needs the same migrations applied and verified.

1. **Verify and enforce the slot exclusion constraint.** *(done — see §1.5)*
   - Check `pg_constraint` for `no_counselor_overlap` in the deployed database.
   - Remove the silent `EXCEPTION` fallback, or replace it with a migration that fails loudly and a cleanup script for overlapping rows.
   - Re-run `perf-tests/concurrency-slots.mjs`; require E1 `confirmed === 1` and `pass: true`.
   - **Acceptance:** 50 concurrent confirms of the same slot produce exactly 1 success and 49 friendly rejections; no overlapping `assigned`/`confirmed` rows for a counselor.

2. **Apply and verify migration `00061_phase3b_report_rpcs.sql`.** *(done — see §1.5)*
   - Confirm `head_appointment_daily_counts` and `head_referral_status_counts` exist in the deployed schema.
   - Add a startup/health check that fails visibly if report RPCs are missing.
   - **Acceptance:** `/reports` and the head dashboard load with no RPC errors; explain plans resolve.

### P1 — Close the honesty gaps

3. ~~**Replace mobile mock data.**~~ **Done in P1 (§1.6).**
   - Profile identity card reads `profiles` + `students`.
   - PSS-10 item wording and response labels come from one shared instrument.
   - **Acceptance met:** `apps/mobile/data/mock.ts` was removed.

4. **Add automated tests.**
   - Unit tests for `bookAppointment`, PSS-10 freshness, break-glass caseload, RBAC, and referral transitions.
   - Integration tests for RLS boundaries.
   - One e2e smoke path per role (student book, counselor confirm/note, faculty refer, head report).
   - **Acceptance:** tests run in CI and cover the P0 concurrency case.

5. **Run a usability and accessibility study.**
   - 5–8 users per role; measure task success, time, errors, and SUS.
   - WCAG 2.1 AA audit (contrast, focus, labels, screen reader, text scaling).
   - **Acceptance:** report results and fix high-severity findings.

6. **Event wording — decided.** The objective is renamed to “announcement management.” No events MVP is built; the boundary is recorded in `docs/objective-7-announcement-scope.md`.

### P2 — Improve quality and trust

7. **Google Meet integration.** Add OAuth + Calendar/Meet API link creation, or clearly document manual paste as a scope decision and add a “Test link” helper.
8. **Break-glass alerting.** Notify the head immediately (in-app + email/SMS) when a grant is opened; add a weekly audit-review report.
9. **Report privacy.** Add minimum-cell suppression (e.g., hide groups with fewer than 5 students) and a “last refreshed” timestamp.
10. **Performance.** Reduce login JS, lazy-load heavy components, and re-measure throttled LCP. Target < 2.5 s LCP on a slow 4G profile.
11. **PSS-10 policy.** Decide whether a fresh assessment is required before every session or only before booking; document the decision and reflect it in the UI.
12. **Student record timeline.** Add a privacy-safe consolidated view for counselors (appointments, referrals, bands, notes) to reduce navigation.

---

## 9. Limitations of This Review

1. **No live runthrough.** The assessment is based on source code and existing artifacts; it did not click through every page or execute every flow.
2. **Single performance run.** Results are from 2026-10-11 against a staging dataset; production behavior may differ.
3. **No user study.** Usability judgments are heuristic, not empirical. A protocol and recruitment plan exist, but no sessions have been run (see §1.6).
4. **No security testing.** Security findings are design-review findings, not penetration-test results.
5. ~~**No production database inspection.**~~ **Partly closed:** E1 and the RPC drift were verified and fixed on **staging** on 2026-10-24 (§1.5); production still needs the same migrations applied and verified.
6. **Objective 11 cannot be fully satisfied by this document alone.** It requires the missing participant-based user study and accessibility audit, plus broader reliability/security testing. P1 supplied the automated test foundation but not the human evidence.

---

## 10. Conclusion

The Digital Counseling and Appointment System with Analytics is a **substantial, working implementation**, not a mock-up. It covers the full counseling workflow: student onboarding, booking, PSS-10 gating, anonymous identity, counselor case management, session notes, referrals, real-time chat, announcements, feedback, analytics, break-glass access, and audit logs.

Against the 11 specific objectives:

- **4 are fully achieved:** real-time chat, break-glass emergency access, faculty referrals, and announcement management (renamed scope).
- **5 are substantially achieved:** interfaces, scheduling/PSS-10, anonymity, counselor dashboard, and analytics.
- **2 are partially achieved:** Google Meet integration and the ISO/IEC 25010 evaluation.

The most defensible capstone claim is:

> “The system implements the functional requirements of the study to a substantial degree. Its strongest qualities are privacy-aware workflow design, role separation, and real-time communication. P1 closed the mobile mock-data and automated-test gaps and fixed the P0 concurrency/analytics findings on staging. Its main remaining work is a participant-based usability/accessibility study, production verification, and a complete ISO/IEC 25010 evaluation.”

The system should **not** yet be described as fully production-ready or fully ISO 25010 compliant. It is, however, a credible and well-architected capstone product with a clear, achievable path to that claim.

---

## Appendix A — Route and Page Map

### Web

| Route | Audience | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/login`, `/register`, `/reset-password`, `/update-password` | Public | Authentication |
| `/dashboard` | Counselor, head, faculty | Role-specific home |
| `/appointments` | Student, counselor, head | Appointment queue and lifecycle |
| `/sessions` | Counselor, head | Session calendar/list and notes |
| `/availability` | Counselor, head | Availability windows |
| `/students` | Counselor, head | Student directory |
| `/referrals` | Counselor, head, faculty | Referral triage and tracking |
| `/refer-student` | Faculty | Create a referral |
| `/reports` | Counselor, head, faculty | Analytics and exports |
| `/chat` | All staff roles | Real-time messaging |
| `/announcements` | All roles (scoped) | Announcements/newsfeed |
| `/feedback` | Student, counselor, head | Satisfaction feedback |
| `/emergency` | Counselor, head | Break-glass access |
| `/security`, `/security/events` | Head | Security console and audit events |
| `/users`, `/users/new` | Head | User management |
| `/backups` | Head | Backup runs and downloads |
| `/settings` | All roles | Preferences |
| `/about` | Counselor, head, faculty | Role-scoped handbook |

### Mobile

| Route | Purpose |
|---|---|
| `/` | Onboarding carousel |
| `/login`, `/register` | Auth |
| `/(tabs)/home` | Next session, announcements, quick actions, mood check |
| `/(tabs)/sessions` | Upcoming/past/canceled, cancel, reschedule, rating |
| `/(tabs)/profile` | Profile from Supabase (`profiles` + `students`) |
| `/book` | Booking step 1 |
| `/check-in` | PSS-10 + booking step 2 |
| `/chat` | Student inbox and conversation |
| `/notifications` | Notification inbox |

---

## Appendix B — Evidence Index

| Claim | Source |
|---|---|
| PSS-10 30-day gate | `packages/shared-services/src/appointments/booking-service.ts` |
| Booking idempotency and race handling | `booking-service.ts`, lines 48–53, 117–134 |
| Slot exclusion constraint | `supabase/migrations/00059_phase1_perf_indexes_slotguard.sql` |
| Concurrency failure (review-time) | `perf-tests/results/concurrency.json` (E1 `pass: false`); **fixed in `00067` — see §1.5, E1 now 1 confirmed / 49 × `23P01`** |
| Unit tests (P1) | `packages/shared-services/src/**/*.test.ts` — 41 passing; CI `verify` job |
| RLS tests (P1) | `tests/rls/rls.test.ts` — 8 cases; CI run **#39990715576** |
| Role smoke tests (P1) | `e2e/specs/*.spec.ts` — 4 specs; CI run **#39994834656** |
| P1 evidence log | §1.6 of this report; `P1_HONESTY_GAPS_PLAN.md` §9 |
| Missing analytics RPCs | `perf-tests/results/explain.json` |
| Analytics RPC definitions | `supabase/migrations/00061_phase3b_report_rpcs.sql` |
| Aggregate reports | `apps/web/components/shared/head-reports-view.tsx` |
| Real-time metrics | `perf-tests/results/realtime.json` |
| Page performance | `perf-tests/results/pages.json`, `pages-throttled.json` |
| Booking performance | `perf-tests/results/booking.json` |
| Mutation performance | `perf-tests/results/mutations.json` |
| Break-glass rules | `packages/shared-services/src/security/break-glass-service.ts` |
| 30-minute grant | `apps/web/app/(staff)/emergency/page.tsx` |
| Meet URL validation | `packages/shared-services/src/appointments/mutations.ts` |
| P1 mobile data truth | `apps/mobile/README.md` “What is wired vs. still mocked”; `packages/shared-services/src/assessments/pss10-instrument.ts` |
| RBAC policy | `packages/shared-services/src/rbac.ts` |
| P1 test foundation | `packages/shared-services/src/**/*.test.ts`, `tests/rls/rls.test.ts`, `e2e/specs/*.spec.ts`, `.github/workflows/ci.yml` |

---

*End of report.*
