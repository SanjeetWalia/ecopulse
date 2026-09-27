-- supabase/run-once/2026-09-27-v5.sql
--
-- Hand-run steps for v5 that can't live in a migration. Run in the Supabase
-- SQL editor AFTER `supabase db push` has applied 0007, and after the three
-- new functions are deployed (see supabase/run-once/2026-09-27-v5-setup.md).
-- Assumes the Vault secret 'service_role_key' from the 13 Sep file exists.

-- ══════════════════════════════════════════════════════════════════════
-- STEP 1 — Confirm 0007 landed (read-only)
-- ══════════════════════════════════════════════════════════════════════
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('user_entitlements', 'streak_days', 'check_ins', 'repair_credits',
                      'chain_rewards', 'fact_library', 'heads_up_items', 'watch_items', 'heads_up_matches')
 ORDER BY 1;                                   -- expect 9 rows

SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname IN ('save_onboarding', 'keep_day', 'answer_check_in', 'use_streak_repair', 'get_chain',
                   'mark_heads_up_seen', 'credit_repair_purchase', 'match_heads_up_item')
 ORDER BY 1;                                   -- expect 8 rows

-- ══════════════════════════════════════════════════════════════════════
-- STEP 2 — Keep current testers free for a year (X9 promised free)
-- ══════════════════════════════════════════════════════════════════════
-- Everyone who has an account today gets grandfathered access until
-- 27 Sep 2027. New sign-ups after this run hit the paywall as normal.
-- Skip this step if you decide not to grandfather.
INSERT INTO public.user_entitlements (user_id, status, grandfathered_until)
SELECT id, 'none', TIMESTAMPTZ '2027-09-27 00:00:00+00'
  FROM public.profiles
ON CONFLICT (user_id) DO UPDATE
  SET grandfathered_until = EXCLUDED.grandfathered_until;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 3 — Pull recalls once a day
-- ══════════════════════════════════════════════════════════════════════
-- 13:10 UTC, after the FDA's usual weekday updates. The function checks the
-- bearer against the service role key, so only this job can run it.
SELECT cron.schedule(
  'recall-sync-daily',
  '10 13 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yzeslhdoviwahtunthor.supabase.co/functions/v1/recall-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Run it once now instead of waiting for tomorrow, then check the result.
SELECT net.http_post(
  url     := 'https://yzeslhdoviwahtunthor.supabase.co/functions/v1/recall-sync',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
  ),
  body    := '{}'::jsonb
);
-- A minute later:
SELECT kind, count(*) FROM public.heads_up_items GROUP BY kind;
SELECT count(*) AS matches FROM public.heads_up_matches;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 4 — Verify (read-only)
-- ══════════════════════════════════════════════════════════════════════
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
SELECT subject_key, slot, left(text, 60) FROM public.fact_library ORDER BY 1, 2;
