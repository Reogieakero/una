-- Seed pending appointments for the admin (guidance_head) queue.
-- Run AFTER demo profiles/students exist (service_role or psql), e.g.:
--   psql "$DIRECT_URL" -f supabase/seed_pending_appointments.sql
-- Lifecycle per 00029: pending = student booked, NO counselor assigned.
-- counselor_id MUST stay NULL or the row means "assigned", not "pending".
-- Status is always 'pending' here so the admin board has a triage queue.

with demo_students as (
  select id, student_no from public.students
  where student_no in ('2024-DEMO-001', '2024-DEMO-002')
)
insert into public.appointments
  (student_id, counselor_id, status, mode, concern, concern_type,
   scheduled_at, requested_datetime, is_anonymous)
select
  (select id from demo_students where student_no = v.student_no),
  null,
  'pending',
  v.mode,
  v.concern,
  v.concern_type,
  v.slot,
  v.slot,
  false
from (values
  ('2024-DEMO-001', 'in_person', 'Struggling with midterm preparations and need guidance', 'academic',   now() + interval '1 day'),
  ('2024-DEMO-002', 'online',    'Feeling overwhelmed with personal matters lately',       'personal',   now() + interval '2 days'),
  ('2024-DEMO-001', 'in_person', 'Worried about tuition and allowance budgeting',          'financial',  now() + interval '3 days'),
  ('2024-DEMO-002', 'online',    'Having difficulty adjusting with classmates',           'social',     now() + interval '4 days'),
  ('2024-DEMO-001', 'in_person', 'Would like someone to talk to about stress',            'other',      now() + interval '5 days')
) as v(student_no, mode, concern, concern_type, slot)
where exists (select 1 from demo_students where demo_students.student_no = v.student_no)
  -- idempotency: skip if an identical pending request already exists
  and not exists (
    select 1 from public.appointments a
    where a.student_id = (select id from demo_students where student_no = v.student_no)
      and a.status = 'pending'
      and a.concern = v.concern
  );
