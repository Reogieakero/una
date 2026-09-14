-- 00033_referral_assigned_confirmed_rejected: role-separated workflow.
--
-- Referrals mirror the appointment lifecycle (00029), with a different start
-- line: appointments start from the student booking directly, referrals start
-- from faculty flagging a student for session. Same role split:
--
--   pending (faculty flagged, no counselor)
--     -> assigned   (admin/guidance_head assigns a counselor)
--     -> rejected   (admin/guidance_head rejects the referral)
--   assigned
--     -> confirmed  (counselor confirms, session gets scheduled)
--     -> rejected   (admin rejects)
--     -> pending    (admin unassigns, counselor cleared)
--   confirmed
--     -> resolved   (counselor, session done — still requires a confirmed
--                    session with a schedule, enforced in triageReferral)
--
-- Terminal: resolved, rejected.
-- Legacy: acknowledged, in_progress, escalated stay valid so existing rows
-- keep working; new flow uses assigned/confirmed.
--
-- Admin (guidance_head) may only assign + reject.
-- Counselor may only confirm + resolve (+ legacy acknowledge/start).
-- Faculty only flags (create).

alter table public.referrals
  drop constraint if exists referrals_status_check;

-- Superset: dictionary (§5) + legacy + new role-separated stages.
alter table public.referrals
  add constraint referrals_status_check
  check (status in ('submitted','under_review','action_taken','closed','pending','assigned','acknowledged','in_progress','confirmed','resolved','escalated','rejected'));

-- Backfill: pending rows that already have a counselor were assigned
-- under the old flow — mark them assigned so the board is truthful.
update public.referrals
set status = 'assigned', updated_at = now()
where status = 'pending' and assigned_counselor_id is not null;
