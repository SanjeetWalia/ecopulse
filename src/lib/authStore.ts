// src/lib/authStore.ts
import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  location: string;
  streak_count: number;
  total_co2_saved: number;
  timezone?: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });

      // Sync device timezone to profile if different from stored value.
      // This keeps daily_summaries bucketed per the user's actual local day.
      try {
        const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (deviceTz && data.timezone !== deviceTz) {
          await supabase
            .from('profiles')
            .update({ timezone: deviceTz })
            .eq('id', userId);
        }
      } catch {
        // Intl not supported or timezone detection failed — ignore silently
      }
    }
  },

  initialize: async () => {
    set({ loading: true });
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    set({ session, user: session?.user ?? null });

    if (session?.user) {
      await get().fetchProfile(session.user.id);
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().fetchProfile(session.user.id);
      } else {
        set({ profile: null });
      }
    });

    set({ loading: false, initialized: true });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
