-- 00038_referrals_counselor_assigned_only: counselors see and touch only
-- referrals the admin assigned to them — the same scoping appointments
-- already enforce (00007). Previously any counselor role could read (and
-- attempt to triage) every referral row, including pending faculty flags
-- and other counselors' cases.
--
-- After this change:
--   select: referrer sees own; assigned counselor sees theirs;
--           head/personnel/admin keep the office-wide view.
--   update: head/personnel/admin manage all; a counselor may only move rows
--           currently assigned to them (assign/unassign/reject stay head-only
--           via the service-layer role gate as well).
-- Insert policy is untouched (faculty/personnel refer; head may seed).

drop policy if exists "referrals_select_scoped"
  on public.referrals;

create policy "referrals_select_scoped"
  on public.referrals for select
  to authenticated
  using (
    exists (select 1 from public.faculty_members f where f.id = referrals.referring_faculty_id and f.profile_id = auth.uid())
    or exists (select 1 from public.guidance_personnel g where g.id = referrals.referring_personnel_id and g.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','guidance_personnel','admin'))
  );

drop policy if exists "referrals_update_counseling_staff"
  on public.referrals;

create policy "referrals_update_scoped"
  on public.referrals for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','guidance_personnel','admin'))
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','guidance_personnel','admin'))
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = auth.uid())
  );
