-- ONE-GO APPLY BUNDLE — paste the entire file into Supabase Dashboard → SQL Editor → Run.
-- Contents (in dependency order): 00043_appointment_update_fanout + 00044_notification_tone.
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE / DROP IF EXISTS /
-- ON CONFLICT DO NOTHING. Do NOT move this file into supabase/migrations/ (the CLI
-- owns that directory; apply those files with `supabase db push` instead).
--
-- After running, verify with:
--   select version from supabase_migrations.schema_migrations order by version;
--   select column_name from information_schema.columns
--    where table_name = 'notifications' and column_name in ('dedupe_key','tone');

-- ═══════════════════════════════════════════════════════════════════════════
-- 00043_appointment_update_fanout
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.notify_staff_on_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alias text;
  actor_role text;
  title text;
  tone text;
begin
  if NEW.status is not distinct from OLD.status
     and NEW.scheduled_at is not distinct from OLD.scheduled_at then
    return NEW;
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = auth.uid();

  if actor_role in ('counselor', 'guidance_head', 'faculty', 'guidance_personnel', 'admin') then
    return NEW;
  end if;

  select s.anonymous_alias into alias
  from public.students s
  where s.id = NEW.student_id;

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

  insert into public.notifications (profile_id, type, title, body, link, dedupe_key, tone)
  select distinct targets.pid,
         'appointment',
         title,
         left(coalesce(alias, 'A student') || ': ' || NEW.concern, 300),
         '/appointments',
         'appt:' || NEW.id::text || ':' || NEW.status,
         tone
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

drop trigger if exists appointments_notify_staff_on_update on public.appointments;
create trigger appointments_notify_staff_on_update
  after update on public.appointments
  for each row execute function public.notify_staff_on_appointment_update();

-- ═══════════════════════════════════════════════════════════════════════════
-- 00044_notification_tone
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.notifications
  add column if not exists tone text
  check (tone in ('success', 'info', 'error'));
