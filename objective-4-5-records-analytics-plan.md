# Objectives 4 and 5 — Student Records and Analytics Plan

**Status:** Implemented — 24 October 2026 (see `Objective_Achievement_Report.md` §1.8)
**Scope:** Counselor student-record timeline, structured session notes, longitudinal/cohort analytics, data-quality indicators, and small-cell suppression
**Objectives affected:** Objective 4 (counselor dashboard, student records, session documentation) and Objective 5 (analytics module)
**Verdict target:** Fully achieved for both objectives, subject to the scope decisions in §7
**Identity constraint:** All new reads must preserve the alias-only model established by `supabase/migrations/00069_identity_rls_hardening.sql`

---

## 1. Starting point

The achievement report currently records both objectives as **Substantially achieved**.

### Objective 4 gaps

1. There is no single student-record page that consolidates appointments, referrals, session notes, PSS-10 bands, feedback, and follow-ups into one longitudinal timeline.
2. Session documentation is per-session rather than a continuous case file.
3. Session notes are freeform text plus optional attachments; there is no structured note template.

### Objective 5 gaps

1. Reports are aggregate snapshots, not longitudinal or cohort stress-trend analysis.
2. There are no data-quality indicators (missing notes, unassigned referrals, stale summaries, feedback coverage).
3. Small-cell privacy risk is unmitigated; a group of one or two students can be inferred from aggregate output.
4. Report RPCs were verified on staging; production verification was historically missing and was closed on 2026-10-24.
5. Reports are viewed/exported on demand; there is no scheduled delivery.

### What is already working

- Appointment lifecycle, session notes (owner + head oversight), follow-ups, availability, and the counselor dashboard.
- Role-aware `/reports` for head, counselor, and faculty.
- Aggregate report sections: sessions trend, referral status/priority, pipeline health, satisfaction, PSS-10 bands, counselor workload, top concerns.
- Excel/print export.
- `analytics_daily_summary` view and report RPCs in `00061_phase3b_report_rpcs.sql`.

---

## 2. Security and privacy requirements

These are non-negotiable and apply to every phase.

1. **Alias-only default.** New RPCs must never return `students.student_no`, `students.contact_no`, student `profiles.full_name`, or student `profiles.email`.
2. **Caseload/oversight scoping.** Reuse `public.can_access_student(uuid)` or the same session/referral/chat relationship checks from `00069`. Counselors see only students on their caseload; head/admin keep oversight access.
3. **Notes stay need-to-know.** Session-note content is readable only by the owning counselor and head/admin. Bulk timeline payloads must not include note content.
4. **No clinical content in notifications or realtime payloads.** New notifications carry IDs, aliases, and aggregate metadata only.
5. **Aggregate-only analytics.** No per-student rows in analytics payloads or exports.
6. **Small-cell suppression.** Any aggregate cell with a count of 1–4 is suppressed (`<5`) and percentages with a denominator below 5 are withheld.
7. **No identity regression through navigation.** Record links use `students.id`; they must not add a student-number route, search, or resolver.
8. **Defense in depth.** Application-layer role checks plus RLS/RPC scoping. `SECURITY DEFINER` functions set `search_path = public` and gate on role explicitly.

---

## 3. Objective 4 — Student records and case documentation

### 3.1 Migration `00070_student_record.sql`

Add scoped read RPCs that reuse the `00069` access rules.

| RPC | Signature | Returns | Scope |
|---|---|---|---|
| `get_student_record` | `(p_student_id uuid)` | `id`, `anonymous_alias`, `program`, `year_level`, `college`, `created_at` | Counselor caseload; head/admin oversight |
| `get_student_record_counts` | `(p_student_id uuid)` | total sessions, completed sessions, open referrals, latest PSS-10 band, follow-ups due | Same |
| `get_student_timeline` | `(p_student_id uuid, p_limit int default 200)` | unified event rows (see below) | Counselor sees own sessions/referrals/notes; head/admin see all |

Timeline event shape:

```text
event_type   text    -- session | referral | screening | feedback | note | follow_up
event_id     uuid
occurred_at  timestamptz
status       text
label        text    -- non-identifying display label
band         text    -- screenings only
score        int     -- screenings only
rating       int     -- feedback only
note_id      uuid    -- notes only; content is never returned here
follow_up_at timestamptz
```

Scoping rules inside the RPC:

- **Counselor**
  - sessions where `appointments.counselor_id` is the caller's counselor row;
  - referrals where `referrals.assigned_counselor_id` is the caller;
  - screenings for students the caller has seen;
  - feedback on the caller's appointments;
  - notes owned by the caller.
- **Head/admin**
  - all rows for the student, including all notes for oversight.
- **Everyone else**
  - no rows.

Notes:
- `session_notes` is not currently indexed by student. Add a supporting index on `session_notes(appointment_id)` if it is not already present (it is created in `00009`), and rely on the appointment join.
- Consider a composite index on `appointments(student_id, scheduled_at)` if the timeline query plan shows a scan. `00058`/`00059` already added several performance indexes; confirm before adding.
- All statements idempotent (`create or replace`, `if not exists`).

### 3.2 Structured session notes

Add additive columns to `session_notes` in the same migration:

```sql
alter table public.session_notes
  add column if not exists note_format text not null default 'freeform'
    check (note_format in ('freeform', 'soap')),
  add column if not exists subjective text,
  add column if not exists objective text,
  add column if not exists assessment text,
  add column if not exists plan text;
```

Backward compatibility:
- Existing notes keep `note_format = 'freeform'`.
- `content` remains the composed plain-text version so exports, search, and older clients continue to work.
- New notes composed from S.O.A.P. sections set `content` to the joined section text.

Application changes:
- `packages/shared-schemas`: extend the session-note schema with `noteFormat` and the four optional sections; require at least one non-empty section when `noteFormat = 'soap'`.
- `apps/web/app/api/session-notes/route.ts`: validate, persist, and return the structured fields on POST and PATCH.
- `apps/web/lib/hooks/use-session-notes.ts`: extend `SessionNote` and `SaveSessionNoteInput`.
- `apps/web/components/appointments/SessionNotesModal.tsx`: add a Freeform / S.O.A.P. toggle, four labelled sections, and the existing follow-up controls. Preserve current freeform behavior.
- Do not log or notify note content.

### 3.3 Student record page

New files:

```text
apps/web/app/(staff)/students/[id]/page.tsx
apps/web/app/(staff)/students/[id]/loading.tsx
apps/web/components/students/StudentRecordView.tsx
apps/web/lib/hooks/use-student-record.ts
```

Page structure:

1. **Header** — alias, program/year/college, first-seen date, and a scope badge (“On my caseload” or “Oversight view”).
2. **KPI strip** — total/completed sessions, last session, open referrals, latest PSS-10 band, follow-ups due.
3. **Timeline** — grouped by month, with filter chips for All, Sessions, Referrals, Screenings, Notes, Feedback, Follow-ups.
4. **Session rows** — status, date/time, mode, concern, follow-up flag; link to `/appointments#focus-<id>`.
5. **Note rows** — “Note documented”, follow-up date, and an action to open the existing notes modal. Head/admin open it read-only; the owning counselor can edit.
6. **Screening rows** — band and total score only.
7. **Feedback rows** — rating and comment for the caller’s scope.
8. **States** — loading skeleton, empty, error, and “This student is not on your caseload.”

Data flow:
- `use-student-record.ts` calls the three RPCs in parallel via the browser Supabase client.
- Note content is fetched lazily through the existing `/api/session-notes` route only when a note is opened.
- Cache keyed by student ID; `keepPreviousData`; stale time consistent with other boards (~60 s).

Navigation wiring:
- `apps/web/components/students/StudentTable.tsx`: alias becomes a link to `/students/<id>`.
- Appointment detail: add “Open student record” when `student_id` exists.
- Session rows in `components/sessions/*`: optional link on the alias.
- Do not add a new route to `rbac.ts`; `/students` already covers the prefix and the page fails closed for other roles.

### 3.4 Objective 4 verification

- RLS tests:
  - counselor A cannot load counselor B's student record;
  - head can load any record;
  - timeline note rows are scoped to note ownership;
  - payload contains no `student_no`, `profile_id`, name, or email.
- Playwright:
  - open `/students`, follow an alias, assert the timeline renders sessions/referrals/screenings;
  - save a S.O.A.P. note and assert the headings persist after reload;
  - assert no seeded real name or student number appears on the record page.
- `pnpm --filter @dorsu/web typecheck`
- `pnpm --filter @dorsu/web build`
- Apply `00070` to the linked Supabase project and verify RPCs/columns.

**Estimated effort:** 3–4 days.

---

## 4. Objective 5 — Longitudinal analytics, quality, and privacy

### 4.1 Migration `00071_analytics_trends_quality.sql`

New aggregate RPCs. All are head-gated and return no student identifiers.

| RPC | Signature | Returns |
|---|---|---|
| `head_wellbeing_trends` | `(from_ts timestamptz, to_ts timestamptz)` | bucket `date`, screenings, low, moderate, high, `avg_score` |
| `head_cohort_stress` | `(from_ts timestamptz, to_ts timestamptz, group_by text)` | cohort key (program / year / college), screenings, high, `avg_score` |
| `head_data_quality` | `()` | completed sessions, completed without notes, screenings without appointment link, unassigned referrals, feedback coverage, summary freshness |
| `head_report_digest` | `(from_ts timestamptz, to_ts timestamptz)` | compact JSON snapshot for scheduled delivery |

Rules:
- Validate `group_by` against an allowlist; default to `program`.
- Use `analytics_daily_summary` where possible; compute missing-note and unassigned-referral counts from the base tables.
- `summary freshness` = `now() - max(day)` from the view.
- `SECURITY INVOKER` where RLS already scopes correctly; otherwise `SECURITY DEFINER` with an explicit `current_user_role() = 'guidance_head' or 'admin'` gate.
- Return `bigint`/`int` aggregates, never arrays of IDs.

### 4.2 Small-cell suppression

New helper `apps/web/lib/reports/suppression.ts`:

```text
MIN_CELL = 5
suppressCount(n)        -> n >= MIN_CELL ? String(n) : "<5"
suppressShare(part, n)  -> n >= MIN_CELL ? percentage : "—"
```

Apply:
- in `apps/web/app/api/reports/head/route.ts` before the payload is returned;
- in `apps/web/components/shared/head-reports-view.tsx` for any client-side bucket;
- in `apps/web/lib/reports/workbook.ts` and the sheet builders, so Excel cannot reintroduce a suppressed cell;
- in `apps/web/components/shared/counselor-reports-view.tsx` where the same risk exists for a counselor’s small caseload.

Document the rule in the report and in the in-product “What this report means” guide.

### 4.3 Reports UI

Extend `apps/web/lib/reports-scope.ts`:

```text
ReportSection  += "quality"
REPORT_SECTIONS += { key: "quality", label: "Data quality" }
```

New panels in `head-reports-view.tsx`:

1. **Wellbeing trend** — line chart of high-band share and average PSS-10 over the selected range. Explicit “signals, not diagnoses” copy stays.
2. **Cohort stress** — bars by program, year level, or college, with a selector. Suppressed cells show `<5`.
3. **Data quality** — cards for:
   - completed sessions without a note;
   - screenings not linked to an appointment;
   - referrals without an assigned counselor;
   - feedback coverage;
   - daily-summary freshness.
4. **What this report means** — a one-page plain-language guide covering band definitions, suppression, coverage, and the difference between trend and prediction.

Update the reports route to load the new RPCs only when the matching section is requested, keeping the existing section-gated parallel fetch pattern.

### 4.4 Excel/print export

- Add a “Data quality” sheet and a “Wellbeing trend” sheet.
- Reuse the same suppression helper.
- Keep the existing cover/summary sheets and scope behavior.
- Print view inherits the on-screen suppressed values.

### 4.5 Scheduled delivery

Choose one option before implementation.

| Option | Implementation | Effort | Notes |
|---|---|---|---|
| **A. In-app scheduled digest (recommended)** | `vercel.json` cron → `/api/reports/digest/cron`, guarded by `CRON_SECRET`; writes a `report_digests` row and notifies the head with a link to `/reports?range=30d&section=all` | ~1 day | No new vendor or secret beyond the existing cron secret |
| **B. Email delivery** | Add Resend (or equivalent), `RESEND_API_KEY`, `REPORT_FROM_EMAIL`; send a suppressed HTML digest to head emails | ~1–2 days | Needs vendor setup, deliverability testing, and secret management |
| **C. Reclassify as out of scope** | The objective requires report generation, not scheduled delivery; document the decision | ~0 | Lowest effort; must be stated honestly in the report |

If A is chosen, add:

```sql
create table if not exists public.report_digests (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_to uuid references public.profiles(id) on delete set null
);
```

with head/admin-only RLS and a “Last scheduled digest” panel on `/reports`.

### 4.6 Predictive analytics

The objective says “identifies student stress trends,” not “predicts risk.” Recommended position:

> Longitudinal and cohort trend analysis satisfies the objective. Predictive modeling is out of scope because it is not required by the wording, would need validated training data, and introduces additional privacy and fairness risk.

Document this in `Objective_Achievement_Report.md` when the verdict is updated. If a predictive model is genuinely required, treat it as a separate project with model validation, bias review, and a privacy impact assessment.

### 4.7 Objective 5 verification

- Unit tests:
  - suppression helper at boundaries (0, 1, 4, 5, 6);
  - trend bucketing and cohort grouping;
  - digest payload shape.
- RLS tests:
  - non-head cannot call the analytics RPCs;
  - head receives aggregates only and no student IDs.
- Playwright:
  - head opens `/reports?section=wellbeing`, sees the trend and cohort panels;
  - `/reports?section=quality` shows data-quality cards;
  - a small cohort renders `<5`, not the raw count.
- `pnpm --filter @dorsu/web typecheck`
- `pnpm --filter @dorsu/web build`
- Apply `00071` to the linked Supabase project and verify the RPCs.

**Estimated effort:** 2–3 days with option A; 3–4 days with email.

---

## 5. Implementation order

1. **Phase 0 — decisions.** Confirm the three choices in §7.
2. **Phase 1 — Objective 4 data layer.** `00070` RPCs + structured-note columns; apply and verify.
3. **Phase 2 — Objective 4 UI.** Record page, hook, navigation, structured-note modal.
4. **Phase 3 — Objective 4 evidence.** RLS + Playwright + typecheck/build.
5. **Phase 4 — Objective 5 data layer.** `00071` RPCs + suppression helper; apply and verify.
6. **Phase 5 — Objective 5 UI.** Trend, cohort, quality, guide, export.
7. **Phase 6 — delivery decision.** Implement option A/B or record option C.
8. **Phase 7 — documentation.** Update `Objective_Achievement_Report.md`, add a short analytics/privacy note if needed, and record migration deployment.

Phases 1–3 and 4–6 can run in parallel if two workstreams are available; they touch different migrations and mostly different UI files.

---

## 6. Verdict criteria

### Objective 4 → Fully achieved

- A single alias-only student record consolidates sessions, referrals, screenings, feedback, notes, and follow-ups.
- Structured notes are saved, rendered, and backward compatible with freeform notes.
- Caseload/oversight scoping is covered by RLS tests.
- A Playwright flow proves the record and note path.
- No identity regression.

### Objective 5 → Fully achieved

- Reports show longitudinal and cohort stress trends.
- Data-quality indicators are visible and actionable.
- Small-cell suppression is enforced in UI and exports.
- Scheduled delivery is implemented or explicitly reclassified with rationale.
- Predictive analytics is explicitly scoped out or delivered as a separate validated project.

---

## 7. Decisions required

| # | Decision | Recommended |
|---|---|---|
| 1 | Note structure | Full S.O.A.P. fields plus freeform compatibility |
| 2 | Scheduled delivery | In-app digest via cron (option A) |
| 3 | Predictive analytics | Reclassify as out of scope; descriptive/longitudinal trends satisfy the objective |

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Identity regression in the record page | Reuse `can_access_student`; no `student_no`/profile joins; add RLS tests asserting field absence |
| Note content leaking into the timeline payload or logs | Timeline returns `note_id` only; content fetched per-note through the existing owner/head route |
| RLS recursion or slow policies | `SECURITY DEFINER` helpers with `search_path = public`; explicit role branches; verify query plans |
| Suppression changes historical totals | Apply consistently to route, charts, and exports; document `k = 5` |
| Cron not configured | `CRON_SECRET` must be set in Vercel; cron route returns 503 when absent |
| Migration drift | Apply `00070`/`00071` to the linked project and run post-apply existence checks |
| Scope creep into predictive modeling | Treat it as a separate project; document the interpretation |

---

## 9. Files expected to change

### New

```text
supabase/migrations/00070_student_record.sql
supabase/migrations/00071_analytics_trends_quality.sql
apps/web/app/(staff)/students/[id]/page.tsx
apps/web/app/(staff)/students/[id]/loading.tsx
apps/web/components/students/StudentRecordView.tsx
apps/web/lib/hooks/use-student-record.ts
apps/web/lib/reports/suppression.ts
```

### Modified

```text
packages/shared-schemas/src/**            (session-note schema)
packages/shared-types/src/database.ts     (RPC + column types)
apps/web/app/api/session-notes/route.ts
apps/web/lib/hooks/use-session-notes.ts
apps/web/components/appointments/SessionNotesModal.tsx
apps/web/components/students/StudentTable.tsx
apps/web/components/shared/head-reports-view.tsx
apps/web/components/shared/counselor-reports-view.tsx
apps/web/app/api/reports/head/route.ts
apps/web/lib/reports-scope.ts
apps/web/lib/reports/workbook.ts
apps/web/lib/reports/sheets/**
vercel.json                               (only if scheduled delivery is chosen)
Objective_Achievement_Report.md
```

---

## 10. Out of scope

- Cryptographic anonymity or a zero-knowledge identity vault.
- Re-identifying analytics or per-student risk scoring.
- Predictive modeling without a separate validation and privacy review.
- Google Meet API integration (Objective 8).
- A formal usability study (Objective 11).
