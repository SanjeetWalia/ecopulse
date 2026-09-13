-- supabase/run-once/2026-09-13-editor.sql
--
-- Statements that cannot live in a migration, because they need a secret or
-- because they are an audit rather than a schema change. Run these by hand in
-- the Supabase SQL editor, in order. Migrations 0001-0005 go through
-- `supabase db push` and are NOT repeated here.

-- ══════════════════════════════════════════════════════════════════════
-- STEP 0a — Confirm the push actually landed (read-only)
-- ══════════════════════════════════════════════════════════════════════
-- Both RPCs present, and callable by authenticated users only.
SELECT p.proname,
       p.prosecdef            AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('redeem_invite_code', 'delete_account');

-- 0003 is silent about whether it created delete_account or skipped an
-- existing one. If it created ours, the body is the reconstruction below and
-- is worth reading before anyone relies on it.
SELECT pg_get_functiondef(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'delete_account';

-- The Section N columns.
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'user_facts'
 ORDER BY ordinal_position;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 0 — What RLS policies actually exist? (read-only)
-- ══════════════════════════════════════════════════════════════════════
-- The v3 tables were created in the dashboard, so their policies were never
-- committed and this repo does not know their names. Migration 0001 therefore
-- refuses to add policies to any table that already has some — Postgres OR-s
-- permissive policies together, so adding one to an already-protected table
-- widens access instead of restoring it.
--
-- Run this, then compare against the intended rules in 0001.

SELECT tablename, policyname, cmd, permissive, roles, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('shared_snaps', 'leaves', 'eco_chat_messages', 'user_facts', 'friendships', 'invite_codes')
 ORDER BY tablename, policyname;

-- Tables with RLS enabled but NO policy are readable by nobody and writable
-- by nobody through the anon/authenticated keys. Tables with RLS DISABLED are
-- wide open. Both are worth knowing about (D1 in ROADMAP.md).
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       COUNT(p.policyname) AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 GROUP BY 1, 2
 ORDER BY rls_enabled, policies, table_name;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 1 — Audit the OBS-022 fallout (read-only, run this first)
-- ══════════════════════════════════════════════════════════════════════
-- Invite codes were never actually being marked used: the client UPDATE
-- matched zero rows under the invite_codes_own RLS policy, and Postgres
-- reports no error for an update that matches nothing. Find out what the
-- table actually believes.

SELECT
  COALESCE(status, 'unused')          AS status,
  COUNT(*)                            AS codes,
  COUNT(used_by)                      AS with_a_redeemer,
  SUM(COALESCE(uses, 0))              AS total_uses
FROM public.invite_codes
GROUP BY 1
ORDER BY 1;

-- Which codes were handed out but never recorded as spent? Cross-check
-- against who actually has an account.
SELECT
  ic.code,
  COALESCE(ic.status, 'unused') AS status,
  ic.uses,
  ic.used_by,
  ic.created_at,
  p.username                    AS redeemed_by_username
FROM public.invite_codes ic
LEFT JOIN public.profiles p ON p.id = ic.used_by
ORDER BY ic.created_at;

-- Codes that more than one person may have used: any code still 'unused'
-- while a profile exists that was created after it was issued is worth a
-- manual look. There is no per-use log, which is itself the lesson.

-- ══════════════════════════════════════════════════════════════════════
-- STEP 2 — Backfill the codes you know were spent (EDIT BEFORE RUNNING)
-- ══════════════════════════════════════════════════════════════════════
-- Only run this once Step 1 has told you which codes were genuinely used.
-- Replace the code list. This does not guess.
--
-- UPDATE public.invite_codes
--    SET status  = 'used',
--        used_at = COALESCE(used_at, NOW()),
--        uses    = GREATEST(COALESCE(uses, 0), 1)
--  WHERE code IN ('CODE1', 'CODE2');

-- ══════════════════════════════════════════════════════════════════════
-- STEP 3 — Store the service key in Vault (once, ever)
-- ══════════════════════════════════════════════════════════════════════
-- Needed so the scheduled job can call an edge function. Paste the real key
-- in place of the placeholder. Do not commit the result of this statement.
-- Skip if a secret named 'service_role_key' already exists:
--   SELECT name FROM vault.secrets WHERE name = 'service_role_key';

SELECT vault.create_secret(
  'PASTE_SERVICE_ROLE_KEY_HERE',
  'service_role_key',
  'For scheduled edge functions'
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 4 — Schedule observe-facts nightly (OBS-023)
-- ══════════════════════════════════════════════════════════════════════
-- Migration 0005 enables pg_cron and pg_net. This creates the job itself.
-- 07:20 UTC is a quiet hour in every timezone the app currently serves.

SELECT cron.schedule(
  'observe-facts-nightly',
  '20 7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yzeslhdoviwahtunthor.supabase.co/functions/v1/observe-facts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 5 — Confirm it is actually running (check tomorrow)
-- ══════════════════════════════════════════════════════════════════════

SELECT jobid, jobname, schedule, active FROM cron.job;

SELECT jobid, status, return_message, start_time, end_time
  FROM cron.job_run_details
 ORDER BY start_time DESC
 LIMIT 10;

-- And that facts are landing:
SELECT origin, COUNT(*), MAX(updated_at) AS newest
  FROM public.user_facts
 GROUP BY origin;

-- ══════════════════════════════════════════════════════════════════════
-- Rollback for step 4, if you need it
-- ══════════════════════════════════════════════════════════════════════
-- SELECT cron.unschedule('observe-facts-nightly');
