# P0 — Web Correctness Plan

**Project:** DOrSU Guidance / Chekie (`una`)
**Scope:** P0 blockers only — slot-race concurrency and analytics/report migration drift
**Status:** Planned, not executed
**Date:** 24 October 2026
**Owner:** Web/backend implementation agent

> This document is a plan. No repository files, migrations, or database rows have been changed.
> To execute it, switch from Plan mode to the build agent.

---

## 1. Why P0 comes first

Two findings from `Objective_Achievement_Report.md` can invalidate otherwise-correct web work:

1. **The same-slot concurrency test failed.**
   - `perf-tests/results/concurrency.json` → E1: `confirmed: 50`, expected `1`, `pass: false`.
   - The intended guard is `no_counselor_overlap` in `supabase/migrations/00059_phase1_perf_indexes_slotguard.sql`.
   - That migration creates the constraint inside a `DO` block that catches **all** exceptions and only raises a notice. If overlapping rows exist, the constraint can be skipped permanently.
   - If the constraint is absent, a counselor can end up with 50 confirmed appointments in the same time window.

2. **The measured database was missing report RPCs.**
   - `perf-tests/results/explain.json` records:
     - `head_appointment_daily_counts(...) does not exist`
     - `head_referral_status_counts() does not exist`
   - Both are defined in `supabase/migrations/00061_phase3b_report_rpcs.sql`.
   - This may be staging drift rather than a code defect, but the head dashboard and `/reports` depend on those functions.

**P0 exit criterion:** both findings are either fixed and re-measured as passing, or definitively shown to be measurement-environment artifacts with reproducible evidence.

---

## 2. Non-goals

P0 does **not** include:

- the events/calendar module,
- Google Meet API integration,
- a PSS-10 per-session policy,
- a student case timeline,
- a full usability or accessibility study,
- broad UI redesign.

Those are Phase 2/3 work. P0 protects the correctness of what already exists.

---

## 3. Preconditions

Before any write:

- [ ] Confirm the target is the approved **staging** Supabase project (`xueqvjozlyayggsyfzsq`). `perf-tests/lib.mjs` already refuses writes to other hosts via `assertStaging()`.
- [ ] Confirm root `.env` contains `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Never print or commit these values.
- [ ] Confirm `perf-tests` dependencies are installed (`npm install` inside `perf-tests` if needed).
- [ ] Take/confirm a database backup before any cleanup of overlapping appointments.
- [ ] Get explicit approval for destructive cleanup (cancelling duplicate appointments).

---

## 4. Workstream A — Slot-race guard

### A1. Read-only diagnosis (no writes)

Run from `una/perf-tests`:

```powershell
node check-db.mjs
```

Expected output includes the `no_counselor_overlap` constraint and the three helpers/RPCs. If the constraint is missing, continue to A2.

Additional read-only SQL to run through the existing direct-Postgres helper:

```sql
-- Is the constraint present and validated?
select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'no_counselor_overlap';

-- Which active appointments overlap per counselor?
select
  counselor_id,
  tstzrange(scheduled_at, coalesce(ends_at, scheduled_at + interval '1 hour')) as window,
  count(*) over (
    partition by counselor_id
    order by scheduled_at
    range between interval '1 hour' preceding and current row
  ) as nearby
from public.appointments
where counselor_id is not null
  and status in ('assigned', 'confirmed')
order by counselor_id, scheduled_at;
```

A more precise overlap query:

```sql
select a.id as a_id, b.id as b_id, a.counselor_id,
       a.scheduled_at as a_start, a.ends_at as a_end,
       b.scheduled_at as b_start, b.ends_at as b_end,
       a.status as a_status, b.status as b_status
from public.appointments a
join public.appointments b
  on a.counselor_id = b.counselor_id
 and a.id < b.id
 and a.status in ('assigned','confirmed')
 and b.status in ('assigned','confirmed')
 and tstzrange(a.scheduled_at, coalesce(a.ends_at, a.scheduled_at + interval '1 hour'))
     && tstzrange(b.scheduled_at, coalesce(b.ends_at, b.scheduled_at + interval '1 hour'))
order by a.counselor_id, a.scheduled_at;
```

### A2. Decide cleanup policy

The migration must not guess which appointment to keep. Recommended policy:

1. For each overlapping group, keep the **earliest confirmed** appointment.
2. If none is confirmed, keep the **earliest assigned** appointment.
3. Cancel the rest with `status = 'cancelled'`.
4. Preserve an audit trail: append a short note to `concern` or insert into `audit_logs`, depending on the existing audit schema.

**Requires user approval before executing.** Alternative: do not auto-clean; fail the migration and manually resolve the listed rows.

### A3. Add migration `00067_fix_slot_overlap_guard.sql`

> Next free number is `00067` (`00066_profile_avatars.sql` already exists).

Required properties:

- Idempotent: safe to re-run.
- **Fail-loud:** if overlaps remain, raise an exception. Do not swallow it.
- Adds the constraint only if it does not already exist.
- Verifies `convalidated = true` after creation.
- Includes a comment explaining the 00059 failure mode.

Sketch:

```sql
-- 00067_fix_slot_overlap_guard.sql
-- Repair/verify the P12 slot guard. 00059 swallowed ADD CONSTRAINT errors,
-- so deployments with pre-existing overlaps could run without the guard.

begin;

-- 1) Optional, only after explicit approval: resolve overlaps.
--    Keep earliest confirmed, else earliest assigned, cancel the rest.
--    (Implementation to be written against the real audit schema.)

-- 2) Add the constraint without hiding failures.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'no_counselor_overlap'
  ) then
    alter table public.appointments
      add constraint no_counselor_overlap
      exclude using gist (
        counselor_id with =,
        tstzrange(scheduled_at, coalesce(ends_at, scheduled_at + interval '1 hour')) with &&
      )
      where (status in ('assigned', 'confirmed'));
  end if;
end
$$;

-- 3) Confirm it is valid.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'no_counselor_overlap' and convalidated
  ) then
    raise exception 'no_counselor_overlap is missing or not validated';
  end if;
end
$$;

commit;
```

If a transaction-wrapped `ALTER TABLE ... ADD CONSTRAINT` is used, ensure the exclusion constraint is not deferred in a way that hides conflicts.

### A4. App-level behavior check

`confirmAppointment()` in `packages/shared-services/src/appointments/mutations.ts` already maps Postgres `23P01` to:

> “That time was just taken — please pick another window.”

Confirm that this path is reached after the constraint is active. No app change should be needed unless the error is wrapped differently by PostgREST.

Check the direct update path used by `perf-tests/concurrency-slots.mjs` (`confirmOnce`): it updates each distinct row with `.eq("status","assigned")`. All 50 rows are distinct, so the only thing preventing 50 confirmations is the exclusion constraint. This confirms the fix belongs in the database, not in the test.

### A5. Re-run the concurrency test

From `una/perf-tests`:

```powershell
node concurrency-slots.mjs
```

**Acceptance:**

- E1: `confirmed === 1`, `success === 1`, `pass === true`.
- E1: the other 49 attempts fail with `23P01` (or a friendly equivalent).
- E2: `50/50` distinct-slot inserts still succeed.
- `results/concurrency.json` is overwritten with the passing evidence.

If E1 still fails, do **not** update the report. Capture the constraint definition and the failing rows.

---

## 5. Workstream B — Analytics/report RPC drift

### B1. Read-only check

From `una/perf-tests`:

```powershell
node check-rpc.mjs
node check-db.mjs
```

`check-rpc.mjs` calls:

- `head_appointment_daily_counts`
- `head_referral_status_counts`

**Acceptance:** both print `OK`, not a missing-function error.

### B2. Confirm migration state

Check whether `00061_phase3b_report_rpcs.sql` is applied. Use the project’s migration history (`supabase_migrations.schema_migrations`) or re-apply the migration in a controlled way.

Do **not** renumber existing migrations.

### B3. Verify both consumers

- `apps/web/app/api/dashboard/head/route.ts` — calls the RPCs.
- `apps/web/app/api/reports/head/route.ts` — report data.
- `apps/web/components/shared/head-reports-view.tsx` — expects report sections.

**Acceptance:**

- `/dashboard` (head) loads with no RPC error toast/console error.
- `/reports` (head) loads all sections for a date range.
- Head dashboard summary cards populate.

### B4. Add a regression check

Create a small read-only script, e.g. `perf-tests/check-schema.mjs`, that asserts:

- `no_counselor_overlap` exists and is validated,
- the two report RPCs exist,
- the booking/report indexes from `00059` exist.

Exit non-zero on failure.

Add to `perf-tests/package.json`:

```json
"check:schema": "node check-schema.mjs"
```

This is cheap and prevents silent drift.

---

## 6. Workstream C — Minimal regression protection

P0 does not require a full test framework, but it should not rely on a one-off manual run.

### C1. Schema regression

- `perf-tests/check-schema.mjs` (read-only, exits non-zero).
- Run it after every migration.

### C2. Concurrency regression

- Keep `concurrency-slots.mjs` as the executable acceptance test.
- Add a short note in `perf-tests/README` or the script header: “E1 must pass before deploying slot-related changes.”

### C3. Optional unit test for the error mapping

If a test runner is added later, cover:

- `isMeetUrl()` valid/invalid cases,
- `isPss10Fresh()` boundary cases,
- `confirmAppointment()` maps `23P01` to the friendly message.

Do not introduce a test framework in P0 unless approved; it expands the change surface.

---

## 7. Workstream D — Verification and rollout

### D1. Apply order

1. Backup.
2. Diagnose overlaps.
3. Get approval for cleanup (if any).
4. Apply `00067`.
5. Verify constraint.
6. Apply/verify `00061` if missing.
7. Run `check:schema`.
8. Run `concurrency-slots.mjs`.
9. Run web typecheck/lint/build.
10. Smoke test `/dashboard`, `/reports`, `/appointments`.

### D2. Commands

From `una`:

```powershell
pnpm --filter @dorsu/web typecheck
pnpm --filter @dorsu/web lint
pnpm --filter @dorsu/web build
```

From `una/perf-tests`:

```powershell
node check-db.mjs
node check-rpc.mjs
node check-schema.mjs
node concurrency-slots.mjs
```

### D3. Report update

Only after the evidence passes:

- Update the concurrency finding in `Objective_Achievement_Report.md` from “failed” to “passed,” with the new date and result.
- Update the analytics finding to “RPCs present and verified.”
- Keep a note that the original failure was real at the time and is now fixed.

Do not rewrite history to imply it never happened.

---

## 8. Acceptance Checklist

- [ ] Overlap diagnosis completed and documented.
- [ ] Cleanup policy approved (or no cleanup needed).
- [ ] `00067_fix_slot_overlap_guard.sql` created with fail-loud behavior.
- [ ] `no_counselor_overlap` exists and `convalidated = true`.
- [ ] E1 concurrency test passes: exactly 1 confirmed, 49 rejected.
- [ ] E2 concurrency test passes: 50/50 distinct inserts.
- [ ] `head_appointment_daily_counts` exists and returns data.
- [ ] `head_referral_status_counts` exists and returns data.
- [ ] Head dashboard and reports load without RPC errors.
- [ ] `check:schema` passes and exits non-zero on missing objects.
- [ ] Web typecheck, lint, and build pass.
- [ ] Report updated with new evidence and a dated note.
- [ ] Changes committed and pushed to `origin/main`.

---

## 9. Risks and rollback

| Risk | Mitigation |
|---|---|
| Cleanup cancels a legitimate appointment | Require approval; keep earliest confirmed; preserve audit trail; backup first |
| Constraint creation fails on existing overlaps | Fail loudly, list overlapping IDs, resolve manually, re-run |
| Migration applied to production instead of staging | Use `assertStaging()`; check DB host before writes |
| RPCs still missing after migration | Re-apply `00061`; verify `supabase_migrations` history |
| Concurrency test still fails | Do not proceed; inspect constraint and locks; capture rows |
| Report claim outruns evidence | Update only after the passing JSON is committed |

**Rollback:**

- Drop `no_counselor_overlap` only if it causes an unexpected outage, then restore from backup/policy.
- Restore cancelled appointments from the pre-migration backup if cleanup was wrong.
- Revert app changes with `git revert`; no app change is expected for P0.

---

## 10. Decisions needed before execution

1. **Cleanup policy:** auto-cancel duplicates (keep earliest confirmed), or fail the migration and resolve manually?
2. **Target environment:** confirm the approved staging ref is the only database to touch.
3. **Migration application method:** Supabase CLI (`supabase db push`), SQL editor, or direct `DIRECT_URL` execution?
4. **Test framework:** keep P0 to the existing perf scripts, or add a minimal runner now?

---

## 11. Expected deliverables

- `supabase/migrations/00067_fix_slot_overlap_guard.sql`
- `perf-tests/check-schema.mjs`
- `perf-tests/package.json` (`check:schema` script)
- Updated `perf-tests/results/concurrency.json` with E1 `pass: true`
- Updated `Objective_Achievement_Report.md` P0 findings
- One commit, pushed to `origin/main`

---

*End of P0 plan.*
