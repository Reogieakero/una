-- 00068_pre_session_pss10: a fresh PSS-10 before every session.
--
-- Objective 2 closes two gaps here:
--   1. The booking gate is a 30-day freshness check. A session now also needs
--      an assessment linked to that appointment, submitted within 7 days
--      before the scheduled start (enforced in shared-services at completion).
--   2. Students may retake the check-in for the same appointment, so the
--      one-assessment-per-appointment unique index has to go.
--
-- No data is deleted. Existing assessments and appointments are preserved.

-- ── §1 Allow retakes for the same appointment ────────────────────────────
-- 00020 added this unique index; a retake would violate it. Keep the lookup
-- index but make it non-unique and ordered for "latest check-in" reads.
drop index if exists public.pss10_appointment_unique;
create index if not exists pss10_appointment_created_idx
  on public.pss10_assessments (appointment_id, created_at desc);

-- ── §2 Appointment check-in state ────────────────────────────────────────
alter table public.appointments
  add column if not exists pss10_required boolean not null default true,
  add column if not exists pss10_waived_at timestamptz,
  add column if not exists pss10_waiver_reason text;

-- Waiver text is operational context only (walk-in, referral, student unable
-- to complete the form) — never clinical detail. Keep it bounded.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_pss10_waiver_reason_check'
  ) then
    alter table public.appointments
      add constraint appointments_pss10_waiver_reason_check
      check (
        pss10_waiver_reason is null
        or char_length(btrim(pss10_waiver_reason)) between 10 and 500
      );
  end if;
end $$;

-- Grandfather sessions that were already confirmed when this policy shipped:
-- deploy must not retroactively block a counselor from completing real care.
update public.appointments
  set pss10_required = false
  where status in ('confirmed', 'completed', 'no_show')
    and pss10_waived_at is null;

-- ── §3 Students may link only their own appointment ──────────────────────
-- 00008 allowed any own-student assessment, including another student's
-- appointment id. Tighten the insert policy: an appointment link is valid
-- only when that appointment belongs to the same student.
drop policy if exists "pss10_insert_own" on public.pss10_assessments;
create policy "pss10_insert_own"
  on public.pss10_assessments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = pss10_assessments.student_id and s.profile_id = auth.uid()
    )
    and (
      pss10_assessments.appointment_id is null
      or exists (
        select 1 from public.appointments a
        where a.id = pss10_assessments.appointment_id
          and a.student_id = pss10_assessments.student_id
      )
    )
  );

-- ── §4 Analytics: one latest assessment per appointment ──────────────────
-- Retakes would fan out the old direct join (one appointment counted once per
-- linked assessment). Recreate the 00020 dictionary-superset view with a
-- lateral join that keeps only the newest linked assessment.
drop view if exists public.analytics_daily_summary;

create view public.analytics_daily_summary as
with daily as (
  select
    date_trunc('day', a.created_at)::date as day,
    count(a.id)::int as total_appointments,
    count(a.id) filter (where a.status = 'completed')::int as completed_appointments,
    avg(p.total_score)::float as avg_pss10,
    count(a.id) filter (where p.band = 'high')::int as high_stress_count,
    avg(
      extract(epoch from (a.confirmed_datetime - a.requested_datetime)) / 60.0
    ) filter (where a.confirmed_datetime is not null and a.requested_datetime is not null)::float
      as avg_response_time_minutes
  from public.appointments a
  left join lateral (
    select
      p.total_score,
      coalesce(p.stress_level, p.band) as band
    from public.pss10_assessments p
    where p.appointment_id = a.id
    order by p.created_at desc
    limit 1
  ) p on true
  group by 1
),
referrals_per_day as (
  select r.created_at::date as day, count(*)::int as total_referrals
  from public.referrals r
  group by 1
),
top_concern_per_day as (
  select day, val as top_concern_type
  from (
    select
      date_trunc('day', created_at)::date as day,
      coalesce(concern_type, concern) as val,
      row_number() over (
        partition by date_trunc('day', created_at)::date order by count(*) desc
      ) as rn
    from public.appointments
    where coalesce(concern_type, concern) is not null
    group by 1, 2
  ) s
  where rn = 1
)
select
  d.day,
  d.day as summary_date,
  d.total_appointments,
  d.completed_appointments,
  d.avg_pss10,
  d.avg_pss10 as avg_pss10_score,
  d.high_stress_count,
  t.top_concern_type,
  null::uuid as counselor_id,
  d.avg_response_time_minutes,
  coalesce(r.total_referrals, 0) as total_referrals
from daily d
left join referrals_per_day r on r.day = d.day
left join top_concern_per_day t on t.day = d.day
order by 1 desc;
