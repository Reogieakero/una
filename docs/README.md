# Documentation Index

This is the entry point for the DCAS documentation set. It explains what each document covers and who it is for, so a reviewer, developer, or panel member can find the evidence behind any claim without reading the whole repository. Documents describe the code in `apps/`, `packages/`, and `supabase/migrations/` as it exists; features that are not implemented are labelled `PROPOSED`, and partial features are labelled `PARTIAL`.

**Audience:** developers, thesis panels, guidance-office staff, and reviewers.

---

## Documentation map

```text
docs/
├── README.md                  This index
├── architecture/              System shape, database, API, realtime
├── objectives/                Study objectives and the flagship workflow
├── ux/                       Sitemap, user guide, usability protocol
├── security/                 Privacy model, threat model, PSS-10 note
├── quality/                  ISO/IEC 25010 evaluation
├── operations/               Backup/restore and external integrations
├── plans/                    Phase and remediation records
├── sql/                      One-off SQL applied outside the migration chain
└── assets/                   Spreadsheet artifacts used by the study
```

Naming rule: top-level documents use `UPPER-KEBAB.md`; documents inside a folder use `lowercase-kebab.md`.

## Start here

| Document | Purpose |
|---|---|
| [architecture/architecture.md](architecture/architecture.md) | Stack, modules, request/data flow, deployment, and environment boundaries. |
| [objectives/system-objectives-guide.md](objectives/system-objectives-guide.md) | Objective-by-objective guide: where each lives, how it works, what to demo. |
| [ux/ui-sitemap.md](ux/ui-sitemap.md) | Web and mobile route trees, a sitemap diagram, screen inventory, journeys, and access matrix. |
| [ux/user-guide.md](ux/user-guide.md) | Task-oriented guide for students, counselors, faculty, guidance heads, and administrators. |
| [../AGENTS.md](../AGENTS.md) | The repository's operating rules for contributors (architecture, security, conventions). |
| [../OBJECTIVE_STATUS.md](../OBJECTIVE_STATUS.md) | Plain-language status of the eleven study objectives, with demo steps. |
| [../Objective_Achievement_Report.md](../Objective_Achievement_Report.md) | Detailed technical achievement audit and evidence log. |

## Architecture

| Document | Purpose |
|---|---|
| [architecture/architecture.md](architecture/architecture.md) | Monorepo layout, clients, shared packages, request paths, and architectural rules. |
| [architecture/database-diagram.md](architecture/database-diagram.md) | Entity-relationship diagrams, connection reference, privacy map, and schema invariants. |
| [architecture/api-reference.md](architecture/api-reference.md) | Privileged route handlers, RPCs, shared-service entry points, and status codes. |
| [architecture/realtime-audit.md](architecture/realtime-audit.md) | Realtime channels, notification fan-out, and board-refresh behaviour. |

## Objectives and workflows

| Document | Purpose |
|---|---|
| [objectives/system-objectives-guide.md](objectives/system-objectives-guide.md) | Each of the eleven objectives mapped to screens, services, tables, and evidence. |
| [objectives/objective-focus-workflow.md](objectives/objective-focus-workflow.md) | End-to-end booking -> PSS-10 -> session -> notes -> analytics, with sequence and state diagrams. |
| [objectives/objective-7-announcement-scope.md](objectives/objective-7-announcement-scope.md) | Why Objective 7 is announcement management, not events/RSVP. |

## User experience

| Document | Purpose |
|---|---|
| [ux/ui-sitemap.md](ux/ui-sitemap.md) | Route trees, overview diagram, screen inventory, role access matrix, journeys, dead routes. |
| [ux/user-guide.md](ux/user-guide.md) | Step-by-step use for every role, privacy in plain words, troubleshooting, and FAQ. |
| [ux/usability-accessibility-protocol.md](ux/usability-accessibility-protocol.md) | UAT/SUS and WCAG protocol - protocol only, no participants run yet. |

## Security and privacy

| Document | Purpose |
|---|---|
| [security/security-privacy.md](security/security-privacy.md) | Anonymity model, break-glass protocol, RBAC, data protection, threat model, audit rules. |
| [security/anonymity-threat-model.md](security/anonymity-threat-model.md) | Threat model for aliases, routine staff reads, and identity reveal. |
| [security/pss10-license-note.md](security/pss10-license-note.md) | PSS-10 instrument provenance, permission status, and compliance caveat. |

## Quality evaluation

| Document | Purpose |
|---|---|
| [quality/iso-25010-evaluation.md](quality/iso-25010-evaluation.md) | ISO/IEC 25010 mapping, measured staging results, evidence gaps, and measurement plan. |

## Operations and integrations

| Document | Purpose |
|---|---|
| [operations/backup-restore.md](operations/backup-restore.md) | Backup artifacts, restore procedure, cron behaviour, and drill requirements. |
| [operations/google-meet-integration.md](operations/google-meet-integration.md) | Google Calendar/Meet setup, scopes, fallback, and failure modes. |
| [operations/google-signin.md](operations/google-signin.md) | Google OAuth configuration for Supabase, web, and mobile. |

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

## SQL and assets

| File | Purpose |
|---|---|
| [sql/apply-00043-00044.sql](sql/apply-00043-00044.sql) | One-off SQL for migrations 00043-00044, applied outside the normal chain. |
| [assets/Timeline.xlsx](assets/Timeline.xlsx) | Working project timeline. |
| [assets/Timeline.backup.xlsx](assets/Timeline.backup.xlsx) | Backup copy of the timeline. |

## App and test documentation

| Document | Purpose |
|---|---|
| [../apps/mobile/README.md](../apps/mobile/README.md) | Mobile routes, wired-vs-mocked history, design tokens, and gotchas. |
| [../e2e/README.md](../e2e/README.md) | Playwright setup, fixtures, and role journeys. |
| [../tests/rls/README.md](../tests/rls/README.md) | RLS integration test setup and scope. |

## Conventions used here

- `Implemented` - a route, component, service, or schema constraint exists and is wired.
- `PARTIAL` - the capability exists but a stated part is missing or unverified.
- `PROPOSED` - target design; no implementation exists in this repository.
- `Not measured` - no measurement has been run; the method to measure it is given.
- File references use repository-relative paths such as `apps/web/app/(staff)/dashboard/page.tsx`.
- Diagrams are Mermaid; they render on GitHub and in editors that support Mermaid preview.
