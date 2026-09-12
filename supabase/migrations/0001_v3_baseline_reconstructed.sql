-- 0001_v3_baseline_reconstructed.sql
--
-- Reconstructed from application code, September 2026. Idempotent and safe to
-- run against the live project. See README.md in this directory before trusting
-- it as a source of truth.
--
-- Covers everything the v3 redesign (July 2026) added outside version control.

-- ─── invite_codes: columns added after the April baseline ──────────────────
-- The April schema has only (id, code, owner_id, uses, created_at). The app
-- reads status and writes used_by, so both must already exist in production.
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS status  TEXT DEFAULT 'unused',
  ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- ─── shared_snaps: the Circle feed ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_snaps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  label       TEXT NOT NULL,
  co2_kg      NUMERIC NOT NULL DEFAULT 0,
  photo_path  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shared_snaps_user_created_idx
  ON public.shared_snaps (user_id, created_at DESC);

-- ─── leaves: one per person per shared snap ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leaves (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snap_id    UUID NOT NULL REFERENCES public.shared_snaps(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snap_id, user_id)
);

-- ─── eco_chat_messages: conversation history for the eco-chat function ─────
CREATE TABLE IF NOT EXISTS public.eco_chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS eco_chat_messages_user_created_idx
  ON public.eco_chat_messages (user_id, created_at DESC);

-- ─── user_facts: the memory layer ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_facts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  fact_type  TEXT NOT NULL DEFAULT 'other'
             CHECK (fact_type IN ('vehicle','diet','home_energy','household','habit','other')),
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, key)
);
CREATE INDEX IF NOT EXISTS user_facts_user_updated_idx
  ON public.user_facts (user_id, updated_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.shared_snaps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facts        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Own rows, always.
  CREATE POLICY "shared_snaps_own" ON public.shared_snaps
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Accepted friends may read. PulseScreen relies on this — it filters nothing
  -- client-side. D1 in ROADMAP.md is an explicit task to TEST this claim.
  CREATE POLICY "shared_snaps_friends_read" ON public.shared_snaps
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.user_id = auth.uid() AND f.friend_id = shared_snaps.user_id)
            OR (f.friend_id = auth.uid() AND f.user_id = shared_snaps.user_id))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "leaves_own_write" ON public.leaves
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "leaves_read_visible_snaps" ON public.leaves
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.shared_snaps s WHERE s.id = leaves.snap_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "eco_chat_own" ON public.eco_chat_messages
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Users can read and delete their own memory. Writes come from edge
  -- functions using the service role, which bypasses RLS.
  CREATE POLICY "user_facts_own" ON public.user_facts
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
