-- 00018_audit_logs: append-only trail. Client inserts allowed (services log
-- actions); updates/deletes are NOT permitted for any authenticated role.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_profile_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

alter table public.audit_logs enable row level security;

create policy "audit_select_head_admin"
  on public.audit_logs for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('guidance_head','admin'))
  );

create policy "audit_insert_authenticated"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- Break-glass auto-audit: every emergency access writes an audit_logs row.
create or replace function public.log_break_glass_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_profile_id, action, entity, entity_id, metadata)
  values (
    new.accessor_profile_id,
    'break_glass.access',
    'students',
    new.student_id,
    jsonb_build_object('break_glass_id', new.id, 'justification', left(new.justification, 200))
  );
  return new;
end;
$$;

drop trigger if exists trg_break_glass_audit on public.break_glass_logs;
create trigger trg_break_glass_audit
  after insert on public.break_glass_logs
  for each row execute function public.log_break_glass_access();
