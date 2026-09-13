-- 00000_extensions: Postgres extensions required by later migrations.
-- Must sort first so `supabase db reset` and manual applies work on a fresh
-- project. `gen_random_uuid()` (used for every PK default) lives in pgcrypto.

create extension if not exists "pgcrypto";
