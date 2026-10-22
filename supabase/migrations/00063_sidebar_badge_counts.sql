-- 00063_sidebar_badge_counts: make sidebar badges truthful and privacy-safe.
--
-- Before this migration a sidebar badge was the number of *unread notification
-- rows* whose link matched the menu href. That over-counted (one appointment
-- produced a row per status change), under-counted (assignment never notified
-- the counselor), and was wiped by merely visiting the page. It also carried
-- clinical text (alias + concern/reason/feedback comment) in `body`, which the
-- realtime toast renders on screen.
--
-- This migration:
--   1. adds read/action metadata to notifications,
--   2. stops the trigger fan-outs from writing clinical text,
--   3. exposes RLS-scoped, source-of-truth counts via sidebar_counts(),
--   4. adds mark_informational_read() so "mark all" cannot clear action items.
--
-- All statements are idempotent.

-- ── 1. notification metadata ────────────────────────────────────────────────
alter table public.notifications
  add column if not exists is_action_required boolean not null default false,
  add column if not exists read_at timestamptz,
  add column if not exists ref_type text,
  add column if not exists ref_id uuid,
  add column if not exists resolved_at timestamptz;

-- Backfill: existing read rows get an audit timestamp; existing unread
-- "new request" rows become action-required so Mark-all stops eating them.
update public.notifications
   set read_at = created_at
 where is_read = true and read_at is null;

-- Hydrate the row refs the old fan-outs already encoded in `dedupe_key`
-- (`appt:<uuid>:<status>`); the new triggers write ref_id directly.
update public.notifications
   set ref_type = 'appointment',
       ref_id = split_part(dedupe_key, ':', 2)::uuid
 where ref_type is null
   and dedupe_key ~ '^appt:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

update public.notifications
   set is_action_required = true
 where is_read = false
   and type = 'appointment'
   and title = 'New session request';

-- …but only while the appointment is actually still waiting for triage.
-- History is full of "new request" rows for sessions that were assigned or
-- completed months ago; leaving those action-required would pin the bell at
-- 99+ forever and make "mark all" look broken.
update public.notifications n
   set is_action_required = false,
       is_read = true,
       read_at = coalesce(n.read_at, now()),
       resolved_at = coalesce(n.resolved_at, now())
 where n.is_action_required
   and (
     n.ref_type is distinct from 'appointment'
     or n.ref_id is null
     or not exists (
       select 1
       from public.appointments a
       where a.id = n.ref_id
         and a.status = 'pending'
     )
   );

create index if not exists notifications_badge_idx
  on public.notifications (profile_id, is_action_required, is_read, created_at desc);

-- Scrub clinical text already written by earlier fan-outs: bodies for
-- appointment/referral/chat rows, and "— <alias>" title suffixes.
update public.notifications
   set body = null
 where type in ('appointment', 'referral', 'chat')
   and body is not null;

update public.notifications
   set title = split_part(title, ' — ', 1)
 where type in ('appointment', 'referral')
   and title like '% — %';

-- ── 2. privacy-safe fan-outs ────────────────────────────────────────────────
-- New booking: generic title only. Also skip staff-created rows (walk-ins and
-- counselor-minted follow-ups are not "requests"), mirroring 00043's actor gate.
create or replace function public.notify_heads_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  select p.role into actor_role
  from public.profiles p
  where p.id = auth.uid();

  if actor_role in ('counselor', 'guidance_head', 'faculty', 'guidance_personnel', 'admin') then
    return NEW;
  end if;

  insert into public.notifications
    (profile_id, type, title, body, link, dedupe_key, is_action_required, ref_type, ref_id)
  select distinct targets.pid,
         'appointment',
         'New session request',
         null,
         '/appointments',
         'appt:' || NEW.id::text || ':' || NEW.status,
         true,
         'appointment',
         NEW.id
  from (
    select c.profile_id as pid
    from public.counselors c
    join public.profiles pr on pr.id = c.profile_id and pr.is_active = true
    where c.id = NEW.counselor_id
    union
    select p.id
    from public.profiles p
    where p.role = 'guidance_head' and p.is_active = true
  ) as targets
  where targets.pid is not null
  on conflict (profile_id, dedupe_key) do nothing;
  return NEW;
end;
$$;

-- Student-originated status/schedule changes: generic title, no alias/concern.
create or replace function public.notify_staff_on_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  title text;
  tone text;
begin
  if NEW.status is not distinct from OLD.status
     and NEW.scheduled_at is not distinct from OLD.scheduled_at then
    return NEW;
  end if;

  -- A request notification must stop being "action required" the moment the
  -- session leaves pending — including staff-driven assignments, which return
  -- below and never insert a new row. Security definer: updates every
  -- recipient's copy, not just the actor's.
  if NEW.status is distinct from OLD.status and NEW.status <> 'pending' then
    update public.notifications
       set is_read = true,
           read_at = coalesce(read_at, now()),
           resolved_at = coalesce(resolved_at, now()),
           is_action_required = false
     where ref_type = 'appointment'
       and ref_id = NEW.id
       and is_action_required = true;
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = auth.uid();

  if actor_role in ('counselor', 'guidance_head', 'faculty', 'guidance_personnel', 'admin') then
    return NEW;
  end if;

  if NEW.status is distinct from OLD.status and NEW.status = 'cancelled' then
    title := 'Session cancelled';
    tone := 'error';
  elsif NEW.scheduled_at is distinct from OLD.scheduled_at then
    title := 'Session rescheduled';
    tone := 'info';
  else
    title := 'Session ' || NEW.status;
    tone := 'info';
  end if;

  insert into public.notifications
    (profile_id, type, title, body, link, dedupe_key, tone, ref_type, ref_id)
  select distinct targets.pid,
         'appointment',
         title,
         null,
         '/appointments',
         'appt:' || NEW.id::text || ':' || NEW.status,
         tone,
         'appointment',
         NEW.id
  from (
    select c.profile_id as pid
    from public.counselors c
    join public.profiles pr on pr.id = c.profile_id and pr.is_active = true
    where c.id = NEW.counselor_id
    union
    select p.id
    from public.profiles p
    where p.role = 'guidance_head' and p.is_active = true
  ) as targets
  where targets.pid is not null
  on conflict (profile_id, dedupe_key) do nothing;
  return NEW;
end;
$$;

-- Feedback: never copy the comment (or the score) into the payload.
create or replace function public.notify_staff_on_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications
    (profile_id, type, title, body, link, ref_type, ref_id)
  select distinct targets.pid,
         'system',
         'New session feedback',
         null,
         '/feedback',
         'feedback',
         NEW.id
  from (
    select c.profile_id as pid
    from public.appointments a
    join public.counselors c on c.id = a.counselor_id
    join public.profiles pr on pr.id = c.profile_id and pr.is_active = true
    where a.id = NEW.appointment_id
    union
    select p.id
    from public.profiles p
    where p.role = 'guidance_head' and p.is_active = true
  ) as targets
  where targets.pid is not null;
  return NEW;
end;
$$;

-- ── 3. per-user, RLS-scoped badge counts ────────────────────────────────────
-- `security invoker` keeps every subquery filtered by the caller's RLS:
-- counselors only see their own appointments/referrals, heads see the office.
create or replace function public.sidebar_counts()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  my_role as (
    select p.role
    from public.profiles p
    where p.id = (select uid from me)
  ),
  my_counselor as (
    select c.id
    from public.counselors c
    where c.profile_id = (select uid from me)
  )
  select jsonb_build_object(
    -- Action-required: a request waiting for assignment (head) or a session
    -- waiting for confirmation (counselor). Disappears when the status moves,
    -- never when the page is opened.
    'appointment_requests', (
      select count(*)
      from public.appointments a
      where (
        -- Head: waiting for assign/reject. Assignment lowers the count.
        a.status = 'pending'
        and (select role from my_role) in ('guidance_head', 'guidance_personnel', 'admin')
      ) or (
        -- Counselor: a request for them, or a session waiting for confirmation.
        a.status in ('pending', 'assigned')
        and a.counselor_id in (select id from my_counselor)
      )
    ),
    -- Head-only shared queue: students waiting for any counselor.
    'unassigned_requests', (
      select count(*)
      from public.appointments a
      where a.counselor_id is null
        and a.status in ('pending', 'assigned', 'confirmed')
        and (select role from my_role) in ('guidance_head', 'guidance_personnel', 'admin')
    ),
    -- Head: pending triage. Counselor: assigned and awaiting their confirm.
    'referrals_to_triage', (
      select count(*)
      from public.referrals r
      where (
        (select role from my_role) in ('guidance_head', 'guidance_personnel')
        and r.status in ('pending', 'escalated')
      ) or (
        r.status in ('assigned', 'acknowledged', 'in_progress')
        and r.assigned_counselor_id in (select id from my_counselor)
      )
    ),
    -- Informational sections keep using the per-user notification feed.
    'chat_unread', (
      select count(*)
      from public.notifications n
      where n.profile_id = (select uid from me)
        and n.type = 'chat'
        and n.is_read = false
    ),
    'announcements_unread', (
      select count(*)
      from public.notifications n
      where n.profile_id = (select uid from me)
        and n.is_read = false
        and n.link like '/announcements%'
    ),
    'feedback_unread', (
      select count(*)
      from public.notifications n
      where n.profile_id = (select uid from me)
        and n.is_read = false
        and n.link like '/feedback%'
    ),
    'security_unread', (
      select count(*)
      from public.notifications n
      where n.profile_id = (select uid from me)
        and n.is_read = false
        and n.link like '/security%'
    ),
    'informational_unread', (
      select count(*)
      from public.notifications n
      where n.profile_id = (select uid from me)
        and n.is_read = false
        and not n.is_action_required
    )
  );
$$;

grant execute on function public.sidebar_counts() to authenticated;

-- ── 4. Mark-all that cannot clear action-required work ─────────────────────
create or replace function public.mark_informational_read()
returns integer
language sql
security invoker
set search_path = public
as $$
  with updated as (
    update public.notifications
       set is_read = true,
           read_at = coalesce(read_at, now())
     where profile_id = auth.uid()
       and is_read = false
       and is_action_required = false
     returning 1
  )
  select count(*)::int from updated;
$$;

grant execute on function public.mark_informational_read() to authenticated;

-- ── 5. realtime for the shared queues ──────────────────────────────────────
-- The provider already listens to notifications; now it also watches the
-- rows the counters derive from so one head assigning a request moves every
-- other head's badge immediately. Realtime honours RLS on both tables.
do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.referrals;
exception when duplicate_object then null;
end $$;
