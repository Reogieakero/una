-- 00048_action_actor_name: stamp the actor's display name on each trail row.
--
-- WHY: faculty cannot read other profiles via RLS (00022), so resolving
-- actor names client-side always blanked for them ("Guidance office").
-- The name is written by the actor's own session (everyone may read their
-- OWN profile row), and faculty may read referral_actions (00016) — so the
-- stamped name is visible exactly where the join is not. Backfills existing
-- rows from profiles (migration runs as owner, bypasses RLS).

alter table public.referral_actions
  add column if not exists actor_name text;

update public.referral_actions ra
set actor_name = p.full_name
from public.profiles p
where ra.actor_name is null
  and p.id = ra.actor_profile_id
  and p.full_name is not null;
