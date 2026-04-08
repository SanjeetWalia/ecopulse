-- ═══════════════════════════════════════════════════════════
-- ECO PULSE — Supabase Database Schema
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- Extended user profile (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT DEFAULT 'Frisco, TX',
  streak_count INTEGER DEFAULT 0,
  streak_last_date DATE,
  total_co2_saved NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── ACTIVITIES ──────────────────────────────────────────────────────────────
CREATE TABLE public.activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('transport', 'food', 'energy', 'digital', 'other')),
  activity_type TEXT NOT NULL,     -- 'car', 'bus', 'cycling', 'meat_meal', etc.
  label TEXT NOT NULL,             -- human-readable: "DART Red Line · 14 mi"
  amount NUMERIC(10,2),            -- raw input (miles, hours, servings)
  unit TEXT,                       -- 'miles', 'hours', 'servings', 'kg'
  co2_kg NUMERIC(8,4) NOT NULL,    -- calculated CO₂ in kg
  source TEXT DEFAULT 'manual',    -- 'manual', 'maps', 'snap', 'nest', 'spotify'
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast daily lookups
CREATE INDEX idx_activities_user_date ON public.activities(user_id, logged_at);

-- ─── DAILY SUMMARIES ─────────────────────────────────────────────────────────
-- Precomputed daily CO₂ totals per user (updated by trigger)
CREATE TABLE public.daily_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_co2_kg NUMERIC(8,3) DEFAULT 0,
  transport_co2 NUMERIC(8,3) DEFAULT 0,
  food_co2 NUMERIC(8,3) DEFAULT 0,
  energy_co2 NUMERIC(8,3) DEFAULT 0,
  digital_co2 NUMERIC(8,3) DEFAULT 0,
  activity_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Function to upsert daily summary when activity is logged
CREATE OR REPLACE FUNCTION public.update_daily_summary()
RETURNS TRIGGER AS $$
DECLARE
  activity_date DATE;
BEGIN
  activity_date := DATE(NEW.logged_at);

  INSERT INTO public.daily_summaries (user_id, date, total_co2_kg, transport_co2, food_co2, energy_co2, digital_co2, activity_count)
  VALUES (
    NEW.user_id,
    activity_date,
    NEW.co2_kg,
    CASE WHEN NEW.category = 'transport' THEN NEW.co2_kg ELSE 0 END,
    CASE WHEN NEW.category = 'food' THEN NEW.co2_kg ELSE 0 END,
    CASE WHEN NEW.category = 'energy' THEN NEW.co2_kg ELSE 0 END,
    CASE WHEN NEW.category = 'digital' THEN NEW.co2_kg ELSE 0 END,
    1
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_co2_kg = daily_summaries.total_co2_kg + NEW.co2_kg,
    transport_co2 = daily_summaries.transport_co2 + CASE WHEN NEW.category = 'transport' THEN NEW.co2_kg ELSE 0 END,
    food_co2 = daily_summaries.food_co2 + CASE WHEN NEW.category = 'food' THEN NEW.co2_kg ELSE 0 END,
    energy_co2 = daily_summaries.energy_co2 + CASE WHEN NEW.category = 'energy' THEN NEW.co2_kg ELSE 0 END,
    digital_co2 = daily_summaries.digital_co2 + CASE WHEN NEW.category = 'digital' THEN NEW.co2_kg ELSE 0 END,
    activity_count = daily_summaries.activity_count + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_activity_created
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_daily_summary();

-- ─── FRIENDS ─────────────────────────────────────────────────────────────────
CREATE TABLE public.friendships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id, status);

-- ─── STORIES ─────────────────────────────────────────────────────────────────
CREATE TABLE public.stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT,                  -- Supabase Storage URL
  media_type TEXT DEFAULT 'eco_update' CHECK (media_type IN ('image', 'eco_update')),
  activity_id UUID REFERENCES public.activities(id),
  title TEXT,
  stat_text TEXT,
  badge_text TEXT,
  emoji TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stories_user_active ON public.stories(user_id, expires_at);

-- Story views tracking
CREATE TABLE public.story_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

-- ─── MESSAGES ────────────────────────────────────────────────────────────────
CREATE TABLE public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'eco_card', 'story_share', 'reel_share')),
  metadata JSONB,                  -- for eco cards, reel shares etc.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

-- ─── GIFT A PLANT ─────────────────────────────────────────────────────────────
CREATE TABLE public.plant_gifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plant_type TEXT NOT NULL,        -- 'golden_pothos', 'cactus', etc.
  unlock_path TEXT NOT NULL CHECK (unlock_path IN ('co2_saver', 'top_3_rank')),
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered')),
  shipping_address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVITE CODES ─────────────────────────────────────────────────────────────
CREATE TABLE public.invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate invite code on profile creation
CREATE OR REPLACE FUNCTION public.create_invite_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
BEGIN
  new_code := 'ECO·' || UPPER(SUBSTRING(NEW.username, 1, 2)) || '·' || TO_CHAR(EXTRACT(YEAR FROM NOW()), 'YYYY');
  INSERT INTO public.invite_codes (code, owner_id) VALUES (new_code, NEW.id)
  ON CONFLICT (code) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_invite_code();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Activities: own read/write, friends can read
CREATE POLICY "activities_own_all" ON public.activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "activities_friends_read" ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND addressee_id = user_id)
        OR (addressee_id = auth.uid() AND requester_id = user_id))
    )
  );

-- Daily summaries: own + friends read
CREATE POLICY "summaries_own" ON public.daily_summaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "summaries_friends_read" ON public.daily_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND addressee_id = user_id)
        OR (addressee_id = auth.uid() AND requester_id = user_id))
    )
  );

-- Friendships
CREATE POLICY "friendships_own" ON public.friendships FOR ALL USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);

-- Stories: own write, friends read active stories
CREATE POLICY "stories_own" ON public.stories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "stories_friends_read" ON public.stories FOR SELECT
  USING (
    expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND addressee_id = user_id)
        OR (addressee_id = auth.uid() AND requester_id = user_id))
    )
  );

-- Messages
CREATE POLICY "messages_participants" ON public.messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "conversations_participants" ON public.conversations FOR ALL
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- Plant gifts
CREATE POLICY "gifts_own" ON public.plant_gifts FOR ALL
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Invite codes
CREATE POLICY "invite_codes_own" ON public.invite_codes FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "invite_codes_public_read" ON public.invite_codes FOR SELECT USING (true);

-- ─── STORAGE BUCKETS ──────────────────────────────────────────────────────────
-- Run these in Supabase Storage dashboard or via API:
-- 1. Create bucket "avatars" (public)
-- 2. Create bucket "stories" (public, 24h expiry policy)
-- 3. Create bucket "food-snaps" (private)
