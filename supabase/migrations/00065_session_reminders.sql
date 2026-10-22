-- 00065_session_reminders: fan out "starts in 10 minutes" reminders for
-- confirmed sessions to the two people who need them — the student and the
-- assigned counselor — without exposing either party's identity.
--
-- WHY server-side: a browser/phone timer only fires while that app is open,
-- so a student who backgrounded the app would miss the reminder. pg_cron runs
-- once a minute in the database; the insert lands in `notifications`, which
-- is already in the realtime publication, so both the web provider (toast +
-- bell) and the mobile count provider update live.
--
-- PRIVACY: title/body are generic and mode-specific only. No alias, student
-- name, concern, counselor name, or meeting URL is copied into the payload;
-- the app resolves those from the appointment the link points at.
--
-- Idempotent: one row per recipient per session per scheduled time. A
-- reschedule changes the dedupe key, so the reminder re-arms.

create extension if not exists pg_cron;

create or replace function public.send_session_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with due as (
    select a.id,
           a.student_id,
           a.counselor_id,
           a.mode,
           a.scheduled_at
      from public.appointments a
     where a.status = 'confirmed'
       -- 9–11 minutes ahead: each session is seen by one or two consecutive
       -- minute runs; the dedupe key collapses the overlap.
       and a.scheduled_at > now() + interval '9 minutes'
       and a.scheduled_at <= now() + interval '11 minutes'
  ),
  recipients as (
    select d.id as appointment_id, s.profile_id
      from due d
      join public.students s on s.id = d.student_id
     where s.profile_id is not null
    union
    select d.id, c.profile_id
      from due d
      join public.counselors c on c.id = d.counselor_id
     where c.profile_id is not null
  ),
  ins as (
    insert into public.notifications
      (profile_id, type, title, body, link, dedupe_key, tone, ref_type, ref_id)
    select r.profile_id,
           'appointment',
           case when d.mode = 'online'
                then 'Online session starts in 10 minutes'
                else 'Session starts in 10 minutes'
           end,
           case when d.mode = 'online'
                then 'Your online session is about to start. Open it for the video link.'
                else 'Your session at the Guidance Office is about to start.'
           end,
           '/appointments#focus-' || d.id::text,
           -- Include the scheduled instant so a moved session gets a new
           -- reminder instead of being suppressed by the old one.
           'appt:' || d.id::text || ':reminder:'
             || extract(epoch from d.scheduled_at)::bigint::text,
           'info',
           'appointment',
           d.id
      from recipients r
      join due d on d.id = r.appointment_id
      join public.profiles p on p.id = r.profile_id and p.is_active = true
     on conflict (profile_id, dedupe_key) do nothing
    returning 1
  )
  select count(*)::int into inserted_count from ins;

  return inserted_count;
end;
$$;

-- Keep exactly one scheduler entry for this job across re-runs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'session-reminders') then
    perform cron.unschedule('session-reminders');
  end if;
  perform cron.schedule(
    'session-reminders',
    '* * * * *',
    'select public.send_session_reminders();'
  );
end $$;

-- Manual run for verification:
--   select public.send_session_reminders();
