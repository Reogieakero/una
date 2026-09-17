-- 00046_booking_dedupe_key: stamp dedupe_key on trigger-fanned booking
-- notifications so the realtime provider can single-fetch the new appointment
-- row (toast + data land together) instead of waiting on a full-board refetch.
-- Same key format as client fan-out (appt:<id>:<status>); ON CONFLICT DO
-- NOTHING keeps any overlap from duplicating or aborting. Replaces only the
-- appointments INSERT fan-out from 00035 — feedback fan-out is unchanged.

create or replace function public.notify_heads_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alias text;
begin
  select s.anonymous_alias into alias
  from public.students s
  where s.id = NEW.student_id;
  insert into public.notifications (profile_id, type, title, body, link, dedupe_key)
  select distinct targets.pid,
         'appointment',
         'New session request',
         left(coalesce(alias, 'A student') || ': ' || NEW.concern, 300),
         '/appointments',
         'appt:' || NEW.id::text || ':' || NEW.status
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
