-- 00070_student_record: alias-only longitudinal student record + structured notes.
--
-- WHY: Objective 4's remaining gap is that counselors must reconstruct a case
-- across /appointments, /referrals, /feedback, and /reports. This migration
-- adds scoped read RPCs for one student record and additive S.O.A.P. fields on
-- session_notes. It deliberately does not expose identity: no student_no, no
-- contact_no, no profile name/email.
--
-- SECURITY: every read goes through public.can_access_student() (00069), which
-- scopes counselors to their sessions/referrals/chat threads and grants
-- head/admin oversight. Session-note content is NOT returned by the timeline;
-- only note_id + follow-up metadata. Content stays behind
-- /api/session-notes and its owner/head checks.

-- ── structured note template (backward compatible) ────────────────────────

alter table public.session_notes
  add column if not exists note_format text not null default 'freeform'
    check (note_format in ('freeform', 'soap')),
  add column if not exists subjective text,
  add column if not exists objective text,
  add column if not exists assessment text,
  add column if not exists plan text;

-- Supporting index for per-student note lookups through appointments.
create index if not exists appointments_student_scheduled_idx
  on public.appointments (student_id, scheduled_at desc);

-- ── student record header ─────────────────────────────────────────────────

create or replace function public.get_student_record(p_student_id uuid)
returns table (
  id uuid,
  anonymous_alias text,
  program text,
  year_level text,
  college text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.anonymous_alias, s.program, s.year_level, s.college, s.created_at
  from public.students s
  where s.id = p_student_id
    and public.current_user_role() in ('counselor', 'guidance_head', 'admin')
    and public.can_access_student(s.id);
$$;

revoke all on function public.get_student_record(uuid) from public;
grant execute on function public.get_student_record(uuid) to authenticated;

-- ── student record counters ───────────────────────────────────────────────

create or replace function public.get_student_record_counts(p_student_id uuid)
returns table (
  total_sessions bigint,
  completed_sessions bigint,
  open_referrals bigint,
  latest_band text,
  follow_ups_due bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      (select auth.uid()) as uid,
      public.current_user_role() as role,
      (select c.id from public.counselors c where c.profile_id = (select auth.uid())) as counselor_id
  ),
  visible as (
    select 1 from public.students s, me
    where s.id = p_student_id
      and me.role in ('counselor', 'guidance_head', 'admin')
      and public.can_access_student(s.id)
  ),
  appts as (
    select a.*
    from public.appointments a, me, visible
    where a.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or a.counselor_id = me.counselor_id)
  ),
  refs as (
    select r.*
    from public.referrals r, me, visible
    where r.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or r.assigned_counselor_id = me.counselor_id)
  ),
  screens as (
    select p.*
    from public.pss10_assessments p, me, visible
    where p.student_id = p_student_id
      and (
        me.role in ('guidance_head', 'admin')
        or exists (
          select 1 from public.appointments a
          where a.student_id = p_student_id and a.counselor_id = me.counselor_id
        )
      )
  ),
  notes as (
    select n.*
    from public.session_notes n
    join public.appointments a on a.id = n.appointment_id
    cross join me
    cross join visible
    where a.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or n.counselor_id = me.counselor_id)
  )
  select
    (select count(*) from appts)::bigint,
    (select count(*) from appts where status = 'completed')::bigint,
    (select count(*) from refs where status in ('pending', 'assigned', 'acknowledged', 'in_progress', 'confirmed', 'escalated'))::bigint,
    (select s.band from screens s order by s.created_at desc limit 1),
    (select count(*) from notes where follow_up_required and follow_up_at > now())::bigint
  where exists (select 1 from visible);
$$;

revoke all on function public.get_student_record_counts(uuid) from public;
grant execute on function public.get_student_record_counts(uuid) to authenticated;

-- ── student record timeline ───────────────────────────────────────────────
-- The timeline is metadata only. Note content stays in /api/session-notes.

create or replace function public.get_student_timeline(
  p_student_id uuid,
  p_limit int default 200
)
returns table (
  event_type text,
  event_id uuid,
  occurred_at timestamptz,
  status text,
  label text,
  band text,
  score int,
  rating int,
  note_id uuid,
  follow_up_at timestamptz,
  appointment_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      (select auth.uid()) as uid,
      public.current_user_role() as role,
      (select c.id from public.counselors c where c.profile_id = (select auth.uid())) as counselor_id
  ),
  visible as (
    select 1 from public.students s, me
    where s.id = p_student_id
      and me.role in ('counselor', 'guidance_head', 'admin')
      and public.can_access_student(s.id)
  ),
  events as (
    -- sessions
    select
      'session'::text as event_type,
      a.id as event_id,
      coalesce(a.scheduled_at, a.created_at) as occurred_at,
      a.status::text as status,
      coalesce(nullif(a.concern, ''), 'Counseling session')::text as label,
      null::text as band,
      null::int as score,
      null::int as rating,
      null::uuid as note_id,
      null::timestamptz as follow_up_at,
      a.id as appointment_id
    from public.appointments a, me, visible
    where a.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or a.counselor_id = me.counselor_id)

    union all

    -- referrals
    select
      'referral'::text,
      r.id,
      r.created_at,
      r.status::text,
      coalesce(nullif(r.reason, ''), 'Referral')::text,
      null::text,
      null::int,
      null::int,
      null::uuid,
      null::timestamptz,
      null::uuid
    from public.referrals r, me, visible
    where r.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or r.assigned_counselor_id = me.counselor_id)

    union all

    -- screenings
    select
      'screening'::text,
      p.id,
      p.created_at,
      p.band::text,
      'PSS-10 screening'::text,
      p.band::text,
      p.total_score,
      null::int,
      null::uuid,
      null::timestamptz,
      null::uuid
    from public.pss10_assessments p, me, visible
    where p.student_id = p_student_id
      and (
        me.role in ('guidance_head', 'admin')
        or exists (
          select 1 from public.appointments a
          where a.student_id = p_student_id and a.counselor_id = me.counselor_id
        )
      )

    union all

    -- feedback
    select
      'feedback'::text,
      f.id,
      f.created_at,
      null::text,
      coalesce(nullif(f.comment, ''), 'Session feedback')::text,
      null::text,
      null::int,
      f.rating,
      null::uuid,
      null::timestamptz,
      f.appointment_id
    from public.feedback f
    join public.appointments a on a.id = f.appointment_id
    cross join me
    cross join visible
    where f.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or a.counselor_id = me.counselor_id)

    union all

    -- notes (metadata only)
    select
      'note'::text,
      n.id,
      n.created_at,
      null::text,
      'Session note documented'::text,
      null::text,
      null::int,
      null::int,
      n.id,
      n.follow_up_at,
      n.appointment_id
    from public.session_notes n
    join public.appointments a on a.id = n.appointment_id
    cross join me
    cross join visible
    where a.student_id = p_student_id
      and (me.role in ('guidance_head', 'admin') or n.counselor_id = me.counselor_id)

    union all

    -- follow-ups
    select
      'follow_up'::text,
      n.id,
      n.follow_up_at,
      case when n.follow_up_at > now() then 'scheduled' else 'due' end,
      'Follow-up session'::text,
      null::text,
      null::int,
      null::int,
      n.id,
      n.follow_up_at,
      n.appointment_id
    from public.session_notes n
    join public.appointments a on a.id = n.appointment_id
    cross join me
    cross join visible
    where a.student_id = p_student_id
      and n.follow_up_required
      and n.follow_up_at is not null
      and (me.role in ('guidance_head', 'admin') or n.counselor_id = me.counselor_id)
  )
  select *
  from events
  order by occurred_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.get_student_timeline(uuid, int) from public;
grant execute on function public.get_student_timeline(uuid, int) to authenticated;
