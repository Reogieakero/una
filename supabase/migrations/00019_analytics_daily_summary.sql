-- 00019_analytics_daily_summary: aggregated view for the (admin) analytics screens.
-- No PII: counts + averages only, so it can back Recharts without RLS on raw rows.
--
-- NOTE: referrals-per-day is pre-aggregated in a CTE and joined (not a
-- correlated subquery on the ungrouped `created_at`), because Postgres
-- rejects outer references to ungrouped columns inside an aggregate query.

create or replace view public.analytics_daily_summary as
with daily as (
  select
    date_trunc('day', a.created_at)::date as day,
    count(a.id)::int as total_appointments,
    count(a.id) filter (where a.status = 'completed')::int as completed_appointments,
    avg(p.total_score)::float as avg_pss10,
    count(p.id) filter (where p.band = 'high')::int as high_stress_count
  from public.appointments a
  left join public.pss10_assessments p on p.appointment_id = a.id
  group by 1
),
referrals_per_day as (
  select r.created_at::date as day, count(*)::int as total_referrals
  from public.referrals r
  group by 1
)
select
  d.day,
  d.total_appointments,
  d.completed_appointments,
  d.avg_pss10,
  d.high_stress_count,
  coalesce(r.total_referrals, 0) as total_referrals
from daily d
left join referrals_per_day r on r.day = d.day
order by 1 desc;
