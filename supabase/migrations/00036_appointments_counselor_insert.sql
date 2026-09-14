-- 00036_appointments_counselor_insert: counselors can mint sessions for
-- their own referrals (confirmReferralWithSession in referrals/mutations).
-- Students still book only for themselves (00007 policy); counselors may
-- only insert rows assigned to their own counselor record. Guarded for
-- re-runs.

drop policy if exists "appointments_insert_counselor" on public.appointments;

create policy "appointments_insert_counselor"
  on public.appointments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.counselors c
      where c.id = appointments.counselor_id
        and c.profile_id = auth.uid()
    )
  );
