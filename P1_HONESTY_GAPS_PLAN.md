# P1 — Close the Honesty Gaps (Plan)

**Project:** DOrSU Guidance / Chekie (`una`)
**Scope:** The P1 recommendations from `Objective_Achievement_Report.md` §8
**Status:** In progress — P1.1 and P1.2 implemented, pending commit/verification
**Date:** 24 October 2026
**Precondition:** P0 is complete on staging (`00059`, `00061`, `00067`; E1 concurrency passes). See report §1.5.

> This is a plan, not a claim. The P1 items are a mix of code work, test infrastructure, and **human-run research**. The research cannot be completed by an agent alone.

---

## 1. What P1 actually is

The report defines four P1 items:

1. Replace residual mobile mock data.
2. Add automated tests.
3. Run a usability and accessibility study.
4. Decide what “event management” means.

P1 is **not** “make every objective fully achieved.” It is the smallest set of work that removes the report’s honesty caveats and makes the capstone claims defensible.

### P1 exit criterion

A reader can verify every remaining objective claim from **reproducible evidence**, not from source-code reading alone:

- no user-facing mobile identity or PSS-10 text comes from `data/mock.ts`;
- unit tests run locally and in CI;
- one E2E smoke path per role exists;
- the P0 concurrency test is part of a scheduled/manual CI job;
- a usability/accessibility report exists with real participants and fixes for high-severity findings;
- the “events” objective is either implemented or honestly renamed.

### Objective traceability matrix

Every P1 task must name the objective it protects. If a task cannot, it is out of scope.

| # | Objective (short) | Current verdict | P1 workstream | Evidence P1 produces |
|---:|---|---|---|---|
| 1 | User-friendly mobile + web interfaces | Substantially achieved | P1-A, P1-C, P1-D | Mobile typecheck; role E2E paths; task success/time/SUS; WCAG findings |
| 2 | Booking, reschedule, cancel + PSS-10 before sessions | Substantially achieved | P0 (done), P1-A, P1-B, P1-C | Shared PSS instrument; scoring/freshness/`23P01` unit tests; student booking E2E; P0 concurrency evidence retained |
| 3 | Secure anonymous identity | Substantially achieved | P1-B, P1-C | RLS integration tests for cross-student access; student/counselor E2E paths; alias checks |
| 4 | Counselor dashboard: schedules, records, notes | Substantially achieved | P1-B, P1-C, P1-D | RBAC tests; counselor confirm → complete → note E2E; usability findings |
| 5 | Analytics: data, stress trends, reports | Substantially achieved | P0 (done), P1-B, P1-C | Report RPCs verified in P0; analytics query tests; head report E2E with populated sections |
| 6 | Real-time chat | Fully achieved | Regression guard only | Existing realtime perf evidence remains the primary proof; no P1 feature change |
| 7 | Announcement management (renamed from events) | Fully achieved for renamed scope | P1-E (done) | Decision record `docs/objective-7-announcement-scope.md`; no events MVP; report wording updated |
| 8 | Google Meet link | Partially achieved | P1-B (validation test only) | `isMeetUrl()` unit tests; feature scope remains P2 |
| 9 | Break-glass emergency access + audit | Fully achieved | P1-B | Audit/RLS tests proving append-only logs and role boundaries |
| 10 | Faculty referral feature | Fully achieved | P1-B, P1-C | Referral transition unit tests; faculty referral E2E; head assignment path |
| 11 | ISO/IEC 25010 evaluation | Partially achieved | P1-B, P1-C, P1-D, P1-F | CI artifacts, E2E results, usability/SUS/WCAG report, updated ISO 25010 table |

**How to read this**

- P1 does **not** re-implement Objectives 6, 9, or 10. They are already fully achieved; P1 only adds regression evidence where cheap.
- P1-A and P1-B are **enabling** work: they make Objectives 1, 2, and 11 verifiable.
- P1-D is the only direct evidence for the usability half of Objective 11 and the “non-technical users” lens in Objective 1.
- Objective 8 remains P2. Adding a validation test does not make Google Meet integration complete.
- Objective 7 is a **scope-honesty** decision, not a hidden feature build.

---

## 2. Current state (verified before planning)

| Area | Reality | Evidence |
|---|---|---|
| Mobile profile | **Already live** — reads `profiles` and `students`, uploads avatars, shares opt-in | `apps/mobile/app/(tabs)/profile.tsx`, lines 52–90 |
| Mobile README | **Stale** — still says profile is mock | `apps/mobile/README.md`, lines 57, 81–84, 102, 113 |
| PSS-10 text | **Still mock** — questions, labels, reverse indexes in `data/mock.ts` | `apps/mobile/data/mock.ts`, lines 105–123; used by `apps/mobile/app/check-in.tsx`, line 14 |
| PSS-10 scoring | Real and pure | `packages/shared-services/src/assessments/pss10-scoring.ts` |
| Test runner | **None** | no `*.test.*`, no Vitest/Jest config |
| CI | **None** | no `.github/workflows/` |
| Playwright | Only in the separate `perf-tests` npm project | `perf-tests/package.json` |
| Events | Announcements only; no calendar, venue, RSVP, attendance | `/announcements`, no `events` table |
| Next migration number | `00068` | latest is `00067_fix_slot_overlap_guard.sql` |

**Consequence:** P1-A is smaller than the report implies. Do **not** rebuild the profile screen. Fix the stale documentation, move the PSS-10 instrument to a shared source, and remove only dead mock exports.

---

## 3. Workstreams

### P1-A — Mobile data truth

**Goal:** no user-facing identity or PSS-10 text is local fake data.

#### A1. Create one shared PSS-10 instrument

Add `packages/shared-services/src/assessments/pss10-instrument.ts`:

- `PSS10_ITEMS`: the 10 item stems, in order, with stable ids.
- `PSS10_LABELS`: `Never` → `Very often`.
- `PSS10_REVERSE_INDEXES`: derived from the same order (currently `[3, 4, 6, 7]`).
- `PSS10_INSTRUCTIONS`: the short “last month” instruction in plain language.
- Keep scoring in `pss10-scoring.ts`; import the reverse indexes from the instrument so the two cannot drift.

Export from `packages/shared-services/src/index.ts`.

**Important:** the wording is a validated instrument. Do not paraphrase it during the move. If the project does not own a licensed copy of the PSS-10 wording, record that as a scope/legal note rather than inventing text.

#### A2. Rewire mobile check-in

- `apps/mobile/app/check-in.tsx`: import `PSS10_ITEMS` and `PSS10_LABELS` from `@dorsu/shared-services`.
- Delete `pssQuestions`, `pssLabels`, and `pssReverseIndexes` from `apps/mobile/data/mock.ts`.
- Keep all flow behavior unchanged: one question per screen, progress segments, no score shown to the student.

#### A3. Remove dead mock identity, fix README

- Confirm `student` from `data/mock.ts` is unused (profile already reads Supabase). Delete it if so.
- Do not delete `appointments`, `events`, `concerns`, `meetModes`, `days`, `timeSlots`, `counselorReplies`, `quickReplies`, or `stats` blindly — inventory imports first. Delete only exports with zero references.
- Update `apps/mobile/README.md`:
  - profile row → live data;
  - “still mocked” section → only genuinely remaining items;
  - project-structure labels (`profile.tsx`, `mock.ts`) → accurate.

#### P1-A acceptance

- [ ] `grep` shows no PSS-10 item text outside the shared instrument (except tests/docs).
- [ ] `apps/mobile/data/mock.ts` contains no `student` identity and no `pss*` exports.
- [ ] `pnpm --filter @dorsu/mobile typecheck` passes.
- [ ] Manual smoke: login → profile shows real name/alias/photo; booking → check-in shows all 10 items and submits.

**Estimate:** 1–1.5 days.

---

### P1-B — Test foundation

**Goal:** fast, deterministic tests for domain rules, plus a CI gate.

There is no test runner. Adding one is a deliberate change; keep it small.

#### B1. Choose one runner

Recommended: **Vitest** in `packages/shared-services` because the highest-value logic is pure TypeScript and framework-free.

- Add `vitest` as a devDependency of `@dorsu/shared-services`.
- Add `"test": "vitest run"` and `"test:watch": "vitest"`.
- Add a root `"test": "pnpm -r --if-present test"` script.
- Do **not** put Vitest in `apps/web` or `apps/mobile` for this phase; JSX/Expo test setup expands the surface.

#### B2. Unit tests (highest value first)

| Test | Target |
|---|---|
| PSS-10 scoring | `pss10-scoring.ts`: reverse items, total 0–40, bands, invalid answer counts |
| PSS-10 instrument integrity | 10 items, 5 labels, reverse indexes match scoring |
| Booking freshness | `booking-service.ts`: 29 days passes, 31 days fails, no assessment fails |
| Booking idempotency | duplicate key returns the existing appointment, does not insert twice |
| `23P01` mapping | `confirmAppointment` converts the DB race error to “That time was just taken…” |
| Meet URL validation | `isMeetUrl()` valid/invalid cases |
| RBAC | `routePolicy` / `actionPolicy` / `canPerform` for every role, especially `admin` and `guidance_personnel` |
| Referral transitions | pure transition guards: assign → confirm → resolve/escalate/reject |

Use fake `DbClient` objects rather than a live database for these tests.

#### B3. RLS integration tests

These need a database. Options, in order of preference:

1. **Local Supabase** (`supabase start`) on CI, seeded with minimal test users.
2. A dedicated non-production test project with secrets in CI.

Assert at minimum:

- a student cannot read another student's `appointments`, `pss10_assessments`, or `session_notes`;
- a counselor cannot read an unrelated student's notes;
- the assigned counselor and head can read what policy allows;
- `audit_logs` are append-only for authenticated users;
- anonymous aliases do not leak into staff reads that should not see them.

If neither database option is available, mark these as `describe.skip` unless `TEST_DATABASE_URL` is set. Do not fake RLS with mocks.

#### B4. CI

Create `.github/workflows/ci.yml`:

- trigger: `pull_request` and push to `main`;
- job `verify`: install → typecheck (web + mobile + shared) → unit tests → web build;
- no database secrets in the PR job;
- a second job `schema-staging`, trigger `workflow_dispatch` and a nightly schedule:
  - runs `node perf-tests/check-schema.mjs` with staging secrets;
  - runs `node perf-tests/concurrency-slots.mjs`;
  - uploads `perf-tests/results/concurrency.json` as an artifact.

Why split: the concurrency test writes and cancels rows. It must not run on every pull request against shared staging.

#### P1-B acceptance

- [ ] `pnpm test` passes locally.
- [ ] PR CI is green and blocks on failing tests.
- [ ] The scheduled/manual job covers the P0 concurrency case and stores evidence.
- [ ] RLS tests either run against a real database or skip explicitly with a logged reason.

**Estimate:** 2–3 days, plus CI iteration.

---

### P1-C — End-to-end smoke per role

**Goal:** prove the main workflow is reachable through the real UI, not just unit-tested.

#### C1. Isolated Playwright project

Recommended: a root workspace package `e2e/` (`@dorsu/e2e`) using `@playwright/test`.

Why not reuse `perf-tests`? That project is a measurement sandbox with its own lockfile and npm workflow. Mixing regression assertions into it makes both roles worse.

#### C2. Four smoke paths

| Role | Path |
|---|---|
| Student | login → book → PSS-10 → appointment appears in sessions |
| Counselor | login → assigned appointment → confirm → complete → write note |
| Faculty | login → refer student → referral appears for head |
| Head | login → assign referral → reports page loads with RPC data |

One spec per role, one worker, deterministic seed accounts. Use a dedicated E2E seed file, not the performance manifest.

#### C3. Data hygiene

- E2E must create uniquely tagged rows and clean them up.
- Never assert on real student names or note content.
- Fail the run if a secret or PHI appears in logs/artifacts.
- Prefer local Supabase + `next start` for PR runs; staging smoke only on schedule/manual.

#### P1-C acceptance

- [ ] `pnpm e2e` runs four specs locally.
- [ ] PR CI runs them against local Supabase (or a dedicated test project).
- [ ] Artifacts on failure contain traces/screenshots, no secrets.
- [ ] The head report spec asserts populated sections, not just HTTP 200.

**Estimate:** 2–3 days.

---

### P1-D — Usability and accessibility study (human-run)

**Goal:** replace heuristic UX claims with measured results.

This workstream needs real participants and a facilitator. The agent can prepare materials, run automated accessibility checks, fix findings, and write the report; it cannot be the study participant.

#### D1. Protocol

- **Participants:** 5–8 per role (student, counselor, faculty, head). If time is short, prioritize students and counselors.
- **Tasks:**
  - student: book a session, find a session, reschedule/cancel, take check-in;
  - counselor: confirm, complete, write note, find referral;
  - faculty: submit a referral;
  - head: assign a referral, read the weekly report.
- **Metrics:** task success, time on task, errors, assistance needed, SUS (10-item), one open question.
- **Consent:** explain that no real counseling data is used; use seeded accounts.

#### D2. Accessibility audit (WCAG 2.1 AA)

Run against web and mobile-web where possible:

- automated: axe DevTools / Lighthouse;
- keyboard-only: focus order, visible focus, no traps, dialogs restore focus;
- screen reader: NVDA on Windows and VoiceOver on iOS for the student flow;
- contrast: all text and status chips;
- text scaling: 200% browser zoom and mobile font scaling;
- forms: labels, error identification, required-field cues;
- motion: reduced-motion behavior.

#### D3. Fix and document

- Fix all high-severity blockers found (unreachable action, missing label, keyboard trap, contrast failure).
- Write `docs/p1-usability-accessibility-report.md`: method, participants, task results, SUS, WCAG findings, fixes, remaining issues.
- Update `Objective_Achievement_Report.md` Objective 11 and the ISO 25010 table with the measured evidence.

#### P1-D acceptance

- [ ] Study report exists with real participant counts and results.
- [ ] WCAG findings are listed with pass/fail/not-tested.
- [ ] High-severity issues are fixed or explicitly accepted with a reason.
- [ ] No claim of “fully accessible” or “ISO compliant” beyond what was tested.

**Estimate:** 1–2 weeks elapsed, mostly human scheduling; 2–4 days of agent/developer work.

---

### P1-E — Decide “event management”

This is a scope decision, not a coding task. Do it before P1-D so the UI is stable during usability testing.

**Option 1 — Rename honestly (decided, 24 October 2026)**

- Change the manuscript/objective wording from “event management” to “announcement management.”
- Document that announcements are one-to-many news posts with realtime updates, not events.
- Cost: documentation only.

**Option 2 — Build a minimal events MVP**

If the panel expects real events, the smallest defensible version is:

- migration `00068_events.sql`:
  - `events` (title, description, starts_at, ends_at, venue, online_link, capacity, status, created_by);
  - `event_rsvps` (event_id, student_id, status, unique pair);
  - RLS: students read published events and manage their own RSVP; head/admin manage events; counselors read published events;
  - indexes for upcoming events and RSVP counts;
- web: head event create/edit list + student-facing event list;
- mobile: events list + RSVP;
- reminders: extend the existing pg_cron reminder pattern (`00065`) or skip reminders in the MVP;
- E2E: create event → student RSVP → head sees count.

Do **not** call an announcement page “events” without calendar/date/venue/RSVP. That is the current honesty gap.

**Estimate:** 0 days for Option 1; 3–7 days for Option 2.

---

### P1-F — Consolidate the evidence

**Goal:** make the capstone report match reality.

- Update `Objective_Achievement_Report.md`:
  - Objective 2: concurrency evidence already updated in §1.5;
  - Objective 3/4/5: unchanged unless tests find defects;
  - Objective 7 (events): mark implemented or renamed;
  - Objective 11: replace “partially achieved” with the measured usability/accessibility evidence;
  - ISO 25010 table: cite test results, CI artifacts, and the study report.
- Add a short “How to reproduce” section with exact commands. *(Done — §1.6.)*
- Keep dated evidence; do not rewrite the original findings. *(Done — stale lines are struck through and annotated with the P1 resolution, not deleted.)*

**Estimate:** 0.5–1 day.

---

## 4. Recommended phasing

Dependencies matter more than raw effort.

| Phase | Work | Depends on | Estimate |
|---|---|---|---|
| **P1.0** | Decisions: event scope, test DB approach, study participants | — | 0.5 day |
| **P1.1** | Mobile data truth (P1-A) | P1.0 event decision (only if nav changes) | 1–1.5 days |
| **P1.2** | Unit tests + CI (P1-B1/B2/B4) | — (can run parallel with P1.1) | 1.5–2 days |
| **P1.3** | RLS integration tests (P1-B3) | P1.0 test DB choice | 1 day |
| **P1.4** | Playwright smoke (P1-C) | P1.2 CI + stable seed accounts | 2–3 days |
| **P1.5** | Events rename / scope note (P1-E Option 1) | P1.0 decision | 0 days (documentation) |
| **P1.6** | Usability + accessibility (P1-D) | UI frozen (P1.5 scope note done) | 2–4 dev days + 1–2 weeks elapsed |
| **P1.7** | Report consolidation (P1-F) | All evidence | 0.5–1 day |

**Critical path:** P1.0 → P1.1/P1.2 → P1.4 → P1.6 → P1.7.

**Realistic calendar:** 2–3 weeks if the usability sessions can be scheduled in parallel with engineering. Events Option 2 adds up to a week.

---

## 5. Acceptance checklist

- [x] PSS-10 instrument has one shared source; mobile imports it; mock exports removed.
- [x] Mobile profile is documented as live, not mock.
- [x] `pnpm test` runs unit tests locally and in PR CI.
- [x] RLS tests run against local Supabase in CI (and skip with a reason locally when env vars are absent).
- [x] Four role-based Playwright smoke specs pass (CI #39994834656).
- [ ] Nightly/manual CI runs `check:schema` and the P0 concurrency test and uploads evidence. *(Job exists; staging secrets not configured, so it has not run.)*
- [x] Event scope is decided: renamed to announcement management.
- [ ] Usability study report exists with participants, task metrics, SUS, and WCAG findings. *(Protocol/plan only; no participants yet.)*
- [ ] High-severity accessibility findings are fixed or accepted in writing. *(Blocked on the audit.)*
- [~] `Objective_Achievement_Report.md` and the ISO 25010 table cite the new evidence. *(P1 tests cited in §1.6; final ISO 25010 update awaits P1.6.)*
- [ ] Web and mobile typecheck/build pass; no secrets committed.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Moving PSS-10 text accidentally changes validated wording | Copy verbatim; add an integrity test for item count/order; review the diff manually |
| Test framework expands into JSX/Expo setup and stalls | Start with Vitest in `shared-services` only; add UI/E2E separately |
| CI concurrency test writes to shared staging on every PR | Run only on schedule/manual; tag and clean rows; keep `assertStaging()` |
| RLS tests give false confidence through mocks | Use a real database; skip explicitly if unavailable; never mock RLS |
| Playwright tests are flaky | Dedicated seed accounts, unique data tags, one worker, retries only on CI |
| Usability study is rushed or unrepresentative | Pre-register tasks/metrics; record participant roles; report limitations |
| Events MVP balloons | Fixed MVP scope: no ticketing, no attendance hardware, no external calendar sync |
| P0 regression returns | Keep `check:schema` and concurrency in the scheduled CI job; never bypass the constraint |

---

## 7. Decisions (recorded 24 October 2026)

1. **Events — decided: rename to “announcement management.”** No `events` table or RSVP build in P1. Update the manuscript/objective wording and state the scope honestly. (Option 1 in P1-E.)
2. **Test database — decided: local Supabase in CI.** RLS integration tests use `supabase start`; no shared-staging writes for integration tests. Concurrency/schema checks remain the separate scheduled/manual staging job.
3. **Usability participants:** who recruits the 5–8 users per role, and what is the target date? *(still open)*
4. **PSS-10 licensing/wording:** does the project have the validated PSS-10 item wording and permission to reproduce it? If not, that is a manuscript/legal note, not a coding problem. *(still open)*
5. **CI provider:** GitHub Actions is assumed (repo is on GitHub); confirm it is enabled and staging secrets can be stored. *(to verify during P1-B)*

---

## 8. Deliverables

- `packages/shared-services/src/assessments/pss10-instrument.ts`
- Updated `apps/mobile/app/check-in.tsx` and `apps/mobile/data/mock.ts`
- Corrected `apps/mobile/README.md`
- Vitest config + `packages/shared-services/src/**/*.test.ts`
- `.github/workflows/ci.yml`
- `e2e/` Playwright workspace + four role specs
- `docs/p1-usability-accessibility-report.md`
- Migration `00068_events.sql` (only if Option 2)
- Updated `Objective_Achievement_Report.md`
- One or more commits pushed to `origin/main`

---

*End of P1 plan.*

---

## 9. Implementation progress

Updated 24 October 2026.

- [x] **P1.1 — Mobile data truth:** PSS-10 content moved to `packages/shared-services/src/assessments/pss10-instrument.ts`; scoring imports the same reverse indexes; `apps/mobile/app/check-in.tsx` uses the shared instrument; `apps/mobile/data/mock.ts` removed; mobile README corrected; licence/provenance note added at `docs/pss10-license-note.md`.
- [x] **P1.2 — Unit test foundation:** Vitest added to `@dorsu/shared-services`; 41 tests cover instrument integrity, scoring/bands, PSS-10 freshness, booking gate/idempotency/`23P01`, confirm `23P01` mapping, Meet URL validation, and RBAC.
- [x] **P1.2 — CI:** `.github/workflows/ci.yml` runs typecheck, unit tests, and web build on PRs; a scheduled/manual job runs staging `check:schema` + P0 concurrency when staging secrets exist.
- [x] **P1.3 — RLS integration tests:** `tests/rls` has 8 cases covering cross-student appointment/PSS/profile isolation, cross-role insert denial, counselor note isolation with head oversight, self-promotion blocking, audit read scope + append-only behavior, and notification content minimization. CI job starts local Supabase, applies all migrations, runs the suite, and stops the stack. First green run: `CI` #39990715576 (RLS job 3m19s).
- [x] **P1.4 — Role-based E2E:** `e2e/` (Playwright, 4 specs) seeds one account per role plus a past confirmed session, pending referral, and PSS-10 row, then asserts the student route boundary, counselor Complete → session-note save, faculty referral history + form modal, and head referral board + populated report KPIs/sections. CI job builds the web app against local Supabase and uploads traces/screenshots on every run. Green run: `CI` #39994834656 (e2e job 4m48s, 4/4 specs).
- [x] **P1.5 — Event scope note:** Objective 7 is renamed to **announcement management**. Decision record at `docs/objective-7-announcement-scope.md`; `Objective_Achievement_Report.md` uses the new wording, marks the renamed scope fully achieved, and lists calendar/RSVP/attendance as explicitly out of scope. No events MVP was built.
- [ ] **P1.6 — Usability/accessibility study:** not started (human-dependent).
- [~] **P1.7 — Report consolidation (interim complete):** `Objective_Achievement_Report.md` now has a dated §1.6 P1 evidence table with CI run IDs and reproduce commands. Stale review-time claims were annotated rather than deleted (preserving the original findings): mobile mock data, PSS-10 wording, missing automated tests, note authorization, booking tests, Objective 7 events, and the Objective 11 evidence row. The ISO 25010 table now cites the P1 tests while keeping the usability score provisional. **Remaining for final completion:** the P1.6 usability/accessibility results and the final ISO 25010 table.

**Local verification for P1.1/P1.2/P1.3/P1.4:** `pnpm test` (41 passed), shared-services/mobile/web typecheck, web production build, `pnpm --filter @dorsu/rls-tests exec tsc --noEmit`, and `pnpm --filter @dorsu/e2e exec tsc --noEmit` all pass. The RLS suite runs in CI against local Supabase; locally it skips cleanly when the three `TEST_SUPABASE_*` variables are absent. The Playwright suite runs in CI against local Supabase and is excluded from `pnpm test`; locally `pnpm e2e` needs the same variables plus a built web app. Staging guard secrets still need configuration before the scheduled job exercises staging.
