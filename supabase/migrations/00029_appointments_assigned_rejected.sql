-- 00029_appointments_assigned_rejected: role-separated workflow.
--
-- New lifecycle:
--   pending (student booked, no counselor)
--     -> assigned   (admin/guidance_head assigns a counselor)
--     -> cancelled  (student cancels)
--     -> rejected   (admin/guidance_head rejects the request)
--   assigned
--     -> confirmed  (counselor confirms)
--     -> cancelled  (student cancels)
--     -> rejected   (admin rejects)
--     -> pending    (admin unassigns, counselor cleared)
--   confirmed
--     -> completed  (counselor, session done)
--     -> no_show    (counselor, student didn't arrive)
--     -> cancelled  (student cancels)
-- Terminal: completed, cancelled, rejected, no_show.
--
-- Admin (guidance_head) may only assign + reject.
-- Counselor may only confirm + complete + no-show.
-- Student may cancel + reschedule (pending/assigned/confirmed).

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending','assigned','confirmed','completed','cancelled','rejected','no_show'));

-- Backfill: pending rows that already have a counselor were assigned
-- under the old flow — mark them assigned so the board is truthful.
update public.appointments
set status = 'assigned', updated_at = now()
where status = 'pending' and counselor_id is not null;
