-- 00052_session_notes_owner_only: tighten note reads to need-to-know.
--
-- WHAT / WHY: 00009 let ANY counseling-staff profile (any counselor, head,
-- admin) read EVERY session note. Session notes are the counselor's private
-- clinical record for an ended session — a covering counselor has no need to
-- browse another counselor's notes. This matches the dictionary intent
-- (prisma SessionNote: "RLS restricts to owning counselor + guidance_head").
--
-- NEW RULE: a note is selectable only by its owning counselor (linked via
-- counselors.profile_id) or by guidance_head / admin (oversight). Students,
-- faculty, and guidance_personnel still cannot read notes at all.
-- Write policy is unchanged (owning counselor + head/admin).
-- The audit trail (00045) deliberately has no trigger on this table, so note
-- content never lands in audit_events either.

drop policy if exists "session_notes_select_staff" on public.session_notes;

create policy "session_notes_select_owner_head"
  on public.session_notes for select
  to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = session_notes.counselor_id and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );
