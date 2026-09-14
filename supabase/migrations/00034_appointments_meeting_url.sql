-- 00034_appointments_meeting_url: Google Meet link for online sessions.
-- Set by the counselor when confirming an online appointment; read by
-- counselor + head (board join button) and the student (notification).

alter table public.appointments
  add column if not exists meeting_url text;
