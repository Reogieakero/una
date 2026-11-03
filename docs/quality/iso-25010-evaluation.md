# ISO/IEC 25010 Evaluation

This document maps DCAS against the eight software-quality characteristics of **ISO/IEC 25010:2011**. It separates what the system was **designed for** from what has actually been **measured**, gives the method for every unmeasured row, and records the evidence that exists in the repository. It does not invent scores.

**Audience:** thesis panel, adviser, quality reviewer, and future testers.

**Model choice:** the repository does not cite the 2023 revision, so this evaluation uses the **2011 eight-characteristic model**. The 2023 revision adds Safety and renames some sub-characteristics; switching would require re-baselining every row.

**Rule:** a row is either **Measured** (with a dated artifact), **Partially measured** (some evidence, incomplete method), or **Not measured** (method and target given, result explicitly absent).

---

## 1. Evidence inventory

| Artifact | Location | What it supports |
|---|---|---|
| Unit tests | `packages/shared-services/src/**/*.test.ts` | 86 Vitest cases across 9 files |
| RLS integration tests | `tests/rls/rls.test.ts` | 14 cases against local Supabase |
| Browser journey tests | `e2e/specs/{student,counselor,faculty,head}.spec.ts` | 4 spec files, 6 tests |
| CI pipeline | `.github/workflows/ci.yml` | Typecheck, unit, web build, RLS, browser smoke, staging guards |
| Page performance | `perf-tests/results/pages.json`, `pages-throttled.json` | 20 runs + 3 warm-ups per page |
| Booking performance | `perf-tests/results/booking.json` | 20 runs + 3 warm-ups per booking mode |
| Mutation performance | `perf-tests/results/mutations.json` | 20 runs + 3 warm-ups per mutation |
| Concurrency | `perf-tests/results/concurrency.json` | 50 simultaneous confirms (E1), 50 idempotent bookings (E2) |
| Realtime | `perf-tests/results/realtime.json` | 50 message deliveries + reconnect |
| Query plans | `perf-tests/results/explain.json` | Slow-query plan capture |
| Usability protocol | `docs/ux/usability-accessibility-protocol.md` | Method only; **no participants run** |
| Security model | `docs/security/security-privacy.md`, `docs/security/anonymity-threat-model.md` | Controls and residual risks |
| Backup runbook | `docs/operations/backup-restore.md` | Recovery procedure; no drill record |

All performance numbers below come from the JSON artifacts dated **11 October 2026** (pages, booking, mutations, realtime) and **23 October 2026** (concurrency). They are staging measurements, not a production service-level agreement.

---

## 2. Functional suitability

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Functional completeness | Objectives 2-10 with an end-to-end path | Trace each objective to route, service, table, test | 8 of 9 fully implemented; 1 scope-adjusted | [system-objectives-guide.md](../objectives/system-objectives-guide.md) | Objectives 2-6, 8-10 implemented; Objective 7 partial (announcements, no events/RSVP) |
| Functional correctness | Unit/RLS/browser tests passing | `pnpm test`, `pnpm --filter @dorsu/rls-tests test:rls`, `pnpm e2e` | All pass in CI | `ci.yml`; test files; `perf-tests/results/` | 86 unit, 14 RLS, 6 browser tests exist; CI runs them. Per-run pass status is not stored in this repository |
| Functional appropriateness | Each role sees the task it needs | Manual route and capability comparison | No wrong-role task surface | [ui-sitemap.md](../ux/ui-sitemap.md); `rbac.ts` | Designed and enforced; admin deliberately narrow; student mobile-only |
| Completeness of check-in gate | Booking and completion both gated | Code review + tests | No path bypasses the gate | `booking-service.ts`, `pre-session-pss10.ts`, `mutations-pss10.test.ts`, `pre-session-pss10.test.ts` | Measured by unit tests; waiver path is audited |
| Small-cell protection | Cells under five hidden | Code review + suppression test | No small cell in display/export | `suppression.ts`, `suppression.test.ts` | Implemented; 3 unit cases |

**Assessment:** functional suitability is the strongest characteristic. The main gap is Objective 7's narrowed scope, which is documented rather than hidden.

---

## 3. Performance efficiency

### 3.1 Time behaviour

Normal network, desktop viewport, 20 runs + 3 warm-ups per page:

| Page | TTFB p50 / p95 (ms) | LCP p50 / p95 (ms) | Result |
|---|---|---|---|
| Login | 8 / 10 | 520 / 672 | Pass |
| Head dashboard | 146 / 205 | 204 / 248 | Pass |
| Head reports | 158 / 334 | 200 / 360 | Pass |
| Head appointments | 188 / 422 | 240 / 484 | Pass |
| Head referrals | 146 / 240 | 184 / 304 | Pass |
| Head chat | 135 / 182 | 168 / 208 | Pass |
| Head announcements | 135 / 151 | 176 / 208 | Pass |
| Head students | 139 / 244 | 196 / 296 | Pass |
| Head sessions | 147 / 408 | 200 / 444 | Pass |
| Counselor dashboard | 138 / 252 | 192 / 296 | Pass |
| Counselor appointments | 183 / 253 | 232 / 308 | Pass |
| Counselor chat | 143 / 268 | 188 / 320 | Pass |
| Counselor referrals | 137 / 200 | 196 / 260 | Pass |
| Counselor sessions | 156 / 288 | 204 / 348 | Pass |
| Counselor feedback | 151 / 312 | 200 / 424 | Pass |
| Faculty dashboard | 143 / 499 | 180 / 540 | Pass |
| Faculty referrals | 199 / 288 | 256 / 340 | Pass |

Slow-4G + 4x CPU throttled subset:

| Page | TTFB p50 / p95 (ms) | LCP p50 / p95 (ms) | Result |
|---|---|---|---|
| Login | 174 / 896 | 4964 / 5620 | Fail against a 2.5 s LCP target; login ships ~1.1 MB JS |
| Head dashboard | 574 / 677 | 1608 / 2132 | Pass against 2.5 s |
| Head reports | 582 / 827 | 1632 / 1824 | Pass against 2.5 s |
| Counselor chat | 612 / 732 | 1572 / 1840 | Pass against 2.5 s |

Booking service path:

| Mode | Total service p50 / p95 (ms) | Notes |
|---|---:|---|
| Unassigned request | 1179 / 1427 | Auth, screen, slots, check-in, gate, insert, visible |
| Assigned request | 1464 / 1683 | Adds slot gate (~277 ms p50) |

Mutations:

| Mutation | p50 / p95 (ms) |
|---|---:|
| Chat send | 263 / 372 |
| Staff DM send | 131 / 320 |
| Referral submit | 129 / 261 |
| Referral triage | 248 / 373 |
| Feedback | 379 / 461 |
| Student reschedule | 248 / 340 |
| Cancel | 266 / 378 |
| Announcement publish | 127 / 263 |

Realtime:

| Metric | Result |
|---|---|
| Message delivery (n=50) | p50 379 ms, p95 495 ms, max 503 ms, **0 lost** |
| Reconnect | 1 replayed live; 3 recovered via refetch; expected 3 |

**Assessment:** interactive writes are under 500 ms p95 on staging; page LCP is under 550 ms normal. The login page is the outlier on a throttled connection because of its JavaScript weight. That is a measured finding, not a guess.

### 3.2 Resource utilization and capacity

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Resource utilization | JS shipped per page; Supabase queries per load | Playwright + response counting | No page over ~300 KB JS on normal load | `pages.json` | Most staff pages ~2-259 KB; login ~1.1 MB; throttled login ~1.1 MB |
| Capacity | Concurrent confirms / idempotent retries | 50 simultaneous requests | One winner, no double booking | `concurrency.json` (E1) | 1 success, 49 `23P01` conflicts, 1 confirmed, pass |
| Capacity | Idempotent booking under concurrency | 50 simultaneous retries | One row per intent | `concurrency.json` (E2) | 50/50 success, pass |
| Capacity | Large-data reports | Head RPC aggregates | No raw-row scan to the client | `/api/reports/head`; RPCs | Design uses SQL aggregates; no load test at production scale |

**Assessment:** the concurrency guarantees are measured and strong. Production capacity (hundreds of concurrent users) is **not measured**; the harness uses 50 requests on a staging project.

---

## 4. Compatibility

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Co-existence | Web and mobile against one backend | Manual + shared services | Both clients work on the same data | `docs/architecture/architecture.md`; shared packages | Designed and implemented |
| Interoperability | Google Meet create/patch/delete | Unit tests + optional live test | Link creation and fallback both work | `meeting.test.ts`; `docs/operations/google-meet-integration.md` | Unit-tested; live Google path not in CI |
| Browser compatibility | Web pages in Chromium, Firefox, Safari | Cross-browser run | No blocking defect | Not present | **Not measured.** Only Playwright Chromium is documented |
| Mobile platform | Android and iOS builds | EAS build | Both build and launch | `apps/mobile/eas.json` | Configured; no build artifact or device matrix in the repository |
| Data portability | Export to Excel | Workbook generation | Report opens in Excel | `apps/web/lib/reports/` | Implemented; file-level verification not automated |

**Assessment:** interoperability with Google Meet is designed and unit-tested; browser and device compatibility are **not measured**. Claiming "works on all browsers" would be unsupported.

---

## 5. Usability

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Appropriateness recognizability | Task success without help | Moderated UAT with 16 participants | >= 80% unaided per core task | `docs/ux/usability-accessibility-protocol.md` | **Not measured**; protocol only |
| Learnability | Time to first successful booking / note | Same UAT | First-time student books in <= 10 min | Protocol tasks S1-S5 | **Not measured** |
| Operability | Clicks to core actions; error recovery | Task analysis + UAT | No dead end; actionable errors | UI-SITEMAP §9; screens | Designed for; not measured with users |
| User error protection | Guarded transitions; confirmation dialogs | Code review + tests | No destructive action without a guard | Guarded updates; confirm dialogs; tests | Implemented |
| User interface aesthetics | Design-token consistency | Manual review | No ad-hoc colors or fonts | `packages/ui-tokens`, `apps/mobile/theme.ts` | Implemented by convention; no visual audit |
| Accessibility | WCAG 2.1 AA findings | axe/Lighthouse + manual keyboard/screen reader | No critical/high findings | Protocol §6 | **Not measured**; no audit report |
| Satisfaction | SUS score | 10-item SUS after UAT | Median >= 70 (industry "good") | Protocol §5 | **Not measured** |

**Assessment:** usability is **designed for, not measured**. The interface has role-aware navigation, plain-language errors, empty/loading states, and large mobile tap targets, but Objective 1 and Objective 11 remain partial until participants are run. The protocol is ready; the execution is the gap.

---

## 6. Reliability

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Maturity | Defect-free core flows | Unit + RLS + browser tests | No open critical defect in tested flows | Test suites; CI | Tests exist and run in CI; no defect log in the repo |
| Availability | Uptime | Production monitoring | 99.5% monthly | Not present | **Not measured**; no monitoring/incident history in the repository |
| Fault tolerance | Double-booking race | 50 concurrent confirms | Exactly one winner | `concurrency.json` E1 | Measured: 1 success, 49 conflicts, pass |
| Fault tolerance | Retry duplication | 50 concurrent idempotent bookings | One row per intent | `concurrency.json` E2 | Measured: 50/50 success, pass |
| Fault tolerance | Realtime loss | 50 deliveries + reconnect | No lost message | `realtime.json` | 0 lost; reconnect recovers by replay or refetch |
| Recoverability | Restore from backup | Staging drill | Restore verified against checksums and row counts | `docs/operations/backup-restore.md` | Procedure exists; **no drill record** |
| Recoverability | Audit durability | Same-transaction trigger | Business write fails if audit write fails | `audit_track` function | Implemented by design; not fault-injected |
| Availability of integrations | Meet failure fallback | Manual paste path | Session still confirmable | `docs/operations/google-meet-integration.md` | Implemented; live failure not tested in CI |

**Assessment:** consistency and recovery-by-design are strong and partly measured. Availability and restore recovery are **not measured**. Do not claim an uptime percentage.

---

## 7. Security

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Confidentiality | Routine staff cannot read student identity | RLS integration tests + manual | Zero identity rows in routine reads | `00069`; `tests/rls`; `docs/security/security-privacy.md` | Implemented; 14 RLS cases cover isolation |
| Confidentiality | Note privacy | RLS + API ownership tests | Only owner + head/admin | `00052`; `/api/session-notes` | Implemented |
| Confidentiality | Chat privacy | Participant-only RLS | No non-participant reads | `is_thread_participant`; `00037` | Implemented |
| Integrity | Guarded status transitions | Unit tests + DB constraint | No skipped state | `mutations.ts`; `00029` | Measured by tests |
| Integrity | Append-only audit | RLS policy review | No client update/delete | `00018`, `00045` | Implemented; DB admin can still alter |
| Non-repudiation | Actor + action recorded | Trigger/route review | Every sensitive action attributable | `audit_events`, `audit_logs` | Implemented; service-role writes need explicit attribution |
| Accountability | Break-glass review | Route + test review | No counselor reveal before review | `/api/staff/security/reveal` | Implemented |
| Authenticity | Session and role claims | Supabase Auth + guard review | No forged role in the client | SSR client; RLS | Implemented by platform; no MFA enforced |
| Penetration resistance | External pentest findings | Third-party test | No critical/high unmitigated | Not present | **Not measured** |
| Privacy re-identification | Small-cell suppression | Unit test + report review | No cell under five | `suppression.test.ts` | Implemented; threshold is not differential privacy |

**Assessment:** security controls are the most thoroughly evidenced non-functional area, but the evidence is **internal** (tests, code review, RLS). There is no external penetration test, no vulnerability scan report, and no WAF/incident log. Objective 11's security row stays partial for that reason.

---

## 8. Maintainability

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Modularity | Domain rules outside UI | Dependency review | Services import no React/browser API | `packages/shared-services`; `platform.ts` | Implemented |
| Reusability | Shared schemas/types used by both apps | Import review | One contract per input | `packages/shared-schemas`, `shared-types` | Implemented |
| Analysability | Typecheck and lint | CI | Zero errors | `ci.yml`; app scripts | Typecheck for shared, web, mobile; web lint exists |
| Modifiability | Schema change path | Migration + type + service review | One ordered migration per change | `supabase/migrations`; AGENTS.md | Convention documented; some stale docs |
| Testability | Automated test count | Count files/cases | Core rules covered | 86 unit + 14 RLS + 6 browser | Measured by count; no coverage percentage |
| Documentation quality | Docs set complete | Link and content review | Every doc reachable, no dead links | `docs/README.md` | This suite fills the missing docs; link check is manual |
| Consistency | Route/table/status names | Cross-document review | One spelling | All docs | Known stale items: `AGENTS.md` says no test runner; some docs use old names |

**Assessment:** modularity and testability are strong for a capstone project. The main maintainability risks are stale documentation, a Prisma mirror that omits some tables, and the absence of a coverage report. None of these is hidden.

---

## 9. Portability

| Sub-characteristic | Metric | Method | Target | Evidence | Result |
|---|---|---|---|---|---|
| Adaptability | Web deploy to Vercel; mobile to EAS | Deploy review | One-command build per target | `vercel.json`; `eas.json`; package scripts | Configured; deployment not re-run for this document |
| Installability | Mobile install on a device | Device/simulator install | App launches and signs in | `apps/mobile/README.md` | Documented; no device matrix in the repo |
| Replaceability | Swap Supabase project or Google account | Env review | No code change beyond env | `packages/supabase-client`; env names | Designed for; not tested with a second project |
| Environment portability | Run against local Supabase | CI local reset | Migrations apply cleanly | `ci.yml` `supabase db reset` | Measured in CI |
| Platform dependency | Vendor lock-in | Architecture review | Documented exit points | `docs/architecture/architecture.md` | Supabase/Next/Vercel/Expo coupling documented |

**Assessment:** portability is good within the chosen stack and not tested across stacks. The system is not containerized or self-hosted.

---

## 10. Summary scorecard

Do **not** read this as a numeric ISO score. It is an evidence status per characteristic.

| Characteristic | Designed | Measured | Overall evidence status |
|---|---|---|---|
| Functional suitability | Yes | Unit + RLS + browser tests | Strong; Objective 7 partial |
| Performance efficiency | Yes | Staging page/booking/mutation/realtime/concurrency | Good on staging; login throttled LCP is a finding; production capacity unmeasured |
| Compatibility | Yes | Google unit tests; CI local Supabase | Partial; browser/device matrix absent |
| Usability | Yes | Protocol only | **Not measured** |
| Reliability | Yes | Concurrency, realtime, guarded writes | Partial; availability and restore drill absent |
| Security | Yes | RLS tests + code review | Strong internal; no external pentest |
| Maintainability | Yes | Typecheck + test counts + docs | Good; coverage and stale-doc gaps |
| Portability | Yes | CI local Supabase | Partial; no cross-host test |

**Honest one-line result:**

> Functional suitability, performance on staging, and access-control security have concrete evidence. Usability, availability, browser/device compatibility, restore recovery, and penetration resistance do not. Objective 11 stays **Partial** until those evidence slots are filled.

---

## 11. Measurement plan for the missing rows

| Missing evidence | Procedure | Owner | Artifact to produce |
|---|---|---|---|
| SUS + task success | Run the 16-participant protocol in `docs/ux/usability-accessibility-protocol.md` on staging; record per-task success, time, errors, SEQ, SUS | Guidance Office + team | `docs/usability-study-report.md` |
| WCAG 2.1 AA audit | axe/Lighthouse plus manual keyboard, screen reader, 200% zoom, contrast on the five high-risk surfaces | Team + accessibility reviewer | Findings table with WCAG criterion and severity |
| Cross-browser | Run the 4 Playwright specs on Firefox and WebKit; add a manual Safari/iOS check | Team | CI matrix results or a dated manual matrix |
| Mobile device matrix | Install the EAS build on at least one Android and one iOS device; run booking, check-in, chat | Team | Device/OS/build table |
| Production load | Re-run `perf-tests` with a production-like dataset and concurrency (for example 200-500 users); record p95 and error rate | Team + IT | `perf-tests/results/*.json` with a dated profile |
| Availability | Add uptime monitoring (Vercel/Supabase or external); collect 30 days | IT | Uptime report |
| Restore drill | Follow `docs/operations/backup-restore.md` into staging; verify checksums and per-table counts | Guidance head + team | Signed drill record with date and discrepancies |
| Penetration test | Scope: auth, RLS, break-glass, file upload, Meet URL, API abuse; external tester | Institution + team | Pentest report and remediation log |
| Coverage | Add a coverage reporter to Vitest; publish statement/branch coverage | Team | Coverage report |
| Audit tamper resistance | Evaluate WORM storage or external log sink for `audit_events` | Team + IT | Design decision record |

---

## 12. Instrument appendix

### 12.1 SUS questionnaire (standard 10 items)

Administered after all tasks, 5-point scale from Strongly disagree (1) to Strongly agree (5). Items alternate positive and negative; the standard scoring formula produces a 0-100 score. Report median and range, not a p-value, for a formative sample.

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

### 12.2 UAT task list

Use the role scripts in `docs/ux/usability-accessibility-protocol.md` §4: five student tasks, five counselor tasks, three faculty tasks, and five head tasks. Score success as unaided / helped / failed, record time to completion (cap at 5 minutes), and log errors and prompts.

### 12.3 Performance profile

| Parameter | Value |
|---|---|
| Runs per page / mutation / booking | 20 measured + 3 warm-ups |
| Viewport | Desktop Chromium (Playwright) |
| Normal network | Unthrottled in the harness |
| Throttled profile | 150 ms latency, 1.6 Mbps down, 750 kbps up, 4x CPU slowdown |
| Booking path | Auth, screen, slots, check-in, gate, slot gate, insert, visibility |
| Concurrency | 50 simultaneous confirms; 50 simultaneous idempotent bookings |
| Realtime | 50 deliveries, then reconnect with replay/refetch |
| Data | Seeded staging dataset, not production |
| Artifacts | `perf-tests/results/{pages,pages-throttled,booking,mutations,concurrency,realtime,explain}.json` |

### 12.4 Thresholds used in this document

These are evaluation targets chosen for this study, not contractual SLAs:

- Interactive write p95 <= 500 ms on staging.
- Page LCP p50 <= 550 ms normal network; <= 2.5 s on Slow-4G + 4x CPU.
- Zero lost realtime messages in a 50-message run.
- One winner in a 50-way confirm race.
- No report cell below five displayed or exported.
- SUS median >= 70 for a "good" formative result.

If the institution adopts different thresholds, update this section and re-run the harness; do not silently reinterpret the old rows.

---

## 13. How to reproduce

1. `pnpm install`
2. `pnpm --filter @dorsu/shared-services test` - unit suite (86 cases).
3. `supabase start && supabase db reset`
4. `pnpm --filter @dorsu/rls-tests test:rls` - RLS suite (14 cases).
5. `pnpm --filter @dorsu/e2e test:e2e` - browser journeys (4 spec files, 6 tests).
6. In `perf-tests/`: `npm install`, then `npm run measure:pages`, `measure:booking`, `measure:mutations`, `concurrency`, `realtime`.
7. Compare new JSON against the results quoted here. Record the date and dataset; never overwrite an old result without preserving it.

If a command cannot run because a staging project or browser is unavailable, mark the corresponding row **Not measured** rather than copying an old number forward.
