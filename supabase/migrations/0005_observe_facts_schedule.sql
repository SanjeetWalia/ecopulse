-- 0005_observe_facts_schedule.sql — Section N3
--
-- Runs observe-facts once a night. Observed facts are computed server-side
-- because they have to exist whether or not anyone opens the app, and because
-- Sections O and P read them on their own schedule.
--
-- This migration only enables the extensions. The schedule itself needs the
-- project's service key, which must not live in a committed file — create it
-- once from the SQL editor using the statement at the bottom, with the key
-- pulled from Vault.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Run once, by hand, in the Supabase SQL editor:
--
--   SELECT vault.create_secret(
--     '<SERVICE_ROLE_KEY>', 'service_role_key', 'For scheduled edge functions'
--   );
--
--   SELECT cron.schedule(
--     'observe-facts-nightly',
--     '20 7 * * *',                      -- 07:20 UTC, a quiet hour everywhere
--     $$
--     SELECT net.http_post(
--       url     := 'https://yzeslhdoviwahtunthor.supabase.co/functions/v1/observe-facts',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--       ),
--       body    := '{}'::jsonb
--     );
--     $$
--   );
--
-- To confirm it is running:  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
