-- 00059_phase1_perf: slot-race guard (P12) + composite covering indexes (P5).
--
-- P12: btree_gist + exclusion constraint so two concurrent confirms/bookings
-- can never hold overlapping (assigned/confirmed) windows for one counselor.
-- Pending (unassigned, counselor_id NULL) rows are unaffected (NULL <> NULL),
-- and terminal rows (completed/cancelled/no_show/rejected) are excluded via
-- the WHERE clause. App-level validateCounselorSchedule() stays the friendly
-- first gate; this is the race-proof backstop (23P01 -> "just taken").
--
-- P5: composite indexes matching the actual WHERE/JOIN/ORDER BY in the
-- dashboard/report/board queries. All IF NOT EXISTS (safe re-run).

create extension if not exists "btree_gist";

-- ── P5 composite / covering indexes ──

create index if not exists appointments_counselor_status_sched_idx
  on public.appointments (counselor_id, status, scheduled_at desc);
create index if not exists appointments_status_sched_idx
  on public.appointments (status, scheduled_at desc);
create index if not exists appointments_student_sched_idx
  on public.appointments (student_id, scheduled_at desc);
create index if not exists referrals_assigned_status_idx
  on public.referrals (assigned_counselor_id, status, created_at desc);
create index if not exists referrals_status_created_idx
  on public.referrals (status, created_at desc);
create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at);
create index if not exists notifications_profile_read_created_idx
  on public.notifications (profile_id, is_read, created_at desc);
create index if not exists pss10_student_created_idx
  on public.pss10_assessments (student_id, created_at desc);
create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_events_created_idx
  on public.audit_events (created_at desc);
create index if not exists referral_actions_referral_created_idx
  on public.referral_actions (referral_id, created_at desc);
create index if not exists staff_messages_recipient_read_idx
  on public.staff_messages (recipient_profile_id, is_read, created_at desc);

-- ── P12 exclusion constraint (race backstop) ──
-- Wrapped in a DO block so pre-existing overlapping rows (seed/dev data)
-- emit a NOTICE instead of failing the whole deploy. New writes are still
-- guarded once the constraint exists; clean up overlaps then re-run the
-- ADD CONSTRAINT manually.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'no_counselor_overlap'
  ) then
    begin
      alter table public.appointments
        add constraint no_counselor_overlap
        exclude using gist (
          counselor_id with =,
          tstzrange(scheduled_at, coalesce(ends_at, scheduled_at + interval '1 hour')) with &&
        )
        where (status in ('assigned', 'confirmed'));
    exception
      when others then
        raise notice '00059: no_counselor_overlap skipped (likely overlapping existing rows): %', SQLERRM;
    end;
  end if;
end
$$;
