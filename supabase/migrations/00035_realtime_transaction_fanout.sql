-- 00035_realtime_transaction_fanout: student-originated transactions also
-- ping staff through notifications — the same realtime pipe the navbar bell,
-- nav count badges, and chat messages listen on (00026 publication).
--
-- Staff/faculty-initiated moves already fan out via /api/staff/notify, but
-- students cannot write notifications (RLS: service-role inserts only), so
-- bookings and feedback were invisible until someone reloaded the board.
-- The database fans out for them here instead.

-- New booking → assigned counselor (when set) + all active guidance heads.
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
  insert into public.notifications (profile_id, type, title, body, link)
  select distinct targets.pid,
         'appointment',
         'New session request',
         left(coalesce(alias, 'A student') || ': ' || NEW.concern, 300),
         '/appointments'
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
  where targets.pid is not null;
  return NEW;
end;
$$;

drop trigger if exists appointments_notify_heads on public.appointments;
create trigger appointments_notify_heads
  after insert on public.appointments
  for each row execute function public.notify_heads_on_appointment();

-- New feedback → handling counselor (via the appointment) + active heads.
create or replace function public.notify_staff_on_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, title, body, link)
  select distinct targets.pid,
         'system',
         'New session feedback',
         'Rating ' || NEW.rating || '/5' ||
           case
             when NEW.comment is not null and NEW.comment <> ''
               then ' — ' || left(NEW.comment, 200)
             else ''
           end,
         '/feedback'
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

drop trigger if exists feedback_notify_staff on public.feedback;
create trigger feedback_notify_staff
  after insert on public.feedback
  for each row execute function public.notify_staff_on_feedback();
