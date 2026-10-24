-- 00071_analytics_trends_quality: longitudinal/cohort wellbeing, data quality,
-- and scheduled digest storage.
--
-- WHY: Objective 5 currently reports aggregate snapshots. This migration adds
-- head-only aggregate trend/cohort RPCs, a data-quality snapshot, and the
-- report_digests table used by the in-app scheduled digest. Nothing here
-- returns a student id, alias, note, or free-text clinical content.
--
-- SECURITY: aggregates only; every RPC checks current_user_role() against
-- guidance_head/admin and uses SECURITY DEFINER so a caller cannot widen the
-- query. report_digests is readable only by head/admin.

-- ── wellbeing trend (daily screening bands) ───────────────────────────────

create or replace function public.head_wellbeing_trends(
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (
  day date,
  screenings bigint,
  low bigint,
  moderate bigint,
  high bigint,
  avg_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.created_at::date as day,
    count(*)::bigint as screenings,
    count(*) filter (where p.band = 'low')::bigint as low,
    count(*) filter (where p.band = 'moderate')::bigint as moderate,
    count(*) filter (where p.band = 'high')::bigint as high,
    round(avg(p.total_score)::numeric, 1) as avg_score
  from public.pss10_assessments p
  where (public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role')
    and (from_ts is null or p.created_at >= from_ts)
    and (to_ts is null or p.created_at < to_ts)
  group by 1
  order by 1;
$$;

revoke all on function public.head_wellbeing_trends(timestamptz, timestamptz) from public;
grant execute on function public.head_wellbeing_trends(timestamptz, timestamptz) to authenticated;

-- ── cohort stress (aggregate by program / year / college) ─────────────────

create or replace function public.head_cohort_stress(
  from_ts timestamptz,
  to_ts timestamptz,
  group_by text default 'program'
)
returns table (
  cohort text,
  screenings bigint,
  high bigint,
  avg_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      case
        when group_by = 'year_level' then s.year_level
        when group_by = 'college' then s.college
        else s.program
      end,
      'Unspecified'
    ) as cohort,
    count(*)::bigint as screenings,
    count(*) filter (where p.band = 'high')::bigint as high,
    round(avg(p.total_score)::numeric, 1) as avg_score
  from public.pss10_assessments p
  join public.students s on s.id = p.student_id
  where (public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role')
    and group_by in ('program', 'year_level', 'college')
    and (from_ts is null or p.created_at >= from_ts)
    and (to_ts is null or p.created_at < to_ts)
  group by 1
  order by screenings desc
  limit 50;
$$;

revoke all on function public.head_cohort_stress(timestamptz, timestamptz, text) from public;
grant execute on function public.head_cohort_stress(timestamptz, timestamptz, text) to authenticated;

-- ── data-quality snapshot ─────────────────────────────────────────────────

create or replace function public.head_data_quality()
returns table (
  completed_sessions bigint,
  completed_without_note bigint,
  screenings_unlinked bigint,
  referrals_unassigned bigint,
  feedback_responses bigint,
  feedback_coverage numeric,
  summary_last_day date,
  summary_age_days int
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      (select count(*) from public.appointments a where a.status = 'completed')::bigint as completed,
      (
        select count(*)
        from public.appointments a
        where a.status = 'completed'
          and not exists (select 1 from public.session_notes n where n.appointment_id = a.id)
      )::bigint as missing_notes,
      (
        select count(*)
        from public.pss10_assessments p
        where p.appointment_id is null
      )::bigint as unlinked,
      (
        select count(*)
        from public.referrals r
        where r.assigned_counselor_id is null
          and r.status in ('pending', 'assigned', 'acknowledged', 'in_progress', 'confirmed', 'escalated')
      )::bigint as unassigned,
      (select count(*) from public.feedback)::bigint as responses,
      (select max(day) from public.analytics_daily_summary) as last_day
  )
  select
    base.completed,
    base.missing_notes,
    base.unlinked,
    base.unassigned,
    base.responses,
    case
      when base.completed > 0 then round((base.responses::numeric / base.completed::numeric) * 100, 1)
      else null
    end,
    base.last_day,
    case when base.last_day is null then null else (now()::date - base.last_day) end
  from base
  where (public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role');
$$;

revoke all on function public.head_data_quality() from public;
grant execute on function public.head_data_quality() to authenticated;

-- ── scheduled digest snapshot ─────────────────────────────────────────────

create or replace function public.head_report_digest(
  from_ts timestamptz,
  to_ts timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with appts as (
    select
      count(*)::int as total,
      count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status in ('cancelled', 'rejected', 'no_show'))::int as missed
    from public.appointments
    where (public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role')
      and (from_ts is null or scheduled_at >= from_ts)
      and (to_ts is null or scheduled_at < to_ts)
  ),
  refs as (
    select
      count(*)::int as total,
      count(*) filter (where status = 'resolved')::int as resolved,
      count(*) filter (
        where assigned_counselor_id is null
          and status in ('pending', 'assigned', 'acknowledged', 'in_progress', 'confirmed', 'escalated')
      )::int as unassigned
    from public.referrals
    where (public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role')
      and (from_ts is null or created_at >= from_ts)
      and (to_ts is null or created_at < to_ts)
  ),
  pss as (
    select
      count(*)::int as screenings,
      count(*) filter (where band = 'high')::int as high,
      round(avg(total_score)::numeric, 1) as avg_score
    from public.pss10_assessments
    where (public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role')
      and (from_ts is null or created_at >= from_ts)
      and (to_ts is null or created_at < to_ts)
  ),
  quality as (
    select completed_without_note, referrals_unassigned, summary_age_days
    from public.head_data_quality()
  )
  select jsonb_build_object(
    'from', from_ts,
    'to', to_ts,
    'appointments', (select to_jsonb(appts) from appts),
    'referrals', (select to_jsonb(refs) from refs),
    'wellbeing', (select to_jsonb(pss) from pss),
    'quality', (select to_jsonb(quality) from quality)
  );
$$;

revoke all on function public.head_report_digest(timestamptz, timestamptz) from public;
grant execute on function public.head_report_digest(timestamptz, timestamptz) to authenticated;

-- ── persisted digests ────────────────────────────────────────────────────

create table if not exists public.report_digests (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_to uuid references public.profiles(id) on delete set null
);

create index if not exists report_digests_created_idx
  on public.report_digests (created_at desc);

alter table public.report_digests enable row level security;

drop policy if exists "report_digests_head_read" on public.report_digests;
create policy "report_digests_head_read"
  on public.report_digests for select to authenticated
  using ((public.current_user_role() in ('guidance_head', 'admin') or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'));

-- Writes are performed by the cron route's service-role client. No insert
-- policy is granted to authenticated callers.
