# Documentation Index

This is the entry point for the DCAS documentation set. It explains what each document covers and who it is for, so a reviewer, developer, or panel member can find the evidence behind any claim without reading the whole repository. Documents describe the code in `apps/`, `packages/`, and `supabase/migrations/` as it exists; features that are not implemented are labelled `PROPOSED`, and partial features are labelled `PARTIAL`.

**Audience:** developers, thesis panels, guidance-office staff, and reviewers.

---

## Start here

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, modules, request/data flow, deployment, and environment boundaries. |
| [../AGENTS.md](../AGENTS.md) | The repository's operating rules for contributors (architecture, security, conventions). |
| [../OBJECTIVE_STATUS.md](../OBJECTIVE_STATUS.md) | Plain-language status of the eleven study objectives, with demo steps. |
| [../Objective_Achievement_Report.md](../Objective_Achievement_Report.md) | Detailed technical achievement audit and evidence log. |

## Core documentation

| Document | Purpose |
|---|---|
| [DATABASE-DIAGRAM.md](DATABASE-DIAGRAM.md) | Entity-relationship diagrams, connection reference, privacy map, and schema invariants. |
| [SYSTEM-OBJECTIVES-GUIDE.md](SYSTEM-OBJECTIVES-GUIDE.md) | Objective-by-objective guide: where each lives, how it works, what to demo. |
| [UI-SITEMAP.md](UI-SITEMAP.md) | Web and mobile route trees, screen inventory, journeys, and access matrix. |
| [USER-GUIDE.md](USER-GUIDE.md) | Task-oriented guide for students, counselors, faculty, guidance heads, and administrators. |
| [OBJECTIVE-FOCUS-WORKFLOW.md](OBJECTIVE-FOCUS-WORKFLOW.md) | Deep end-to-end walkthrough of booking → PSS-10 → session → notes → analytics. |
| [SECURITY-PRIVACY.md](SECURITY-PRIVACY.md) | Anonymity model, break-glass protocol, RBAC, threat model, audit requirements. |
| [ISO-25010-EVALUATION.md](ISO-25010-EVALUATION.md) | ISO/IEC 25010 quality mapping, measurement methods, and evidence slots. |
| [API-REFERENCE.md](API-REFERENCE.md) | Route handlers, RPCs, and server-side contracts. |

## Existing topic notes

| Document | Purpose |
|---|---|
| [anonymity-threat-model.md](anonymity-threat-model.md) | Threat model for aliases, routine staff reads, and identity reveal. |
| [BACKUP_RESTORE.md](BACKUP_RESTORE.md) | Backup artifacts, restore procedure, and cron behaviour. |
| [google-meet-integration.md](google-meet-integration.md) | Google Calendar/Meet setup, fallback, and failure modes. |
| [google-signin.md](google-signin.md) | Google OAuth configuration for Supabase, web, and mobile. |
| [objective-7-announcement-scope.md](objective-7-announcement-scope.md) | Why Objective 7 is announcement management, not events/RSVP. |
| [pss10-license-note.md](pss10-license-note.md) | PSS-10 instrument provenance and usage note. |
| [realtime-audit.md](realtime-audit.md) | Realtime channels, notification fan-out, and board-refresh behaviour. |
| [usability-accessibility-protocol.md](usability-accessibility-protocol.md) | UAT/SUS and WCAG protocol — protocol only, no participants run yet. |

## Planning and phase records

| Document | Purpose |
|---|---|
| [plans/objective-3-identity-hardening-plan.md](plans/objective-3-identity-hardening-plan.md) | Identity/alias hardening plan and acceptance criteria. |
| [plans/objective-4-5-full-achievement-plan.md](plans/objective-4-5-full-achievement-plan.md) | Closure plan for counselor records and analytics. |
| [plans/objective-4-5-records-analytics-plan.md](plans/objective-4-5-records-analytics-plan.md) | Implementation plan for student record, notes, analytics. |
| [plans/objective-8-google-meet-integration-plan.md](plans/objective-8-google-meet-integration-plan.md) | Google Meet route selection and implementation plan. |
| [plans/p0-web-correctness-plan.md](plans/p0-web-correctness-plan.md) | Web correctness remediation plan. |
| [plans/p1-honesty-gaps-plan.md](plans/p1-honesty-gaps-plan.md) | Honest-gap closure plan before defense. |
| [plans/p1-objective2-pre-session-pss10-plan.md](plans/p1-objective2-pre-session-pss10-plan.md) | Pre-session PSS-10 policy implementation plan. |

## App and test documentation

| Document | Purpose |
|---|---|
| [../apps/mobile/README.md](../apps/mobile/README.md) | Mobile routes, wired-vs-mocked history, design tokens, and gotchas. |
| [../e2e/README.md](../e2e/README.md) | Playwright setup, fixtures, and role journeys. |
| [../tests/rls/README.md](../tests/rls/README.md) | RLS integration test setup and scope. |

## Conventions used here

- `Implemented` — a route, component, service, or schema constraint exists and is wired.
- `PARTIAL` — the capability exists but a stated part is missing or unverified.
- `PROPOSED` — target design; no implementation exists in this repository.
- `Not measured` — no measurement has been run; the method to measure it is given.
- File references use repository-relative paths such as `apps/web/app/(staff)/dashboard/page.tsx`.
