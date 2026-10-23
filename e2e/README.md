# Role smoke tests (Playwright)

Four real-browser smoke paths, one per web role:

| Spec | Asserts |
|---|---|
| `student.spec.ts` | Student lands on `/` and staff clinical routes redirect away — the web portal is staff-only, students use the Expo app. |
| `counselor.spec.ts` | Login → dashboard → appointments → **Complete** on a past confirmed session → save a session note. |
| `faculty.spec.ts` | Login → dashboard → `/refer-student` shows the seeded referral in history and opens the official-form modal. |
| `head.spec.ts` | Login → dashboard → `/referrals` shows the pending referral → `/reports` shows populated KPIs/sections (not just HTTP 200). |

They never assert on real names or note content: fixtures use the alias
`E2E Owl <runId>` and synthetic concern text.

## Local run

These need a running Postgres/Auth stack with every migration applied. They are
**not** part of `pnpm test`.

```bash
supabase start
supabase db reset

export TEST_SUPABASE_URL=http://127.0.0.1:54321
export TEST_SUPABASE_ANON_KEY=<local anon key>
export TEST_SUPABASE_SERVICE_ROLE_KEY=<local service-role key>

pnpm --filter @dorsu/e2e exec playwright install chromium
pnpm e2e
```

`pnpm e2e` builds and starts the web app itself (`next build && next start`).
If a server is already running on `http://127.0.0.1:3000`, Playwright reuses it
locally. To point at a different server, set `E2E_BASE_URL`; to skip the build
when it is already done, set `E2E_WEB_COMMAND="pnpm --filter @dorsu/web start"`.

## CI

`.github/workflows/ci.yml` runs the suite against local Supabase with:

- a pinned Supabase CLI, `supabase start` + `supabase db reset`,
- `next build` with the local URL/anon key,
- Chromium installed with `--with-deps`,
- `playwright-report/` and `test-results/` uploaded on every run (traces,
  screenshots, and video only exist on failures), and
- `supabase stop` always.

Traces/screenshots can include seeded test data but never service-role keys or
real student records.

## Safety

Never point `TEST_SUPABASE_*` at staging or production. Global setup creates
disposable auth users and clinical fixtures in the local database; teardown
deletes them.
