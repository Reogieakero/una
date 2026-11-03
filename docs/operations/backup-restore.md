# Backup & restore runbook — DOrSU Guidance

**Backups** run head-managed from `/backups` (manual any time + automatic
nightly 02:00 PHT via Vercel Cron): one gzipped, sha256-checksummed JSON
artifact per run in the private `system-backups` bucket, tracked in
`backup_runs`, downloads audit-logged. **Restore is deliberately NOT a
button** — follow this procedure.

> Plan note: the nightly `0 18 * * *` schedule is the Hobby-safe maximum —
> Vercel Free rejects sub-daily expressions at deploy time. Denser cadence
> needs a Pro plan, or point an external scheduler (cron-job.org, QStash,
> GitHub Actions) at `GET /api/admin/backups/cron` with
> `Authorization: Bearer <CRON_SECRET>` — same endpoint, same audit trail.

## What an artifact holds

- `version`, `run_id`, `exported_at`, and `tables: { <table>: [rows...] }`
  for the app tables (profiles, students, counselors, appointments,
  referrals, session notes + attachment metadata, chat, feedback,
  notifications, announcements, settings, audit/security logs).
- NOT included: Supabase Auth users (`auth.users` — recreate first, below),
  the `backup_runs` history itself, or storage-bucket BYTES (announcement
  covers, session-note images stay in their private buckets; attachment rows
  carry storage paths so you can re-verify them after).

## Restore procedure

> Rule 0: restore into a **staging project first**, verify, then production.
> Never restore straight into the live database.

1. **Download** the newest `Completed` artifact from `/backups` (link lives
   30 minutes; the download is audit-logged to the acting head).
2. **Verify integrity** before touching any database:
   `gunzip -c <run-id>.json.gz | sha256sum` — must equal the run's checksum
   shown on the `/backups` row. Mismatch = stop, re-download, investigate.
3. **Recreate auth users first.** `profiles.id` references `auth.users` —
   restoring profiles before their auth users exist fails on the FK. Recreate
   each user in Supabase Dashboard → Authentication (same email; passwords
   are re-issued, users reset them via login → reset-password).
4. **Upsert tables in FK order** (parents before children), e.g.:
   `profiles` → `students`, `counselors`, `faculty_members`,
   `guidance_personnel`, `workspace_settings`, `device_tokens` →
   `counselor_availability`, `referrals`, `referral_actions` →
   `appointments` → `pss10_assessments`, `feedback`, `session_notes`,
   `session_note_attachments`, `chat_threads`, `chat_messages`,
   `staff_messages`, `notifications`, `announcements` →
   `audit_logs`, `break_glass_logs`, `audit_events` last.
   Sketch (Python + psycopg, `*_id` UUIDs preserved so links survive):
   ```python
   import gzip, json, psycopg
   bundle = json.load(gzip.open("RUN_ID.json.gz", "rt"))
   ORDER = ["profiles","students","counselors","faculty_members",
            "guidance_personnel","workspace_settings","device_tokens",
            "counselor_availability","referrals","referral_actions",
            "appointments","pss10_assessments","feedback","session_notes",
            "session_note_attachments","chat_threads","chat_messages",
            "staff_messages","notifications","announcements",
            "audit_logs","break_glass_logs","audit_events"]
   db = psycopg.connect("postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres")
   with db, db.cursor() as cur:
       for table in ORDER:
           for row in bundle["tables"].get(table, []):
               cols = list(row.keys())
               vals = [json.dumps(v) if isinstance(v,(dict,list)) else v for v in row.values()]
               ph = ",".join(["%s"] * len(cols))
               upd = ",".join(f"{c}=EXCLUDED.{c}" for c in cols if c != "id")
               cur.execute(f'INSERT INTO public."{table}" ({",".join(cols)}) '
                           f"VALUES ({ph}) ON CONFLICT (id) DO UPDATE SET {upd}", vals)
   ```
   Tables with a non-`id` primary key (`workspace_settings.key`) need the
   `ON CONFLICT` target adjusted to their key.
5. **Verify**: per-table counts must equal the run's `row_counts`
   (`SELECT count(*) …`); spot-check `session_notes`, `appointments`, and
   one `storage_path` from `session_note_attachments` against its bucket.
6. **Cut over** (staging-proven only): point the app at the recovered
   project (env URLs) or promote staging per Supabase docs; confirm login,
   board loads, and realtime toasts before announcing all-clear.

## Cadence & retention

- Nightly automatic + manual before risky changes (migrations, bulk edits).
- Drill this restore on staging **quarterly** — an untested backup is a hope.
- Runs accumulate by design (no auto-delete); prune old artifacts from the
  Storage dashboard deliberately, newest-Recoverable-Plus-One minimum.
- Platform (Supabase) physical backups remain the disaster tier below this;
  know the project plan's retention in the Supabase dashboard.
