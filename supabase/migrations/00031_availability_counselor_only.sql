-- 00031_availability_counselor_only: only the owning counselor may write slots.
--
-- The guidance head keeps read access (see availability_select_authenticated
-- in 00006) but can no longer insert/update/delete rows here — slot
-- management is counselor-only, enforced in app/(staff)/availability too.
-- Server-side admin clients bypass RLS and are unaffected.

drop policy if exists "availability_manage_own_or_head"
  on public.counselor_availability;

create policy "availability_manage_own_only"
  on public.counselor_availability for all
  to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = counselor_availability.counselor_id
        and c.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.counselors c
      where c.id = counselor_availability.counselor_id
        and c.profile_id = auth.uid()
    )
  );
