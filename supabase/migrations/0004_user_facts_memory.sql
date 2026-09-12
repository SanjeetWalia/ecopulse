-- 0004_user_facts_memory.sql — Section N
--
-- Two changes to the memory layer:
--
-- 1. `origin` separates what the user SAID from what the app WORKED OUT
--    (OBS-015). Without it, a nightly job writing "typical weekday: 31 lb"
--    is indistinguishable from the user having told us that, and the app
--    would eventually repeat its own guesses back as fact.
--
-- 2. `confidence` and `last_confirmed_at` support re-confirmation. Stale
--    memory is worse than no memory: someone who sold the Civic in March
--    should not still be getting Civic-calibrated numbers in December.

ALTER TABLE public.user_facts
  ADD COLUMN IF NOT EXISTS source            TEXT    DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS origin            TEXT    DEFAULT 'stated',
  ADD COLUMN IF NOT EXISTS confidence        NUMERIC DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;

-- Everything written before this migration came from eco-chat extracting the
-- user's own words, so 'stated' is correct for the backfill.
UPDATE public.user_facts
   SET origin = 'stated'
 WHERE origin IS NULL;

UPDATE public.user_facts
   SET last_confirmed_at = COALESCE(last_confirmed_at, updated_at)
 WHERE origin = 'stated';

DO $$ BEGIN
  ALTER TABLE public.user_facts
    ADD CONSTRAINT user_facts_origin_check CHECK (origin IN ('stated', 'observed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_facts
    ADD CONSTRAINT user_facts_confidence_check CHECK (confidence >= 0 AND confidence <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS user_facts_user_origin_idx
  ON public.user_facts (user_id, origin, updated_at DESC);

-- Facts a user has not restated in 90 days, for the re-confirmation pass (N6).
CREATE OR REPLACE VIEW public.user_facts_due_confirmation AS
  SELECT user_id, key, fact_type, value, last_confirmed_at
    FROM public.user_facts
   WHERE origin = 'stated'
     AND COALESCE(last_confirmed_at, updated_at) < NOW() - INTERVAL '90 days';
