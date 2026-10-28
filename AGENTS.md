# AGENTS.md

Operating guide for AI coding agents in the **DOrSU Guidance / Chekie** monorepo.

Read this file before exploring. It is intentionally dense: follow it first, then open only the files a task actually needs. Trust the code over old READMEs when they disagree.

---

## 1. What this project is

A mental-health and guidance-office platform for DOrSU:

- **`apps/web`** — Next.js 14 App Router staff/admin portal (counselors, guidance head, faculty, admin) plus public auth/landing pages.
- **`apps/mobile`** — Expo SDK 58 student app (`Chekie Student`): booking, check-in/PSS-10, chat, sessions, profile.
- **Supabase** — Postgres, Auth, Storage, Realtime, RLS. SQL migrations are the schema source of truth.
- **Shared packages** — domain logic, Zod schemas, DB types, RBAC, Supabase config, design tokens.

This is **privacy-sensitive health software**. Session notes, PSS-10 results, break-glass identity reveals, and chat content must never be leaked, logged, or sent through notification payloads.

---

## 2. 60-second orientation

| Area | Fact |
|---|---|
| Package manager | **pnpm 9.7.0 only** (workspace protocol `workspace:*`). Never use npm/yarn in the repo root. |
| Node | `>=22.13.0` |
| Task runner | Turborepo (`turbo.json`) |
| Web stack | Next.js **14.2** App Router, React **18.3**, TypeScript strict, Tailwind, TanStack Query v5, Supabase SSR |
| Mobile stack | Expo **58** (React Native **0.88**, React **19.3**), expo-router, TypeScript (declared **6.x**), StyleSheet + `theme.ts` tokens |
| Backend | Supabase (remote project). Migrations in `supabase/migrations/`, 5-digit sequential names `00000_…` → `00061_…` |
| ORM | Prisma exists only as a **dictionary mirror** (`packages/db/prisma/schema.prisma`); runtime data access uses Supabase clients |
| Tests | **No unit-test runner is configured.** Validation = typecheck + lint + build (+ manual flows / `perf-tests`). |
| Deploy | Vercel builds **web only** from repo root: `pnpm --filter @dorsu/web build`, output `apps/web/.next` |

### Read order for a new task

1. This file.
2. The owning app/package `package.json` and the relevant folder (table below).
3. `packages/shared-types/src/database.ts` for real columns/statuses.
4. Relevant migration(s) in `supabase/migrations/`.
5. `docs/realtime-audit.md` before changing realtime, notifications, or board refresh behavior.
6. `docs/BACKUP_RESTORE.md` before touching backups.

---

## 3. Commands

Run from the repo root unless noted. Prefer filtered commands — they are much faster.

### Install / develop

```bash
pnpm install                 # only way to install deps
pnpm dev:web                 # web only, http://localhost:3000
pnpm dev                     # turbo dev for all apps
pnpm --filter @dorsu/mobile dev   # Expo (press i / a / scan QR)
```

### Verify (definition of done)

```bash
pnpm --filter @dorsu/web typecheck
pnpm --filter @dorsu/mobile typecheck
pnpm --filter @dorsu/web lint
pnpm --filter @dorsu/web build        # production build; catches RSC/route issues
```

- Root `pnpm typecheck` / `pnpm build` run Turbo across the graph. `typecheck` **dependsOn `^build`**, so it can be slower than a filtered run.
- Not every package defines `lint`; `apps/web` uses `next lint`, mobile uses `expo lint`.
- If you touch shared packages, run the consuming app's typecheck too (web and mobile consume them differently).

### Database

```bash
pnpm db:validate    # prisma validate
pnpm db:generate    # prisma generate
pnpm db:push        # DESTRUCTIVE-ISH: only with explicit user approval
pnpm db:types       # supabase gen types → shared-types/src/database.ts
```

**Windows gotcha:** the root `db:types` script uses bash redirection (`>`). On PowerShell run it through Git Bash/WSL, or:

```powershell
pnpm exec supabase gen types typescript --project-id <ref> --schema public | Out-File -Encoding utf8 packages/shared-types/src/database.ts
```

Do not hand-edit `database.ts` unless you are deliberately keeping the scaffold in sync with a new migration; prefer regenerating when the project is reachable.

### Performance sandbox (optional, separate npm project)

```bash
cd perf-tests && npm install
npm run seed          # seeds data — ask before running against anything non-local
npm run measure:pages
npm run measure:booking
npm run measure:mutations
npm run concurrency
npm run realtime
npm run explain
```

---

## 4. Repository map

```
apps/
  web/
    app/(public)/            login, register, reset/update password
    app/(staff)/             almost all staff pages (shared shell, role-filtered)
    app/(admin)/             head-only: users, security, backups
    app/api/                 privileged route handlers (service-role / server-only)
    components/              feature UI by domain + shared shell/nav
    lib/
      supabase/              client.ts (browser), server.ts (RSC/route), admin.ts (service role), middleware.ts
      auth/                  guard.ts (requireRole), home.ts
      hooks/                 use-*-board.ts React Query readers + use-mutation-action.ts
      reports/               Excel/report builders
      notify.ts, log-event.ts, pagination.ts, rate-limit.ts, patch-board.ts, format.ts
    middleware.ts            session refresh via @supabase/ssr
  mobile/
    app/                     expo-router: index, login, register, (tabs)/{home,sessions,profile}, book, check-in, chat
    components/              primitives, mascot, illustrations, UI pieces
    lib/supabase/            AsyncStorage-backed client + ensureStudent
    theme.ts                 THE design token source for mobile
packages/
  shared-services/src/       pure domain services (appointments, referrals, chat, notifications, security, analytics, rbac)
  shared-schemas/src/        Zod input contracts
  shared-types/src/          database.ts (row types) + domain.ts
  supabase-client/src/       URL/key resolution + typed client type
  ui-tokens/src/             brand palette/typography/spacing (web Tailwind consumes it)
  db/                        Prisma schema + server/trusted-script client
supabase/migrations/         SQL source of truth (RLS, triggers, RPCs, indexes)
docs/                        audit + backup/restore docs, one-off SQL
perf-tests/                  standalone measurement harness (never imported by apps)
scripts/                     repo utilities
```

---

## 5. Non-negotiable architecture rules

1. **Shared domain logic lives in `packages/shared-services`.** Apps handle rendering, auth adapters, and optimistic UI only. Do not reimplement booking/referral/chat rules in a page or a mobile screen.
2. **Platform boundaries are injected.** Services accept `DbClient` and optional adapters from `platform.ts`; they never call `localStorage`, `AsyncStorage`, `fetch`, `window`, or React directly.
3. **Contracts are shared.** Zod validation in `@dorsu/shared-schemas`; DB/domain shapes in `@dorsu/shared-types`. Never duplicate a row shape or schema in an app.
4. **One Supabase config.** `packages/supabase-client` resolves `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`. Apps own only storage adapters (`lib/supabase/*`).
5. **RBAC lives in one place.** `packages/shared-services/src/rbac.ts` (`routePolicy`, `actionPolicy`, `canVisitRoute`, `canPerform`, `homeRouteFor`). Do not hardcode role arrays in pages. Server route groups call `requireRole([...])`; pages and RLS still enforce action-level rules.
6. **Database authority is RLS + guarded writes.** Every state change uses guarded updates (`.eq("status", expectedFrom)`) and, where relevant, transition tables/role checks. Client checks are UX only.
7. **Service-role client is server-only.** `apps/web/lib/supabase/admin.ts` may be imported only in `app/api/**` (or server-only code). Every call must first re-check the caller's role/ownership in code.
8. **Notifications are fire-and-forget.** `notifyStaff()` never blocks and never throws. Call it with `void`, pass a stable `dedupeKey`, and never put clinical content, aliases, note text, or tokens in the payload.
9. **Reads use per-domain React Query board hooks** (`lib/hooks/use-*-board.ts`) with `keepPreviousData`, pagination, and incremental `patchBoard`. Do not add polling loops or full-board refetches on every keystroke/event.
10. **Writes in web go through the browser Supabase client + shared-service functions**, except privileged flows (registration, notifications, backups, break-glass logging, session-note file access, user status) which live in `app/api/**`. There are currently **no Server Actions** — don't introduce a second write style casually.
11. **Design tokens only.** Web: Tailwind colors/fonts fed by `@dorsu/ui-tokens`. Mobile: `theme.ts` values. No ad-hoc hex codes or font sizes.
12. **Route groups do not create URL segments.** `(staff)`, `(admin)`, `(public)` all map to real URLs. Never create the same URL in two groups; handle role differences inside the page via RBAC.

---

## 6. Domain glossary and lifecycle

### Roles (`UserRole`)

`student`, `counselor`, `guidance_head`, `faculty`, `guidance_personnel`, `admin`.

- `admin` may enter the staff shell but most pages fail closed; currently only `/settings` is allowed. Head-only tools live in `app/(admin)/`.
- `rbac.ts` is authoritative for route/action access. `guidance_personnel` exists in types but is intentionally absent from most policies.

### Appointments (`appointments`)

```
pending ──assign──▶ assigned ──confirm──▶ confirmed ──complete──▶ completed
   │                   │                     └──no_show──▶ no_show
   │                   └──cancel (student)──▶ cancelled
   └──reject (head)──▶ rejected              (assigned rows must be unassigned first)
```

- Booking is student-only; `assigned` is set by the guidance head; confirm/complete/no-show are counselor actions.
- Online confirmations require a Google Meet URL (`meet.google.com`).
- Walk-ins and referrals can mint appointments; follow-ups link via `follow_up_of`.
- Availability windows (`counselor_availability`) scope confirm/reschedule times.

### Referrals (`referrals`, `referral_actions`)

Faculty/head create → head assigns → counselor confirms (mints a linked session), resolves, escalates, or rejects. Every triage move should leave an audit row in `referral_actions`. Referral confirmation creates/updates an `appointments` row (`source_referral_id`) rather than duplicating it.

### Session notes (`session_notes`)

- Only the **assigned counselor** writes; heads/admin may read for oversight.
- Only for `completed` appointments; one note per session.
- Content is never logged/notified/audited. Storage attachments go through `/api/session-notes/attachments`.
- A documented follow-up mints/moves a confirmed follow-up appointment.

### Other safety-critical flows

- **Break glass** (`break_glass_logs`, `/emergency`, `/api/staff/security/*`): identity reveal is audited, time-limited, and must only ever carry IDs through realtime — never names/content.
- **Feedback** and **PSS-10** scores are sensitive; do not surface them in notifications.
- **Backups** (`backup_runs`, `/api/admin/backups/*`) require `CRON_SECRET` for scheduled runs.

---

## 7. Where to change what

| Task | Touch these |
|---|---|
| New staff page | `apps/web/app/(staff)/<route>/page.tsx` + `loading.tsx` skeleton + `STAFF_NAV_GROUPS` in `components/shared/staff-nav.tsx` + route entry in `rbac.ts` + guard allowlist |
| New admin page | `apps/web/app/(admin)/…`; reuse `requireRole([...])`; keep nav entry role-scoped |
| New web data board | `apps/web/lib/hooks/use-<domain>-board.ts` (React Query + pagination) and a matching service query in `packages/shared-services` |
| New mutation | `packages/shared-services/src/<domain>/mutations.ts` with Zod + guarded update; export from `src/index.ts`; UI calls `useMutationAction().run()` |
| New API route | `apps/web/app/api/<area>/route.ts`; `createClient()` from `lib/supabase/server`, Zod-validate body, return `{ error }` with correct status; admin client only when required |
| New table/column/policy | New `supabase/migrations/000NN_snake_case.sql` (next free number; do **not** renumber), update `database.ts` types + `domain.ts` if needed, mirror in Prisma |
| New Zod contract | `packages/shared-schemas/src/*.schema.ts` + export from its `index.ts` |
| New notification | Server-side route/service insert + `notifyStaff(...)` with `dedupeKey`; ensure a realtime consumer will render it |
| Excel/PDF/report change | `apps/web/lib/reports/**` (sheets, mappers, styles); referral paper/Excel in `lib/referrals/**` |
| New mobile screen | `apps/mobile/app/<route>.tsx` (or tab under `(tabs)`), components in `apps/mobile/components`, tokens from `theme.ts`, data via `getSupabase()` + `@dorsu/shared-services` |
| Mobile auth/profile bootstrap | `apps/mobile/lib/supabase/{client,ensureStudent}.ts` |
| Brand/colors | `packages/ui-tokens/src/**` for web; `apps/mobile/theme.ts` for mobile (keep them visually aligned) |
| Docs | `docs/` (architecture/audit notes) and `apps/mobile/README.md` if mobile flows change |

Before adding a helper, **grep first** — `lib/` already contains pagination, timeout fetch, rate limiting, notify, log-event, formatting, report palettes, board patching, and mutation lifecycle helpers.

---

## 8. Coding conventions

- TypeScript strict. Avoid `any`; the only sanctioned escape hatches are at the platform boundary (`DbClient`) and generated/typed Supabase client casts. Never silence errors with `@ts-ignore`.
- Use `type` aliases for DB row shapes (Supabase generics require implicit index signatures); use `interface` for app-owned objects.
- Files: kebab-case (`use-appointments-board.ts`, `booking-service.ts`). Components: PascalCase filenames. SQL migrations: `000NN_snake_case.sql`.
- Prefer named exports. Web pages/layouts may default-export as Next requires.
- Comments explain **why**, not what, and cite migration/phase numbers when relevant (the codebase does this heavily — match it).
- Next.js: Server Components by default; add `"use client"` only for state, effects, browser APIs, or React Query. Keep data fetching in hooks/services.
- Errors shown to users are short, sentence-case, and actionable ("Couldn't save the note — please reload and try again."). Route handlers return `{ error: "…" }` with 400/401/403/404/409/422/500 as appropriate.
- Use ISO-8601 UTC strings for timestamps; format for display through `lib/format.ts`. Appointments store `scheduled_at` and optional `ends_at`.
- Batch independent Supabase reads with `Promise.all`; keep queries scoped/`.select(...)` limited to needed columns; respect pagination (`MAX_PAGE_SIZE`).
- Optimistic UI must roll back on failure. Use `patchBoard` + `useMutationAction` patterns rather than bespoke spinners.
- Web icons: `lucide-react`. Mobile icons: import per icon path (e.g. `lucide-react-native/icons/bell`) to keep bundles small.
- Keep the existing visual language: cream/ink/blue/sun, rounded cards, soft shadows, sentence-case microcopy.

---

## 9. Data and security rules

**Never**:

- Commit `.env`, `.env.local`, service keys, cron secrets, or real student data.
- Use `SUPABASE_SERVICE_ROLE_KEY` in client components or expose it via `NEXT_PUBLIC_*`.
- Log session-note content, PSS-10 answers/scores, chat bodies, identity-reveal results, or auth tokens.
- Weaken/disable RLS to make a query work. Fix the query or add a policy in a migration.
- Add a notification containing clinically identifying detail, even for staff.
- Run `pnpm db:push`, destructive SQL, or reseed a shared/remote database without explicit approval.
- Delete or revert unrelated uncommitted work. The working tree may contain in-progress changes (notably the mobile app restructure) — inspect `git status` before editing.

**Always**:

- Re-check role + ownership in privileged route handlers even when RLS covers the query.
- Audit administrative/security actions (`audit_logs`, `break_glass_logs`, `referral_actions`) in the critical path.
- Keep realtime payloads to IDs/status, not sensitive content.
- Validate every external input with Zod before touching the DB.

---

## 10. Current state and known gotchas

- **Mobile is mid-migration.** The app moved from `(auth)`/`(student)` stacks to flat auth routes + `(tabs)`. Auth, registration, profile bootstrap, home data, booking, and PSS-10 check-in are wired to Supabase; the sessions tab, chat, and profile card still use `data/mock.ts`. See `apps/mobile/README.md` for the exact wired-vs-mocked list.
- **Two React majors coexist:** web = React 18, mobile = React 19. Never share React-dependent component packages across apps; shared packages must stay framework-free.
- Both apps use `@types/react` 19.2.18 even though web runs React 18. Keep one version in the graph — duplicate `@types/react` copies break Vercel typecheck.
- Mobile TypeScript is 6.x while web is 5.6. Don't align/upgrade versions unless asked.
- `turbo` `typecheck` depends on `^build`; failures may come from a dependency build, not your file.
- Migrations are sequential and hand-numbered. `00055` is intentionally absent; the next free number is **00062** (verify before creating).
- `packages/shared-types/src/database.ts` is a hand-maintained scaffold with a regeneration note; if you add columns, update it or regenerate, otherwise every typed query breaks.
- Root `package.json` has no `workspaces` field; pnpm uses `pnpm-workspace.yaml`. Mobile Metro explicitly watches the repo root (`metro.config.js`).
- Next.js transpiles workspace packages from source (`transpilePackages`), so no package build step is needed for web — but each package must remain TS/ESM-compatible.
- Vercel cron calls `/api/admin/backups/cron`; without `CRON_SECRET` it returns 503 and only manual head-run backups work.
- There is no test runner. If a change is risky, add a focused `perf-tests` script or a manual verification note instead of inventing a framework.
- Do not edit generated/vendor output: `node_modules`, `.next`, `.turbo`, `dist`, `.expo`, `*.tsbuildinfo`.

---

## 11. Agent workflow

1. **Locate before writing.** Use `grep`/glob to find the existing pattern (board hook, service, route handler, modal) and mirror it.
2. **State a short plan** for multi-file changes, then execute in small diffs.
3. **Change the source of truth first:** schema → shared types/schemas → shared service → app UI/route.
4. **Preserve existing comments and behavior** unless the task requires changing them. Don't refactor unrelated code.
5. **Verify** the touched app with typecheck (and build for Next routes); report the exact commands run and any failures.
6. **Keep secrets and PHI out of output** — including tool logs, test fixtures, and screenshots.
7. **Ask** before destructive DB ops, mass file deletions, dependency major upgrades, or changes to auth/RLS/backup behavior.

### Fast checks when unsure

- Is this shape real? → `packages/shared-types/src/database.ts` + the migration that created it.
- Who may do this? → `rbac.ts`, then RLS in migrations, then the page guard.
- Is there already a helper? → `apps/web/lib/**` and `packages/shared-services/src/**`.
- Will this break realtime? → `docs/realtime-audit.md` and `components/shared/realtime-provider.tsx`.
- Will this break mobile? → does it import React, browser APIs, or Next-only modules? If yes, it cannot go in a shared package.
