-- 00077_head_referral_analytics: range-aware aggregates for the head dashboard.
--
-- WHY: the guidance-head dashboard now has a period filter (today / 7 days /
-- 30 days / custom) and charts for referral trend, urgency, and the official
-- paper-form case classification. `head_referral_status_counts` (00061) already
-- handles status counts for a window; these two helpers add the missing series
-- without pulling raw referral rows into the web app.
--
-- SECURITY: SECURITY INVOKER (default), matching 00061 — RLS filters rows
-- before aggregation, and the route already role-gates guidance_head.

-- Referral counts per created_at day (trend source).
create or replace function public.head_referral_daily_counts(
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (day date, referrals bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select r.created_at::date as day, count(*) as referrals
  from public.referrals r
  where r.created_at >= from_ts
    and r.created_at < to_ts
  group by 1
  order by 1;
$$;

-- One row per (dimension, key) for status / priority / classification.
-- Classification is multi-select on the paper form, so `unnest` means one
-- referral can contribute to more than one classification bucket.
create or replace function public.head_referral_breakdowns(
  from_ts timestamptz default null,
  to_ts timestamptz default null
)
returns table (dimension text, key text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select r.status, r.priority, r.case_classification
    from public.referrals r
    where (from_ts is null or r.created_at >= from_ts)
      and (to_ts is null or r.created_at < to_ts)
  )
  select 'status'::text, s.status, count(*)
  from scoped s
  group by s.status
  union all
  select 'priority'::text, s.priority, count(*)
  from scoped s
  group by s.priority
  union all
  select 'classification'::text, c, count(*)
  from scoped s, unnest(s.case_classification) as c
  group by c;
$$;

grant execute on function public.head_referral_daily_counts(timestamptz, timestamptz) to authenticated;
grant execute on function public.head_referral_breakdowns(timestamptz, timestamptz) to authenticated;
