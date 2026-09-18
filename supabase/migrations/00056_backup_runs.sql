-- 00056_backup_runs: head-managed logical backups (data export, not restore).
--
-- WHAT / WHY: Supabase platform (physical) backups stay dashboard-side and
-- invisible to the office. This table records logical backups the guidance
-- head runs from inside the app: one row per run, artifact bytes in the
-- private system-backups bucket (versioned, checksummed JSON). Restore is
-- deliberately NOT a button — a live overwrite of counseling data is too
-- dangerous to one-click; recovery follows docs/BACKUP_RESTORE.md (download
-- the artifact, guided SQL restore). See the /backups page + API.
--
-- SECURITY: backup artifacts contain the office's most sensitive rows, so
-- the bucket is private and both table + objects are head/admin-only.
-- Downloads are audit-logged by the API (actor + IP). No delete policy:
-- runs are history; retention pruning (if ever wanted) is a head decision
-- recorded as a new run, never a silent delete. All re-runnable.

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running','completed','partial','failed')),
  source text not null default 'manual'
    check (source in ('manual','cron')),
  tables jsonb not null default '{}'::jsonb,
  row_counts jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0,
  bytes bigint not null default 0,
  checksum text,
  storage_path text,
  warnings jsonb not null default '[]'::jsonb,
  error text,
  initiated_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists backup_runs_status_idx on public.backup_runs (status);
create index if not exists backup_runs_started_idx on public.backup_runs (started_at desc);

alter table public.backup_runs enable row level security;

drop policy if exists "backup_runs_head_only" on public.backup_runs;
create policy "backup_runs_head_only"
  on public.backup_runs for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );

insert into storage.buckets (id, name, public)
values ('system-backups', 'system-backups', false)
on conflict (id) do update set public = false;

-- Artifacts are head/admin-only objects (service-role writes bypass RLS;
-- reads go through short-lived signed URLs minted by the API).
drop policy if exists "system_backups_head_read" on storage.objects;
create policy "system_backups_head_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'system-backups'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "system_backups_head_delete" on storage.objects;
create policy "system_backups_head_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'system-backups'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );
