-- Seed pending referrals for the admin (guidance_head) queue.
-- Run AFTER demo profiles/students/faculty exist (service_role or psql), e.g.:
--   psql "$DIRECT_URL" -f supabase/seed_pending_referrals.sql
-- Lifecycle: pending = flagged, NO counselor assigned (assigned_counselor_id
-- MUST stay NULL — assigning moves it out of the unassigned pool).
-- Status is always 'pending' here so the admin inbox has a triage queue.
-- NOTE: referrals.resolve is blocked until the student holds a confirmed
-- session (see triageReferral) — these seeds are meant to be triaged first.

with demo_students as (
  select id, student_no from public.students
  where student_no in ('2024-DEMO-001', '2024-DEMO-002')
),
demo_faculty as (
  select f.id, p.email from public.faculty_members f
  join public.profiles p on p.id = f.profile_id
)
insert into public.referrals
  (student_id, referring_faculty_id, reason, priority, status, assigned_counselor_id)
select
  (select id from demo_students where student_no = v.student_no),
  (select id from demo_faculty where email = v.faculty_email),
  v.reason,
  v.priority,
  'pending',
  null
from (values
  ('2024-DEMO-001', 'rcruz@dorsu.edu.ph', 'Student has been missing classes frequently and seems withdrawn during lectures. Requesting counseling follow-up.', 'high'),
  ('2024-DEMO-002', 'ltorres@dorsu.edu.ph', 'Student broke down during consultation about failing grades and family pressure. Needs urgent attention.', 'urgent'),
  ('2024-DEMO-001', 'ltorres@dorsu.edu.ph', 'Noticed the student isolating from group activities over the past two weeks. Early check-in recommended.', 'medium'),
  ('2024-DEMO-002', 'rcruz@dorsu.edu.ph', 'Student asked about dropping subjects due to anxiety before exams. Guidance on coping strategies would help.', 'medium'),
  ('2024-DEMO-001', 'rcruz@dorsu.edu.ph', 'Frequent visits to the faculty room about allowance and part-time work stress. Financial counseling referral.', 'low')
) as v(student_no, faculty_email, reason, priority)
where exists (select 1 from demo_students where demo_students.student_no = v.student_no)
  and exists (select 1 from demo_faculty where demo_faculty.email = v.faculty_email)
  -- idempotency: skip if an identical pending referral already exists
  and not exists (
    select 1 from public.referrals r
    where r.student_id = (select id from demo_students where student_no = v.student_no)
      and r.status = 'pending'
      and r.reason = v.reason
  );
