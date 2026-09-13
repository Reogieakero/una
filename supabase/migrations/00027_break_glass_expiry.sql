-- 00027_break_glass_expiry: emergency grants are time-boxed (30 minutes).
-- A logged access doubles as the grant window during which the accessor may
-- resolve the student's real identity via the reveal endpoint; every reveal
-- is itself audit-logged. Backfills existing rows from accessed_at.

alter table public.break_glass_logs
  add column if not exists expires_at timestamptz;

update public.break_glass_logs
  set expires_at = accessed_at + interval '30 minutes'
  where expires_at is null;

alter table public.break_glass_logs
  alter column expires_at set default now() + interval '30 minutes';

create index if not exists break_glass_expiry_idx
  on public.break_glass_logs (expires_at);
