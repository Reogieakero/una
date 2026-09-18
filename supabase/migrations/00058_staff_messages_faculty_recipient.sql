-- 00058_staff_messages_faculty_recipient: let staff DM faculty users.
--
-- ROOT CAUSE: `staff_messages_insert_staff` (00023, via 00057's helper)
-- allowed recipients with role in (counselor, guidance_head,
-- guidance_personnel, admin) — faculty were never in the DM model (see
-- 00023's header: "head/admin <-> counselor"). So a counselor replying to
-- (or starting) a DM with a faculty user got a generic RLS denial
-- ("Couldn't deliver the message"), even though the UI offers that flow.
--
-- FIX: add 'faculty' to the recipient allowlist. Senders are still the
-- caller only, and students still can't be DM'd here (no student DMs —
-- student contact stays inside participant-private threads).

drop policy if exists "staff_messages_insert_staff" on public.staff_messages;

create policy "staff_messages_insert_staff"
  on public.staff_messages for insert
  to authenticated
  with check (
    sender_profile_id = auth.uid()
    and public.profile_role(staff_messages.recipient_profile_id) in ('counselor','guidance_head','guidance_personnel','admin','faculty')
  );
