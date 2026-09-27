// src/lib/growthStore.ts
//
// Client state for the v5 growth loop: onboarding answers, the starting plan,
// entitlement (trial / paid), streak days, check-ins, streak repairs and the
// Heads up watch list.
//
// UI phase: persisted on the device only, so every screen works end to end
// with sample data. Backend phase: each action also writes to Supabase
// (migration 0007), and the store hydrates from the server on sign-in.
// The shapes here match those tables one to one.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingAnswers, buildPlan } from './plan';
import { TRIAL_DAYS } from './pricing';
import { SAMPLE_MODE, SAMPLE_WATCH_LIST } from './sample';
import { push, pull } from './sync';

export type DaySource = 'snap' | 'checkin' | 'health' | 'receipt' | 'repair';
export type EntitlementStatus = 'none' | 'trial' | 'active' | 'expired';

export interface WatchItem {
  id: string;
  name: string;
  brand: string;
  addedFrom: string;
}

export function isoDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

interface GrowthState {
  userId: string | null;
  hydratedFromServer: boolean;

  // onboarding
  answers: OnboardingAnswers;
  onboardedAt: string | null;
  planMoves: Record<string, boolean>;

  // entitlement
  entitlement: EntitlementStatus;
  trialStartedAt: string | null;
  joinedWithKeyFrom: string | null; // name of the person whose key was used

  // streak
  days: Record<string, DaySource>;
  checkIns: Record<string, Record<string, string>>; // day -> question -> answer
  freeRepairs: number;
  purchasedRepairs: number;

  // Heads up
  watchList: WatchItem[];
  seenHeadsUp: string[];

  setAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void;
  finishOnboarding: () => void;
  setPlanMove: (id: string, on: boolean) => void;
  startTrial: () => void;
  markDay: (source: DaySource, day?: string) => void;
  answerCheckIn: (questionId: string, answer: string) => void;
  repairYesterday: (paid: boolean) => boolean;
  addWatch: (item: Omit<WatchItem, 'id'>) => void;
  removeWatch: (id: string) => void;
  markHeadsUpSeen: (id: string) => void;
  resetGrowth: () => void; // for testing the flow again
  hydrate: (userId: string) => Promise<void>;
  setEntitlement: (status: EntitlementStatus, trialStartedAt?: string | null) => void;
}

function seedDays(): Record<string, DaySource> {
  if (!SAMPLE_MODE) return {};
  // Twelve kept days before yesterday, and yesterday slipped: enough to show
  // a streak worth keeping and the repair offer on Today.
  const out: Record<string, DaySource> = {};
  const sources: DaySource[] = ['snap', 'checkin', 'health', 'checkin', 'receipt'];
  for (let i = 2; i <= 13; i++) out[daysAgo(i)] = sources[i % sources.length];
  return out;
}

const initial = () => ({
  userId: null as string | null,
  hydratedFromServer: false,
  answers: {} as OnboardingAnswers,
  onboardedAt: null as string | null,
  planMoves: {} as Record<string, boolean>,
  entitlement: 'none' as EntitlementStatus,
  trialStartedAt: null as string | null,
  joinedWithKeyFrom: SAMPLE_MODE ? 'Maya' : null,
  days: seedDays(),
  checkIns: {} as Record<string, Record<string, string>>,
  freeRepairs: SAMPLE_MODE ? 1 : 0,
  purchasedRepairs: 0,
  watchList: SAMPLE_MODE ? SAMPLE_WATCH_LIST.map((w) => ({ ...w })) : [],
  seenHeadsUp: [] as string[],
});

export const useGrowthStore = create<GrowthState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),

      finishOnboarding: () => {
        const plan = buildPlan(get().answers);
        const moves: Record<string, boolean> = {};
        plan.moves.forEach((m) => (moves[m.id] = m.defaultOn));
        set({ onboardedAt: new Date().toISOString(), planMoves: moves });
        if (!SAMPLE_MODE) push.onboarding(get().answers);
      },

      setPlanMove: (id, on) => set((s) => ({ planMoves: { ...s.planMoves, [id]: on } })),

      startTrial: () => set({ entitlement: 'trial', trialStartedAt: new Date().toISOString() }),

      markDay: (source, day = isoDay()) => {
        set((s) => (s.days[day] ? s : { days: { ...s.days, [day]: source } }));
        if (!SAMPLE_MODE && source !== 'repair' && day === isoDay()) push.keepDay(source);
      },

      answerCheckIn: (questionId, answer) => {
        const day = isoDay();
        set((s) => ({
          checkIns: { ...s.checkIns, [day]: { ...(s.checkIns[day] ?? {}), [questionId]: answer } },
          days: s.days[day] ? s.days : { ...s.days, [day]: 'checkin' },
        }));
        // One RPC records the answer and keeps the day.
        if (!SAMPLE_MODE) push.checkIn(questionId, answer);
      },

      repairYesterday: (paid) => {
        const s = get();
        const y = daysAgo(1);
        if (s.days[y]) return false;
        if (!paid && s.freeRepairs <= 0) return false;
        set({
          days: { ...s.days, [y]: 'repair' },
          freeRepairs: paid ? s.freeRepairs : s.freeRepairs - 1,
          purchasedRepairs: paid ? s.purchasedRepairs + 1 : s.purchasedRepairs,
        });
        return true;
      },

      addWatch: (item) => {
        set((s) =>
          s.watchList.some((w) => w.name === item.name)
            ? s
            : { watchList: [{ ...item, id: `w${Date.now()}` }, ...s.watchList] }
        );
        const uid = get().userId;
        if (!SAMPLE_MODE && uid) push.addWatch(uid, item);
      },

      removeWatch: (id) => {
        const item = get().watchList.find((w) => w.id === id);
        set((s) => ({ watchList: s.watchList.filter((w) => w.id !== id) }));
        const uid = get().userId;
        if (!SAMPLE_MODE && uid && item) push.removeWatch(uid, item.name);
      },

      markHeadsUpSeen: (id) => {
        set((s) => (s.seenHeadsUp.includes(id) ? s : { seenHeadsUp: [...s.seenHeadsUp, id] }));
        if (!SAMPLE_MODE) push.headsUpSeen(id);
      },

      resetGrowth: () => set(initial()),

      setEntitlement: (status, trialStartedAt) =>
        set((s) => ({ entitlement: status, trialStartedAt: trialStartedAt === undefined ? s.trialStartedAt : trialStartedAt })),

      // Server wins for everything it knows. A different user signing in on
      // the same phone starts from a clean slate.
      hydrate: async (userId) => {
        if (SAMPLE_MODE) {
          set({ userId });
          return;
        }
        if (get().userId && get().userId !== userId) set({ ...initial() });
        set({ userId });
        const srv = await pull(userId);
        if (!srv) return;
        set((s) => ({
          hydratedFromServer: true,
          onboardedAt: srv.onboardedAt ?? s.onboardedAt,
          answers: srv.answers ?? s.answers,
          entitlement: srv.entitlement,
          trialStartedAt: srv.trialStartedAt,
          days: { ...s.days, ...srv.days },
          checkIns: { ...s.checkIns, ...srv.checkIns },
          freeRepairs: srv.freeRepairs,
          purchasedRepairs: srv.purchasedRepairs,
          watchList: srv.watchList,
          joinedWithKeyFrom: srv.joinedWithKeyFrom,
        }));
      },
    }),
    {
      name: 'ecopulse.growth.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { setAnswer, finishOnboarding, setPlanMove, startTrial, markDay, answerCheckIn, repairYesterday, addWatch, removeWatch, markHeadsUpSeen, resetGrowth, hydrate, setEntitlement, ...data } = s;
        return data;
      },
    }
  )
);

// ---- derived --------------------------------------------------------------

export interface StreakInfo {
  count: number; // consecutive kept days ending today (or yesterday if today isn't kept yet)
  keptToday: boolean;
  yesterdayMissed: boolean; // and repairable: the day before it was kept
  atRisk: boolean; // today not kept yet
}

export function streakInfo(days: Record<string, DaySource>, now: Date = new Date()): StreakInfo {
  const today = isoDay(now);
  const keptToday = !!days[today];
  const yesterday = daysAgo(1, now);
  const yesterdayMissed = !days[yesterday] && !!days[daysAgo(2, now)];

  let count = 0;
  let i = keptToday ? 0 : 1;
  while (days[daysAgo(i, now)]) {
    count++;
    i++;
  }
  // If yesterday slipped, the streak that is at stake is the one before it.
  if (!keptToday && yesterdayMissed) {
    let j = 2;
    count = 0;
    while (days[daysAgo(j, now)]) {
      count++;
      j++;
    }
  }
  return { count, keptToday, yesterdayMissed, atRisk: !keptToday };
}

export function trialDaysLeft(trialStartedAt: string | null, now: Date = new Date()): number {
  if (!trialStartedAt) return TRIAL_DAYS;
  const used = Math.floor((now.getTime() - new Date(trialStartedAt).getTime()) / 86_400_000);
  return Math.max(0, TRIAL_DAYS - used);
}
