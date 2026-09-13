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
-- Enabling RLS is idempotent and always safe.
ALTER TABLE public.shared_snaps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facts        ENABLE ROW LEVEL SECURITY;

-- Policies are a different matter. These four tables already exist in
-- production with policies that were created in the dashboard and never
-- committed, and their names are unknown to this file. Postgres OR-s
-- permissive policies together, so blindly adding one to a table that is
-- already protected can WIDEN access rather than restore it.
--
-- So: only define policies on a table that has none. A fresh rebuild from
-- this migration gets the intended rules; the live project is left exactly
-- as it is. Compare the two by hand with the query in
-- supabase/run-once/2026-09-13-editor.sql before trusting either.
--
-- NOTE ON friendships: this originally guessed user_id / friend_id. The real
-- columns are requester_id / addressee_id (supabase_schema.sql line 114).
-- The push failed loudly on that, which is the argument for committing schema
-- rather than reconstructing it (OBS-018).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_snaps'
  ) THEN
    CREATE POLICY "shared_snaps_own" ON public.shared_snaps
      FOR ALL USING (auth.uid() = user_id);

    -- Accepted friends may read. PulseScreen relies on this — it filters
    -- nothing client-side. D1 in ROADMAP.md is an explicit task to TEST that
    -- claim rather than assume it.
    CREATE POLICY "shared_snaps_friends_read" ON public.shared_snaps
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.addressee_id = shared_snaps.user_id)
              OR (f.addressee_id = auth.uid() AND f.requester_id = shared_snaps.user_id))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaves'
  ) THEN
    CREATE POLICY "leaves_own_write" ON public.leaves
      FOR ALL USING (auth.uid() = user_id);

    CREATE POLICY "leaves_read_visible_snaps" ON public.leaves
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.shared_snaps s WHERE s.id = leaves.snap_id)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'eco_chat_messages'
  ) THEN
    CREATE POLICY "eco_chat_own" ON public.eco_chat_messages
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_facts'
  ) THEN
    -- Users can read and delete their own memory, which is what the Memory
    -- screen needs. Writes come from edge functions using the service role,
    -- which bypasses RLS.
    CREATE POLICY "user_facts_own" ON public.user_facts
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
