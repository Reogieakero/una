# Objectives 4 and 5 — Substantially → Fully Achieved Closure Plan

**Status:** Implemented; evidence-only work remains
**Created:** 24 October 2026
**Scope:** Counselor student record / session documentation (Objective 4) and the analytics module (Objective 5)
**Companion documents:** `objective-4-5-records-analytics-plan.md` (implementation plan), `Objective_Achievement_Report.md` §1.8 and §3
**Identity constraint:** alias-only model from `supabase/migrations/00069_identity_rls_hardening.sql` is unchanged

---

## 1. Why this document exists

`Objective_Achievement_Report.md` §1.2 still shows Objectives 4 and 5 as **Substantially achieved**.
That table is stale: the detailed sections (§1.8, §3.1, §4 Objective 4/5, §10) record both as
**Fully achieved** and cite the shipped implementation. The headline table is corrected in the same
commit as this plan.

This document does two things:

1. States exactly what “fully achieved” means for each objective.
2. Maps every former gap to its implementation, evidence, and **remaining verification step**.

It does not re-open scope. Predictive modelling and email delivery stay out of scope by decision.

---

## 2. Definition of done

From `objective-4-5-records-analytics-plan.md` §6, both objectives are fully achieved when:

### Objective 4 — counselor dashboard, records, notes

| # | Criterion | State |
|---|---|---|
| 4.1 | One alias-only student record consolidates sessions, referrals, screenings, feedback, notes, follow-ups | **Implemented** |
| 4.2 | Structured notes save, render, and stay backward compatible with freeform notes | **Implemented** |
| 4.3 | Caseload/oversight scoping is covered by RLS tests | **Tests written, not executed locally** |
| 4.4 | A browser flow proves the record and note path | **Spec written, not executed locally** |
| 4.5 | No identity regression (`student_no`, contact, name, email never returned) | **Implemented + asserted in tests** |

### Objective 5 — analytics

| # | Criterion | State |
|---|---|---|
| 5.1 | Reports show longitudinal and cohort stress trends | **Implemented** |
| 5.2 | Data-quality indicators are visible and actionable | **Implemented** |
| 5.3 | Small-cell suppression is enforced in UI and exports | **Implemented + unit-tested** |
| 5.4 | Scheduled delivery is implemented or explicitly reclassified | **Implemented (in-app digest)** |
| 5.5 | Predictive analytics explicitly scoped out or delivered separately | **Scoped out in writing** |

The verdict is already supportable. The only work left is **reproducible evidence**, not features.

---

## 3. Objective 4 — closure matrix

| Former gap | Implementation | File(s) | Evidence |
|---|---|---|---|
| No single student record | Alias-only record page with header, KPI strip, month-grouped timeline, filter chips, scope badge | `apps/web/app/(staff)/students/[id]/page.tsx`, `components/students/StudentRecordView.tsx`, `lib/hooks/use-student-record.ts` | Playwright head spec follows an alias from `/students` |
| Record read could leak identity | `get_student_record`, `get_student_record_counts`, `get_student_timeline` gate on `can_access_student()` and return alias/program/year/college only | `supabase/migrations/00070_student_record.sql` | RLS test asserts no `student_no`, `contact_no`, `profile_id` keys |
| Case file is per-session only | Timeline merges sessions, referrals, screenings, feedback, notes, follow-ups | `00070` | RLS test asserts session rows present |
| Note content could leak into bulk payload | Timeline returns `note_id`/`appointment_id` only; text is fetched per session through `/api/session-notes` | `00070`, record view | RLS test asserts note text absent; page opens the modal only on click |
| Notes are freeform only | Backward-compatible S.O.A.P. columns + modal toggle and four sections; composed text still fills `content` | `00070`, `SessionNotesModal.tsx`, `extra.schema.ts`, `api/session-notes/route.ts`, `use-session-notes.ts` | Typecheck/build; modal validation; API refinement |
| Counselors must hunt across pages | Navigation from directory, appointment detail, session detail | `StudentTable.tsx`, `AppointmentDetailModal.tsx`, `session-detail.tsx` | Build + Playwright |
| No verification for record scoping | RLS and Playwright cases | `tests/rls/rls.test.ts`, `e2e/specs/head.spec.ts` | **Pending execution** |

---

## 4. Objective 5 — closure matrix

| Former gap | Implementation | File(s) | Evidence |
|---|---|---|---|
| Aggregate snapshots only | Daily wellbeing trend (volume, band mix, average) and cohort stress by program/year/college | `00071_analytics_trends_quality.sql`, `head-reports-view.tsx`, `lib/reports-scope.ts` | RPC returns rows; build |
| No cohort selector | `?group=program\|year_level\|college` allowlist drives the RPC | `reports/page.tsx`, `use-head-reports.ts`, `api/reports/head/route.ts` | Typecheck/build |
| No data-quality indicators | Missing notes, unlinked screenings, unassigned referrals, feedback coverage, summary age | `head_data_quality()`, Data quality panel | RPC verified live |
| Small-cell risk | `MIN_CELL = 5`; band cells and cohort denominators below 5 withheld; percentages withheld | `packages/shared-services/src/analytics/suppression.ts` (web re-export), route, head/counselor views, workbook sheets | 3 unit tests at 0/1/4/5/6 boundaries |
| No scheduled delivery | In-app daily digest stored in `report_digests`, shown on `/reports` | `api/reports/digest/cron/route.ts`, `vercel.json`, `report_digests` | Table and RPC verified live |
| Predictive ambiguity | Explicitly out of scope: objective asks for trends, not individual risk prediction | Report §1.8/§4 | Written decision |
| Export could re-introduce suppressed cells | “Quality & trends” sheet + suppression in the wellbeing sheet total | `lib/reports/sheets/quality.ts`, `sheets/wellbeing.ts`, `workbook.ts` | Build |

---

## 5. Evidence runbook

Run from the repository root. Steps 1–3 need no external services.

```bash
# 1. Unit — includes suppression boundary tests
pnpm --filter @dorsu/shared-services test      # expect 69 passed

# 2. Types
pnpm --filter @dorsu/web typecheck
pnpm --filter @dorsu/mobile typecheck

# 3. Production build (routes must include /students/[id] and the digest cron)
pnpm --filter @dorsu/web build
```

Steps 4–5 need a disposable local Supabase stack (Docker or WSL).

```bash
# 4. RLS integration
supabase start
supabase db reset
export TEST_SUPABASE_URL=http://127.0.0.1:54321
export TEST_SUPABASE_ANON_KEY=...
export TEST_SUPABASE_SERVICE_ROLE_KEY=...
pnpm --filter @dorsu/rls-tests test:rls
# must report tests run, not "skipped"

# 5. Browser smoke
pnpm --filter @dorsu/e2e exec playwright install chromium
pnpm e2e
```

Never point `TEST_SUPABASE_*` at staging or production: the suites create and delete users and rows.

### Migration / object verification (read-only, safe against the linked project)

The linked project already returns 200 for `report_digests`, `session_notes(note_format)`,
`head_data_quality()`, and `head_wellbeing_trends(null, null)`. Re-run the same service-role check
after any migration change.

### Type regeneration

`pnpm db:types` requires outbound Postgres port 5432 or `SUPABASE_ACCESS_TOKEN`. Both are blocked on
the current workstation, so `packages/shared-types/src/database.ts` stays hand-synced. This is a
tooling limitation, not a schema gap; typecheck and build pass against the hand-synced file.

---

## 6. Open blockers and options

| Blocker | Effect | Options |
|---|---|---|
| Docker Desktop / WSL not installed | RLS + Playwright cannot run locally | Install Docker + Supabase CLI; or run on a machine that has them; or rely on CI |
| Outbound port 5432 blocked | `supabase gen types --db-url` fails | Provide `SUPABASE_ACCESS_TOKEN` for the Management API path, or keep hand-synced types |
| No CI run recorded for this commit | RLS/Playwright evidence is source-only | Push and confirm the CI `rls` and `e2e` jobs are green, then paste the run id into the report |

---

## 7. Acceptance checklist

- [x] `00070` and `00071` objects verified live on the linked project
- [x] Structured-note fields persisted and returned by the API
- [x] Record page alias-only, month-grouped, filterable, linked from three entry points
- [x] Trends, cohort selector, data quality, digest, and suppression shipped
- [x] Unit suite green (69/69), web typecheck green, production build green
- [ ] RLS suite executed and green (needs local stack or CI)
- [ ] Playwright suite executed and green (needs local stack or CI)
- [ ] CI run id recorded in `Objective_Achievement_Report.md` §1.8
- [ ] `database.ts` regenerated when DB access or an access token is available

Closing the last four boxes changes evidence, not code, and does not change the architecture.

---

## 8. Effort

| Work | Effort |
|---|---|
| Steps 1–3 (already run) | ~5 minutes |
| Local Supabase + RLS + Playwright, once Docker exists | 20–40 minutes |
| CI verification and report update | 10 minutes |
| Type regeneration, once 5432 or a token is available | 2 minutes |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Stale headline table contradicts the body | Corrected alongside this plan (§1.2) |
| Suppression applied inconsistently | Single shared helper, unit-tested, used by route, both views, and workbook |
| Identity regression in the record page | RPC returns alias-level fields only; RLS test asserts field absence |
| Note text leaking into aggregates | Timeline carries metadata only; digest excludes notes |
| Migration drift | Objects rechecked via service role; record migration number in the report |
| Scope creep into prediction | Written out-of-scope decision retained |

---

## 10. Out of scope (unchanged)

- Predictive/individual risk scoring.
- Email or SMS digest delivery.
- Cryptographic anonymity.
- Participant usability study (Objective 11).
- Google Meet API integration (Objective 8).
