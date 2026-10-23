# RLS integration tests

These tests exercise the **real** Postgres RLS policies and triggers behind the
Supabase API — no mocked policies. They create disposable auth users, seed rows
through the service-role client, then query as each role through a normal
authenticated client.

They are intentionally excluded from `pnpm test`. Run them with:

```bash
pnpm --filter @dorsu/rls-tests test:rls
```

## Requirements

A running local Supabase with every migration applied:

```bash
supabase start
supabase db reset
```

Then export the local credentials printed by `supabase status`:

```bash
export TEST_SUPABASE_URL=http://127.0.0.1:54321
export TEST_SUPABASE_ANON_KEY=<local anon key>
export TEST_SUPABASE_SERVICE_ROLE_KEY=<local service-role key>
```

`pnpm --filter @dorsu/rls-tests test:rls` skips the suite (rather than failing)
when those variables are missing.

## Coverage

- A student can read only their own appointments, PSS-10 rows, profile, and
  student row.
- A student cannot insert an appointment or PSS-10 for another student (`42501`).
- Session notes are readable only by the owning counselor and head/admin.
- A student cannot promote their own `profiles.role`.
- Audit logs are head/admin-readable, append-only (no update/delete for any
  authenticated client), and still accept service-side appends.
- The booking notification fan-out carries the anonymous alias, never the real
  name, email, or student number.

## Safety

Never point these variables at staging or production. The suite creates users
and rows, and the cleanup step deletes them. Use a local, disposable database
only.
