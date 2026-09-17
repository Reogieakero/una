-- 00047_confirm_note_mode_backfill: append the session mode to confirm trail
-- notes written before the note format gained the " (<mode>)" suffix.
-- Source of truth is the minted session row (appointments.mode) matched via
-- source_referral_id; latest session wins on re-confirms. Idempotent: notes
-- already carrying a parenthetical suffix are skipped, so re-runs change
-- nothing. Read-only except the targeted note append — no status or
-- assignment data is touched.

update public.referral_actions ra
set note = ra.note || ' (' || latest.mode || ')'
from (
  select distinct on (source_referral_id) source_referral_id, mode
  from public.appointments
  where source_referral_id is not null
    and mode in ('in_person', 'online')
  order by source_referral_id, created_at desc
) as latest
where ra.action = 'confirmed'
  and ra.note like 'Session scheduled for %'
  and ra.note not like '% (%)'
  and latest.source_referral_id = ra.referral_id;
