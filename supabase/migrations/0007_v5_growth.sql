-- 0007_v5_growth.sql — the v5 growth loop
--
-- Backs the screens built in the v5 UI pass (branch v5-growth):
--   onboarding answers, entitlement (7-day trial, then $10 a month), streak
--   days, check-ins, streak repairs, the chain and its rewards, the sourced
--   fact library the camera reads draw on, and Heads up (items, watch list,
--   matches).
--
-- Decisions this encodes (claude/PRICING-MODEL.md, 27 Sep 2026):
--   • No free tier. Entitlement is written only by the RevenueCat webhook
--     (service role); clients can read their own row and nothing else.
--   • A key from a kept pact halves the first paid month for both people.
--     Chain rewards are granted when the invitee PAYS their first month,
--     never at sign-up, so throwaway accounts can't farm them.
--   • Each new paying link gives everyone in that chain a free streak repair.
--   • A streak repair can fix yesterday only.
--
-- Additive only. Nothing is dropped or narrowed. Safe to run while build 18
-- and build 19 are both in testers' hands.

-- ─── onboarding ─────────────────────────────────────────────────────────────
-- timezone already exists in production (authStore syncs it on launch) but
-- was never committed; declared here so a rebuild has it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding   JSONB,
  ADD COLUMN IF NOT EXISTS timezone     TEXT;

-- Writes the six answers as stated facts (origin = 'stated'), so they appear
-- in You → What Eco Pulse remembers and calibrate every estimate.
CREATE OR REPLACE FUNCTION public.save_onboarding(p_answers JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_key TEXT;
  v_map JSONB := jsonb_build_object(
    'transport', 'transport_mode',
    'car',       'car',
    'diet',      'diet',
    'drink',     'daily_drink',
    'household', 'household_size',
    'city',      'home_city',
    'currency',  'motivation'
  );
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'save_onboarding requires an authenticated session';
  END IF;

  UPDATE public.profiles
     SET onboarded_at = COALESCE(onboarded_at, NOW()),
         onboarding   = p_answers
   WHERE id = v_uid;

  FOR v_key IN SELECT jsonb_object_keys(p_answers) LOOP
    CONTINUE WHEN NOT (v_map ? v_key);
    CONTINUE WHEN COALESCE(p_answers ->> v_key, '') = '';
    INSERT INTO public.user_facts (user_id, key, fact_type, value, source, origin, confidence, last_confirmed_at)
    VALUES (v_uid, v_map ->> v_key, 'onboarding', to_jsonb(p_answers ->> v_key), 'onboarding', 'stated', 0.9, NOW())
    ON CONFLICT (user_id, key) DO UPDATE
      SET value = EXCLUDED.value,
          source = 'onboarding',
          origin = 'stated',
          confidence = 0.9,
          last_confirmed_at = NOW(),
          updated_at = NOW();
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.save_onboarding(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_onboarding(JSONB) TO authenticated;

-- ─── entitlement ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id                UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'none'
                           CHECK (status IN ('none', 'trial', 'active', 'billing_issue', 'expired')),
  product_id             TEXT,
  trial_started_at       TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  first_paid_at          TIMESTAMPTZ,
  will_renew             BOOLEAN,
  -- Current TestFlight testers were promised v1 free (X9). Grandfathering is
  -- a flag, not a fake subscription, so it can be ended cleanly.
  grandfathered_until    TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY user_entitlements_read_own ON public.user_entitlements
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- No insert/update/delete policies: only the service role (webhook) writes.

-- ─── streak ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.streak_days (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  source     TEXT NOT NULL CHECK (source IN ('snap', 'checkin', 'health', 'receipt', 'repair')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.streak_days ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY streak_days_read_own ON public.streak_days
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Writes go through keep_day / use_streak_repair, which work out the user's
-- local date from profiles.timezone. A client can't backdate a day.

CREATE OR REPLACE FUNCTION public._local_today(p_uid UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE COALESCE(
            (SELECT NULLIF(timezone, '') FROM public.profiles WHERE id = p_uid),
            'America/Chicago'))::DATE;
$$;
REVOKE ALL ON FUNCTION public._local_today(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.keep_day(p_source TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'keep_day requires an authenticated session'; END IF;
  IF p_source NOT IN ('snap', 'checkin', 'health', 'receipt') THEN
    RAISE EXCEPTION 'keep_day: unknown source %', p_source;
  END IF;
  INSERT INTO public.streak_days (user_id, day, source)
  VALUES (v_uid, public._local_today(v_uid), p_source)
  ON CONFLICT (user_id, day) DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_day(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keep_day(TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.check_ins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  question_id TEXT NOT NULL,
  answer      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, day, question_id)
);
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY check_ins_read_own ON public.check_ins
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One tap: records the answer and keeps the day, in one round trip.
CREATE OR REPLACE FUNCTION public.answer_check_in(p_question TEXT, p_answer TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_day DATE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'answer_check_in requires an authenticated session'; END IF;
  v_day := public._local_today(v_uid);
  INSERT INTO public.check_ins (user_id, day, question_id, answer)
  VALUES (v_uid, v_day, left(p_question, 40), left(p_answer, 40))
  ON CONFLICT (user_id, day, question_id) DO UPDATE SET answer = EXCLUDED.answer;
  INSERT INTO public.streak_days (user_id, day, source)
  VALUES (v_uid, v_day, 'checkin')
  ON CONFLICT (user_id, day) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.answer_check_in(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.answer_check_in(TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.repair_credits (
  user_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  free_credits      INTEGER NOT NULL DEFAULT 0 CHECK (free_credits >= 0),
  purchased_credits INTEGER NOT NULL DEFAULT 0 CHECK (purchased_credits >= 0),
  purchased_total   INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.repair_credits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY repair_credits_read_own ON public.repair_credits
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fixes yesterday, if it was missed and the day before was kept. Uses a free
-- credit from the chain first, then a purchased one (credited by the
-- RevenueCat webhook after a $0.99 purchase).
CREATE OR REPLACE FUNCTION public.use_streak_repair()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_today DATE;
  v_cred  public.repair_credits%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'use_streak_repair requires an authenticated session'; END IF;
  v_today := public._local_today(v_uid);

  IF EXISTS (SELECT 1 FROM public.streak_days WHERE user_id = v_uid AND day = v_today - 1) THEN
    RETURN 'nothing_to_repair';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.streak_days WHERE user_id = v_uid AND day = v_today - 2) THEN
    RETURN 'no_streak';
  END IF;

  SELECT * INTO v_cred FROM public.repair_credits WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND OR (v_cred.free_credits = 0 AND v_cred.purchased_credits = 0) THEN
    RETURN 'no_credit';
  END IF;

  IF v_cred.free_credits > 0 THEN
    UPDATE public.repair_credits SET free_credits = free_credits - 1, updated_at = NOW() WHERE user_id = v_uid;
  ELSE
    UPDATE public.repair_credits SET purchased_credits = purchased_credits - 1, updated_at = NOW() WHERE user_id = v_uid;
  END IF;

  INSERT INTO public.streak_days (user_id, day, source) VALUES (v_uid, v_today - 1, 'repair');
  RETURN 'repaired';
END;
$$;
REVOKE ALL ON FUNCTION public.use_streak_repair() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_streak_repair() TO authenticated;

-- ─── the chain ──────────────────────────────────────────────────────────────
-- A chain link already exists: invite_codes.owner_id passed the key,
-- invite_codes.used_by redeemed it. v5 adds what the key was earned by.
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS earned_from TEXT;   -- the kept pact, in words

CREATE INDEX IF NOT EXISTS invite_codes_used_by_idx ON public.invite_codes (used_by);
CREATE INDEX IF NOT EXISTS invite_codes_owner_idx   ON public.invite_codes (owner_id);

CREATE TABLE IF NOT EXISTS public.chain_rewards (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiary_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- the person who paid
  kind           TEXT NOT NULL CHECK (kind IN ('half_month', 'free_repair')),
  status         TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'claimed', 'expired')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at     TIMESTAMPTZ,
  UNIQUE (beneficiary_id, source_user_id, kind)
);
ALTER TABLE public.chain_rewards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY chain_rewards_read_own ON public.chain_rewards
    FOR SELECT TO authenticated USING (beneficiary_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Everyone in the chain that p_user belongs to: walk up to the root through
-- the keys used, then take every descendant of the root. Depth-capped.
CREATE OR REPLACE FUNCTION public._chain_members(p_user UUID)
RETURNS TABLE (member_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE up AS (
    SELECT p_user AS id, 0 AS depth
    UNION ALL
    SELECT ic.owner_id, up.depth + 1
      FROM up
      JOIN public.invite_codes ic ON ic.used_by = up.id
     WHERE ic.owner_id IS NOT NULL AND up.depth < 50
  ),
  root AS (
    SELECT id FROM up ORDER BY depth DESC LIMIT 1
  ),
  down AS (
    SELECT id, 0 AS depth FROM root
    UNION ALL
    SELECT ic.used_by, down.depth + 1
      FROM down
      JOIN public.invite_codes ic ON ic.owner_id = down.id
     WHERE ic.used_by IS NOT NULL AND down.depth < 50
  )
  SELECT DISTINCT id FROM down;
$$;
REVOKE ALL ON FUNCTION public._chain_members(UUID) FROM PUBLIC;

-- Fires once, when a user's first paid month lands (the webhook sets
-- first_paid_at). If they joined with a key: half a month for them and for
-- the person who passed the key, and a free repair for everyone in the chain.
CREATE OR REPLACE FUNCTION public._grant_chain_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter UUID;
BEGIN
  IF NEW.first_paid_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.first_paid_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_inviter
    FROM public.invite_codes
   WHERE used_by = NEW.user_id AND owner_id IS NOT NULL
   ORDER BY used_at NULLS LAST
   LIMIT 1;

  IF v_inviter IS NULL THEN
    RETURN NEW; -- joined with a beta code, or no key: no chain rewards
  END IF;

  INSERT INTO public.chain_rewards (beneficiary_id, source_user_id, kind)
  VALUES (v_inviter, NEW.user_id, 'half_month'),
         (NEW.user_id, NEW.user_id, 'half_month')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.chain_rewards (beneficiary_id, source_user_id, kind)
  SELECT member_id, NEW.user_id, 'free_repair' FROM public._chain_members(NEW.user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.repair_credits (user_id, free_credits)
  SELECT member_id, 1 FROM public._chain_members(NEW.user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET free_credits = public.repair_credits.free_credits + 1,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_entitlements_chain_rewards ON public.user_entitlements;
CREATE TRIGGER user_entitlements_chain_rewards
  AFTER INSERT OR UPDATE OF first_paid_at ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public._grant_chain_rewards();

-- The chain as the caller sees it: who they joined through, and everyone
-- below them. Names and given-back totals only; no other profile data.
CREATE OR REPLACE FUNCTION public.get_chain()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_up  JSONB;
  v_tree JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'get_chain requires an authenticated session'; END IF;

  SELECT jsonb_build_object(
           'name', split_part(COALESCE(p.full_name, p.username, 'Someone'), ' ', 1),
           'pact', COALESCE(ic.earned_from, 'a pact'))
    INTO v_up
    FROM public.invite_codes ic
    JOIN public.profiles p ON p.id = ic.owner_id
   WHERE ic.used_by = v_uid
   LIMIT 1;

  WITH RECURSIVE down AS (
    SELECT v_uid AS id, NULL::UUID AS parent, 0 AS depth, NULL::TIMESTAMPTZ AS joined_at
    UNION ALL
    SELECT ic.used_by, down.id, down.depth + 1, ic.used_at
      FROM down
      JOIN public.invite_codes ic ON ic.owner_id = down.id
     WHERE ic.used_by IS NOT NULL AND down.depth < 8
  )
  SELECT jsonb_agg(jsonb_build_object(
           'id', d.id,
           'parent', d.parent,
           'depth', d.depth,
           'name', CASE WHEN d.id = v_uid THEN 'You'
                        ELSE split_part(COALESCE(p.full_name, p.username, 'Someone'), ' ', 1) END,
           'givenBackLb', ROUND(COALESCE(p.total_co2_saved, 0) * 2.20462),
           'joinedDaysAgo', COALESCE(EXTRACT(DAY FROM NOW() - d.joined_at)::INT, 0),
           'firstMonthPaid', (e.first_paid_at IS NOT NULL)
         ) ORDER BY d.depth)
    INTO v_tree
    FROM down d
    JOIN public.profiles p ON p.id = d.id
    LEFT JOIN public.user_entitlements e ON e.user_id = d.id;

  RETURN jsonb_build_object('upstream', v_up, 'members', COALESCE(v_tree, '[]'::JSONB));
END;
$$;
REVOKE ALL ON FUNCTION public.get_chain() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chain() TO authenticated;

-- ─── sourced fact library ───────────────────────────────────────────────────
-- The camera reads and the Table Card only ever show facts from here. The
-- model picks subject keys; it never writes the fact.
CREATE TABLE IF NOT EXISTS public.fact_library (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_key TEXT NOT NULL,              -- e.g. 'beer_draft', 'oat_milk'
  slot        TEXT NOT NULL CHECK (slot IN ('good', 'few_know', 'catch', 'tip')),
  text        TEXT NOT NULL,
  lb_delta    NUMERIC,                    -- for tips: lb saved per unit
  usd_delta   NUMERIC,                    -- for tips: $ saved per unit, when provable
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ,                -- NULL = not yet reviewed; not served
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fact_library_subject_idx ON public.fact_library (subject_key, slot);
ALTER TABLE public.fact_library ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY fact_library_read_reviewed ON public.fact_library
    FOR SELECT TO authenticated USING (reviewed_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.fact_library (subject_key, slot, text, lb_delta, source_name, source_url, reviewed_at)
SELECT * FROM (VALUES
  ('beer_draft', 'good', 'Beer from a keg comes in around 40% lower than the same beer bottled, mostly because of the glass.', NULL::NUMERIC,
   'Science of the Total Environment, 2024, beer packaging life-cycle assessment', 'https://www.sciencedirect.com/science/article/pii/S0048969724050915', NOW()),
  ('beer_bottle', 'tip', 'Choose draft when the bar has it', 0.5,
   'Science of the Total Environment, 2024, beer packaging life-cycle assessment', 'https://www.sciencedirect.com/science/article/pii/S0048969724050915', NOW()),
  ('beer_can', 'tip', 'Choose draft when the bar has it', 0.5,
   'Science of the Total Environment, 2024, beer packaging life-cycle assessment', 'https://www.sciencedirect.com/science/article/pii/S0048969724050915', NOW())
) AS v(subject_key, slot, text, lb_delta, source_name, source_url, reviewed_at)
WHERE NOT EXISTS (SELECT 1 FROM public.fact_library f WHERE f.subject_key = v.subject_key AND f.slot = v.slot);

-- ─── Heads up ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.heads_up_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id   TEXT UNIQUE,                  -- e.g. 'fda:F-1234-2026', 'fsis:045-2026'
  kind          TEXT NOT NULL CHECK (kind IN ('recall', 'regulation', 'testing')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  action        TEXT NOT NULL,
  evidence      TEXT CHECK (evidence IN ('official recall', 'binding rule', 'voluntary', 'one study', 'several studies', 'settled finding')),
  source_name   TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  firm          TEXT,
  product_text  TEXT,                          -- what the matcher compares against
  lot_codes     TEXT[],
  region        TEXT,                          -- 'nationwide' or states
  published_at  DATE,
  reviewed_at   TIMESTAMPTZ,                   -- digest items need a human pass
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.heads_up_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY heads_up_items_read ON public.heads_up_items
    FOR SELECT TO authenticated USING (kind = 'recall' OR reviewed_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.watch_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  brand      TEXT,
  upc        TEXT,
  added_from TEXT NOT NULL DEFAULT 'label scan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
ALTER TABLE public.watch_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY watch_items_own ON public.watch_items
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.heads_up_matches (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.heads_up_items(id) ON DELETE CASCADE,
  watch_item_id UUID REFERENCES public.watch_items(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at       TIMESTAMPTZ,
  notified_at   TIMESTAMPTZ,
  PRIMARY KEY (user_id, item_id)
);
ALTER TABLE public.heads_up_matches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY heads_up_matches_read_own ON public.heads_up_matches
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.mark_heads_up_seen(p_item UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.heads_up_matches SET seen_at = COALESCE(seen_at, NOW())
   WHERE user_id = auth.uid() AND item_id = p_item;
$$;
REVOKE ALL ON FUNCTION public.mark_heads_up_seen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_heads_up_seen(UUID) TO authenticated;

-- ─── camera ─────────────────────────────────────────────────────────────────
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS snap_kind TEXT;

-- ─── service-only helpers (webhook and recall-sync) ─────────────────────────

-- A $0.99 repair bought through the App Store. Called by revenuecat-webhook.
CREATE OR REPLACE FUNCTION public.credit_repair_purchase(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.repair_credits (user_id, purchased_credits, purchased_total)
  VALUES (p_user, 1, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET purchased_credits = public.repair_credits.purchased_credits + 1,
        purchased_total   = public.repair_credits.purchased_total + 1,
        updated_at        = NOW();
$$;
REVOKE ALL ON FUNCTION public.credit_repair_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_repair_purchase(UUID) TO service_role;

-- Matches one Heads up item against every watch list. Deliberately strict:
-- the brand must appear in the recall text AND at least one meaningful word
-- of the product name must too. A missed match is better than a false alarm
-- about someone's groceries. Returns the number of new matches.
CREATE OR REPLACE FUNCTION public.match_heads_up_item(p_item UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text TEXT;
  v_n    INTEGER;
BEGIN
  SELECT lower(COALESCE(firm, '') || ' ' || COALESCE(product_text, '') || ' ' || COALESCE(title, ''))
    INTO v_text
    FROM public.heads_up_items WHERE id = p_item;
  IF v_text IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.heads_up_matches (user_id, item_id, watch_item_id)
  SELECT w.user_id, p_item, w.id
    FROM public.watch_items w
   WHERE COALESCE(w.brand, '') <> ''
     AND length(w.brand) >= 3
     AND position(lower(w.brand) IN v_text) > 0
     AND EXISTS (
       SELECT 1
         FROM regexp_split_to_table(lower(w.name), '[^a-z0-9]+') AS word
        WHERE length(word) >= 4
          AND word NOT IN ('with', 'from', 'free', 'pack', 'size', 'large', 'small', 'original')
          AND position(word IN v_text) > 0
     )
  ON CONFLICT (user_id, item_id) DO NOTHING;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.match_heads_up_item(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_heads_up_item(UUID) TO service_role;
