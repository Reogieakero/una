-- 00042_appointments_walkin: let counselor-confirmed sessions exist for
-- walk-in students (referrals filed with typed identity, no account yet).
--
-- appointments.student_id becomes nullable; the FK stays (linked rows still
-- cascade). No RLS change needed:
--   - students match rows via their own student id (NULL rows invisible to them),
--   - assigned counselors match via counselor_id,
--   - head/personnel/admin keep the office-wide view,
--   - counselor inserts still require their own counselor record (00036).
-- Resolve/confirm gating for NULL-student rows lives in application code
-- (matched by source_referral_id instead of student_id).

alter table public.appointments
  alter column student_id drop not null;
