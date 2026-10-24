-- 00072_appointment_meeting_provider: provenance for Google Meet links.
-- meeting_url remains the join URL the UI reads. Existing rows stay 'manual'.

alter table public.appointments
  add column if not exists meeting_provider text not null default 'manual',
  add column if not exists meeting_event_id text,
  add column if not exists meeting_created_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_meeting_provider_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_meeting_provider_check
      check (meeting_provider in ('manual', 'google_meet'));
  end if;
end
$$;

comment on column public.appointments.meeting_provider is
  'manual = pasted by staff; google_meet = created through the Google Calendar API';
comment on column public.appointments.meeting_event_id is
  'Google Calendar event id when meeting_provider = google_meet; used to patch or delete the event.';
comment on column public.appointments.meeting_created_at is
  'When Chekie created the Calendar/Meet event. Null for pasted links.';
