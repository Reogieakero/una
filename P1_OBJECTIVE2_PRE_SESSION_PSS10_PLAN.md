# Objective 2 — Pre-Session PSS-10 and Confirmed Reschedule Plan

Status: **implemented 24 October 2026; CI green; report updated.**
Date: 24 October 2026.
Owner: engineering.
Related: `Objective_Achievement_Report.md` §3.1 and Objective 2; `P1_HONESTY_GAPS_PLAN.md`; `docs/pss10-license-note.md`.

---

## 1. Why this work exists

The current Objective 2 verdict is **substantially achieved**. The report’s remaining gap is:

> “PSS-10 gate is 30-day freshness at booking, not literally before every session.”

That is accurate. `bookAppointment()` enforces a PSS-10 within 30 days, but nothing checks the assessment again at confirmation, session start, or completion. The schema already has `pss10_assessments.appointment_id`, but the student flow never uses it.

A second gap is also recorded:

> Students can reschedule only `pending`/`assigned` sessions; confirmed sessions are locked to the Guidance Office.

This plan closes both gaps so Objective 2 can honestly move to **fully achieved**.

---

## 2. Current behaviour (verified in source)

| Area | Current behaviour | File |
|---|---|---|
| Booking gate | Latest PSS-10 must be ≤ 30 days old | `packages/shared-services/src/appointments/booking-service.ts` |
| Assessment submission | Accepts an optional `appointmentId`, but mobile never sends one | `packages/shared-services/src/appointments/mutations.ts`, `apps/mobile/app/check-in.tsx` |
| Session completion | No PSS-10 check | `completeAppointment()` in `appointments/mutations.ts` |
| Confirmed reschedule | Rejected with “contact the Guidance Office” | `rescheduleAppointment()` in `appointments/mutations.ts` |
| Link table | `pss10_assessments.appointment_id` exists; unique index allows one assessment per appointment | `00008_pss10_assessments.sql`, `00020_prisma_dictionary_alignment.sql` |
| Analytics | `analytics_daily_summary` joins on `pss10_assessments.appointment_id` | `00019_analytics_daily_summary.sql` |

The unique index is a blocker: a student who needs to retake a check-in cannot attach a second assessment to the same appointment.

---

## 3. Target policy

### 3.1 Definition of a valid pre-session check-in

A **valid pre-session PSS-10** is an assessment that:

1. is linked to the appointment (`pss10_assessments.appointment_id = appointment.id`);
2. belongs to the same student as the appointment;
3. was submitted **within 7 days before the scheduled start**;
4. was not submitted after the session started (a 5-minute clock-skew tolerance is allowed).

The 30-day booking gate remains unchanged. A booking-time assessment does **not** count for the session unless it also falls inside the 7-day pre-session window.

### 3.2 Enforcement point

Enforce at **counselor completion**, not confirmation:

- Confirmation can happen weeks before the session, so a fresh check-in cannot be required then.
- When the counselor clicks **Complete**:
  - valid linked check-in → complete normally;
  - missing or expired check-in → block with a clear, actionable message;
  - genuine exception (walk-in, referral, student unable) → require a short written waiver reason, store it on the appointment, and write an audit row.
- Completion is **not** silently waived. A waiver is an explicit, visible, reviewable decision.

### 3.3 Privacy boundary

- The counselor sees **status and timestamp only**: complete / missing / expired / waived.
- No PSS answers, item scores, or free-text clinical content are added to notifications, audit payloads, or realtime events.
- The waiver reason must describe the operational exception, not clinical detail.

### 3.4 Confirmed reschedule

Allow a student to reschedule a **confirmed** session until **24 hours before the scheduled start**, using the existing availability and overlap validation. Inside 24 hours, keep the “contact the Guidance Office” rule.

### 3.5 Legacy appointments

Do not retroactively block appointments that were already confirmed before this policy ships. `pss10_required` defaults to `true`; the migration sets it to `false` for rows already `confirmed` at migration time. New confirmations keep `true`.

---

## 4. Phasing

### P2.0 — Policy and contracts (0.25 day)

- Confirm the 7-day window, completion enforcement, waiver rule, and 24-hour reschedule cutoff.
- Add shared constants and error codes:
  - `PSS10_PRE_SESSION_DAYS = 7`
  - `PSS10_PRE_SESSION_SKEW_MS = 5 * 60 * 1000`
  - `PSS10_RESCHEDULE_CUTOFF_HOURS = 24`
  - `PreSessionPss10RequiredError` with a stable `code` (`PSS10_REQUIRED`) for UI branching.
- Define the report wording that will be used when the work lands.

**Acceptance:** decisions recorded; no UI or DB change yet.

### P2.1 — Migration `00068_pre_session_pss10.sql` (0.5 day)

- Drop `pss10_appointment_unique`; add a non-unique `(appointment_id, created_at desc)` index.
- Add to `appointments`:
  - `pss10_required boolean not null default true`
  - `pss10_waived_at timestamptz`
  - `pss10_waiver_reason text` with a length check (10–500 characters)
- Set `pss10_required = false` for rows already `confirmed` at migration time.
- Recreate `analytics_daily_summary` using a lateral join to the **latest** linked assessment per appointment, preventing fan-out after the unique index is dropped.
- Do not delete assessments or appointments.

**Acceptance:** migration applies cleanly to local Supabase and staging; `check-schema` style verification confirms columns/index; analytics returns one row per appointment-day.

### P2.2 — Shared services (1 day)

- Add pure helpers in `appointments/`:
  - `isPreSessionPss10Valid(completedAt, scheduledAt, clock)`
  - `getPreSessionPss10(db, appointmentId)` — latest linked assessment.
  - `hasValidPreSessionPss10(db, appointment)`
- Update `submitPss10()`:
  - when `appointmentId` is supplied, verify the appointment belongs to the student and is `confirmed`;
  - reject an appointment outside the pre-session window with a plain message;
  - persist the link.
- Update `completeAppointment(db, id, options?)`:
  - load `status`, `scheduled_at`, `pss10_required`;
  - if required and no valid assessment:
    - no waiver → throw `PreSessionPss10RequiredError`;
    - waiver reason valid → save `pss10_waived_at`/reason and insert an `audit_logs` row with the reason (no PSS content).
- Update `rescheduleAppointment()`:
  - allow `confirmed` rows when `scheduled_at` is more than 24 hours away;
  - reuse the existing availability/overlap gate and duration preservation;
  - reject inside 24 hours with the existing Guidance Office message.
- Update `confirmAppointment()` to set `pss10_required = true` explicitly on new confirmations.

**Acceptance:** unit tests cover all branches; no unhandled errors reach the UI.

### P2.3 — Mobile pre-session check-in (1 day)

- On the Sessions tab, for `confirmed` appointments where `pss10_required` is true:
  - show **“Pre-session check-in needed”** with a CTA when there is no valid linked assessment;
  - show **“Check-in complete”** with the timestamp when valid;
  - hide the CTA outside the 7-day window.
- `/check-in?appointmentId=<id>` submits the assessment linked to that appointment and returns to Sessions.
- Keep the existing booking flow unchanged; booking still submits its own assessment first.
- Do not display totals or answers; continue showing bands only.

**Acceptance:** mobile typecheck passes; a student can complete a pre-session check-in and the CTA changes state without a reload loop.

### P2.4 — Counselor completion UI (1 day)

- Extend the appointment board data with pre-session status for visible rows (latest linked assessment + waiver state).
- Show a compact status in the appointment detail: `Check-in complete · <time>` / `Missing` / `Expired` / `Waived`.
- When `completeAppointment` returns `PSS10_REQUIRED`, open a waiver dialog:
  - explain that the student has no valid check-in;
  - offer “Ask student to check in” (close) and “Record waiver” (reason required, 10–500 chars);
  - on waiver, retry completion with the reason.
- Keep the existing note flow after completion.

**Acceptance:** Playwright proves both the blocked path and the waiver path; no PSS content appears in the UI or notifications.

### P2.5 — Verification and report update (0.5 day)

- Unit tests, RLS tests, Playwright specs, typecheck, and web build.
- Add dated evidence to `Objective_Achievement_Report.md` §1.6 and update Objective 2.
- Update `P1_HONESTY_GAPS_PLAN.md` progress if the work is treated as a P1 continuation.

**Acceptance:** all CI jobs green; report verdict changes only if both the PSS gate and the confirmed-reschedule gap are closed.

---

## 5. File map

| Layer | Files |
|---|---|
| Migration | `supabase/migrations/00068_pre_session_pss10.sql` |
| Shared services | `packages/shared-services/src/appointments/booking-service.ts`, `mutations.ts`, `queries.ts`, tests |
| Types | `packages/shared-types/src/database.ts` (`appointments` columns) |
| Mobile | `apps/mobile/app/(tabs)/sessions.tsx`, `apps/mobile/app/check-in.tsx`, shared session components |
| Web | `apps/web/app/(staff)/appointments/page.tsx`, appointment board hook/query, completion dialog |
| Tests | shared Vitest, `tests/rls/rls.test.ts`, `e2e/specs/counselor.spec.ts`, seed setup |
| Docs | this file, `Objective_Achievement_Report.md` |

---

## 6. Test matrix

| Case | Layer | Expected |
|---|---|---|
| Check-in 7 days + 1 minute before start | Unit | accepted |
| Check-in exactly 7 days before start | Unit | accepted |
| Check-in 7 days + 1 second before start | Unit | rejected |
| Check-in after session start | Unit | rejected |
| Check-in linked to another student’s appointment | Unit + RLS | rejected |
| Retake creates a second linked assessment | Unit + RLS | allowed; latest wins |
| Completion with no check-in | Unit + E2E | blocked with `PSS10_REQUIRED` |
| Completion with valid check-in | Unit + E2E | succeeds |
| Completion with waiver reason | Unit + E2E | succeeds; audit row written |
| Waiver with reason under 10 chars | Unit | rejected |
| Legacy `pss10_required = false` | Unit | completion allowed without check-in |
| Student reschedules confirmed session 25 hours out | Unit + E2E | allowed |
| Student reschedules confirmed session 23 hours out | Unit + E2E | rejected |
| Analytics after multiple linked assessments | DB check | one latest assessment per appointment, no fan-out |

---

## 7. Rollout and rollback

1. Apply `00068` to local Supabase, run migrations, analytics check, RLS, and Playwright.
2. Apply to staging with explicit approval; verify columns, index, analytics, and one end-to-end completion.
3. Deploy web and mobile together; mobile builds tolerate the old schema by not using `pss10_required` until the migration is present.
4. Rollback: the migration is additive except for dropping the unique index. Re-adding the unique index would fail if retakes exist, so rollback must be a forward fix, not a blind down-migration.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Counselors use waivers routinely | Show waiver count/status to the head; require a reason; review in audit logs |
| Students miss the 7-day window | Sessions card CTA + existing reminder path; no new sensitive notification content |
| Analytics fan-out after dropping the unique index | Recreate the summary view with a latest-row lateral join |
| Completion blocked during an emergency | Waiver path is always available to the counselor |
| Legacy sessions blocked after deploy | `pss10_required = false` for already-confirmed rows |
| More mobile work than expected | Mobile UI is a status + CTA change; shared logic owns validation |

---

## 9. Report wording (applied 24 October 2026)

**Before:**

> PSS-10 gate is 30-day freshness at booking, not literally before every session.

**After (now in `Objective_Achievement_Report.md`):**

> A PSS-10 is required within 30 days at booking and again within 7 days before each session. The session check-in is linked to the appointment and enforced at counselor completion; exceptions require an audited waiver reason. Students may reschedule confirmed sessions until 24 hours before the start.

**Verdict change:** Objective 2 moved from **Substantially achieved** to **Fully achieved** after:
- the migration applied in CI against local Supabase;
- unit, RLS, and Playwright tests passed;
- the report cited the run ID and reproduce commands;
- the confirmed-reschedule restriction was removed under the 24-hour policy.

---

## 10. Approval checklist

- [x] 7-day pre-session window approved.
- [x] Completion enforcement with audited waiver approved.
- [x] 24-hour confirmed-reschedule cutoff approved.
- [x] `00068` schema change (drop unique index, add three columns) approved.
- [x] Implementation scheduled.

---

## 11. Progress log

| Date | Phase | Status | Evidence |
|---|---|---|---|
| 2026-10-24 | Plan | Recommended direction, not implemented | this document |
| 2026-10-24 | P2.0–P2.4 | Implemented and pushed (`418c6e1`, `2fdbfaa`); migration `00068`, shared gate/waiver, mobile CTA, web waiver dialog, confirmed reschedule | unit 66 passed; RLS retake/cross-student-link cases passed; Playwright 5/5 (waiver path); web/mobile typecheck; web build; Prisma validate |
| 2026-10-24 | P2.5 | Report and plan updated | `Objective_Achievement_Report.md` §1.6 P2 block, §3.1, Objective 2; CI evidence run **#40061770680** |
