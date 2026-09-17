-- 00045_audit_events: general append-only audit trail for client-path writes.
--
-- WHAT / WHY: referral_actions covers referrals and break_glass/audit_logs cover
-- security events, but appointment moves, chat sends, announcement publishes,
-- availability edits, and referral field changes had NO actor-stamped record —
-- only the resulting row state. This closes that gap.
--
-- HOW: one generic SECURITY DEFINER trigger function. TG_ARGV carries
--   [0] entity label, [1] comma-separated watched columns (allowlist — message
--       bodies, reasons, and note text are DELIBERATELY excluded; the trail
--       records THAT a message was sent, by whom, in which thread, never WHAT
--       it said), [2] status column name or '' for none.
-- Inserts happen in the SAME transaction as the business write: if the audit
-- row fails, the write fails — a fact without its audit record must not exist.
-- Service-role writes (admin routes, scripts) record actor_role 'system'
-- unless the route inserts its own row with the real caller (see
-- /api/staff/users/status). Service-role callers that need attribution must
-- write their own audit row; the trigger is the backstop, not the author.
--
-- READ: heads/admins only. NO update/delete policies — append-only, corrections
-- are new rows. Deliberately NOT covered: notification inserts (auditing the
-- notifier is infinite regress), read receipts, pss10/feedback self-data,
-- session_notes content (private counselor record), push ledger rows.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text not null,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  status_before text,
  status_after text,
  diff jsonb not null default '{}',
  reason text,
  related_entity text,
  related_id uuid,
  source text not null default 'trigger',
  result text not null default 'success',
  request_id text,
  ip inet
);

create index if not exists audit_events_entity_idx
  on public.audit_events (entity, entity_id, created_at desc);
create index if not exists audit_events_actor_idx
  on public.audit_events (actor_profile_id, created_at desc);
create index if not exists audit_events_action_idx
  on public.audit_events (action, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select_head_admin" on public.audit_events;
create policy "audit_events_select_head_admin"
  on public.audit_events for select
  to authenticated
  using (
    public.current_user_role() in ('guidance_head', 'admin')
  );
-- No insert/update/delete policies: rows arrive via SECURITY DEFINER triggers
-- (bypass RLS) and service_role (bypasses RLS). Nobody else writes, nobody
-- mutates, ever.

create or replace function public.audit_track()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_label text := TG_ARGV[0];
  watched text[] := string_to_array(TG_ARGV[1], ',');
  status_col text := nullif(TG_ARGV[2], '');
  actor_id uuid := auth.uid();
  actor_role text := 'system';
  d jsonb := '{}'::jsonb;
  col text;
  old_v text;
  new_v text;
  eid uuid;
  s_before text;
  s_after text;
begin
  if actor_id is not null then
    select p.role into actor_role
    from public.profiles p
    where p.id = actor_id;
    actor_role := coalesce(actor_role, 'unknown');
  end if;

  if TG_OP = 'DELETE' then
    eid := (to_jsonb(OLD) ->> 'id')::uuid;
  else
    eid := (to_jsonb(NEW) ->> 'id')::uuid;
  end if;

  foreach col in array watched loop
    old_v := case when TG_OP = 'INSERT' then null else (to_jsonb(OLD) ->> col) end;
    new_v := case when TG_OP = 'DELETE' then null else (to_jsonb(NEW) ->> col) end;
    if old_v is distinct from new_v then
      d := d || jsonb_build_object(col, jsonb_build_object('from', old_v, 'to', new_v));
    end if;
  end loop;

  -- UPDATEs that touch none of the watched columns (e.g. threads.updated_at
  -- bumps, chat thread bumps) record nothing — no noise rows.
  if TG_OP = 'DELETE' or d <> '{}'::jsonb then
    if status_col is not null then
      s_before := case when TG_OP = 'INSERT' then null else (to_jsonb(OLD) ->> status_col) end;
      s_after := case when TG_OP = 'DELETE' then null else (to_jsonb(NEW) ->> status_col) end;
    end if;
    insert into public.audit_events
      (actor_profile_id, actor_role, action, entity, entity_id,
       status_before, status_after, diff, source)
    values
      (actor_id, actor_role,
       entity_label || '.' || TG_OP ||
         case when status_col is not null and TG_OP <> 'DELETE'
              then ':' || coalesce(s_after, 'null') else '' end,
       entity_label, eid, s_before, s_after, d, 'trigger');
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- Appointments: every status move, assignment, reschedule, Meet-link change.
drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments
  after insert or update or delete on public.appointments
  for each row execute function public.audit_track(
    'appointments', 'status,counselor_id,scheduled_at,meeting_url,mode', 'status');

-- Referrals: status moves, assignment, urgency changes. Complements (not
-- replaces) referral_actions: this adds before/after + actor role; the trail
-- keeps the human note.
drop trigger if exists audit_referrals on public.referrals;
create trigger audit_referrals
  after insert or update or delete on public.referrals
  for each row execute function public.audit_track(
    'referrals', 'status,assigned_counselor_id,priority', 'status');

-- Chat: send-events only, metadata without bodies (see header).
drop trigger if exists audit_chat_messages on public.chat_messages;
create trigger audit_chat_messages
  after insert on public.chat_messages
  for each row execute function public.audit_track(
    'chat_messages', 'thread_id', '');

drop trigger if exists audit_staff_messages on public.staff_messages;
create trigger audit_staff_messages
  after insert on public.staff_messages
  for each row execute function public.audit_track(
    'staff_messages', 'recipient_profile_id', '');

-- Announcements: publish/unpublish edits, title/audience changes, deletes.
drop trigger if exists audit_announcements on public.announcements;
create trigger audit_announcements
  after insert or update or delete on public.announcements
  for each row execute function public.audit_track(
    'announcements', 'title,published_at,audience', '');

-- Availability: slot adds/removals with counselor + schedule shape.
drop trigger if exists audit_availability on public.counselor_availability;
create trigger audit_availability
  after insert or delete on public.counselor_availability
  for each row execute function public.audit_track(
    'counselor_availability', 'counselor_id,weekday,start_time,end_time,is_recurring', '');
