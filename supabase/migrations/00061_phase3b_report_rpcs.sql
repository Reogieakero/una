-- 00061_phase3b_report_rpcs: aggregate-in-SQL helpers for dashboards (P1/P2/P20).
--
-- WHY: the head dashboard pulled 500 appointment rows + 1000 referral rows
-- on every load just to bucket them into a 7-day bar chart and a status
-- donut in JS. These RPCs return the buckets directly (≤31 rows).
--
-- SECURITY: SECURITY INVOKER (default) — RLS policies apply per row before
-- aggregation, so a counselor calling these only ever aggregates rows they
-- may read. Routes already role-gate; this keeps defense in depth.

-- Daily session counts by scheduled date (weekChart source).
create or replace function public.head_appointment_daily_counts(
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (day date, sessions bigint)
language sql
stable
set search_path = public
as $$
  select a.scheduled_at::date as day, count(*) as sessions
  from public.appointments a
  where a.scheduled_at >= from_ts
    and a.scheduled_at < to_ts
  group by 1
  order by 1;
$$;

-- Referral counts by status, optional created_at window (statusChart source).
create or replace function public.head_referral_status_counts(
  from_ts timestamptz default null,
  to_ts timestamptz default null
)
returns table (status text, count bigint)
language sql
stable
set search_path = public
as $$
  select r.status as status, count(*) as count
  from public.referrals r
  where (from_ts is null or r.created_at >= from_ts)
    and (to_ts is null or r.created_at < to_ts)
  group by 1;
$$;
