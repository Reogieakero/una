-- 00041_referral_walkin_students: let faculty file referrals for students
-- who have no account in the system yet.
--
-- Adds free-text identity columns (typed straight off the paper form) and
-- relaxes referrals.student_id to nullable. Rows with a NULL student_id are
-- walk-ins: they queue, notify, and accept counselor assignment exactly like
-- linked rows; session-bearing moves (confirm/resolve) stay blocked in
-- application code until the student registers and holds an account.
--
-- RLS is untouched: no referrals policy references student_id, and the new
-- columns ride the existing select/insert/update scopes.

alter table public.referrals
  alter column student_id drop not null;

alter table public.referrals
  add column if not exists student_name_text text,
  add column if not exists student_no_text text;

-- At least one identity: a linked account or a typed name.
alter table public.referrals
  drop constraint if exists referrals_student_identity_check;

alter table public.referrals
  add constraint referrals_student_identity_check
  check (
    student_id is not null
    or (student_name_text is not null and btrim(student_name_text) <> '')
  );

create index if not exists referrals_student_name_text_idx on public.referrals (student_name_text);
