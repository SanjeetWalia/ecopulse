// src/lib/sync.ts
//
// Server side of the growth store (migration 0007). Every write is
// best-effort and never blocks the tap that caused it: the local store has
// already updated, and the next hydrate reconciles with the server.
//
// Only used when SAMPLE_MODE is off.

import { supabase } from './supabase';
import type { OnboardingAnswers } from './plan';
import type { DaySource, EntitlementStatus, WatchItem } from './growthStore';

function quiet<T>(p: PromiseLike<T>): void {
  Promise.resolve(p).catch(() => {});
}

export const push = {
  onboarding: (answers: OnboardingAnswers) => quiet(supabase.rpc('save_onboarding', { p_answers: answers })),
  keepDay: (source: Exclude<DaySource, 'repair'>) => quiet(supabase.rpc('keep_day', { p_source: source })),
  checkIn: (question: string, answer: string) => quiet(supabase.rpc('answer_check_in', { p_question: question, p_answer: answer })),
  addWatch: (userId: string, item: Omit<WatchItem, 'id'>) =>
    quiet(supabase.from('watch_items').upsert({ user_id: userId, name: item.name, brand: item.brand, added_from: item.addedFrom }, { onConflict: 'user_id,name' })),
  removeWatch: (userId: string, name: string) => quiet(supabase.from('watch_items').delete().eq('user_id', userId).eq('name', name)),
  headsUpSeen: (itemId: string) => quiet(supabase.rpc('mark_heads_up_seen', { p_item: itemId })),
};

export async function spendRepair(): Promise<'repaired' | 'nothing_to_repair' | 'no_streak' | 'no_credit' | 'error'> {
  const { data, error } = await supabase.rpc('use_streak_repair');
  if (error) return 'error';
  return data as any;
}

export interface ServerGrowth {
  onboardedAt: string | null;
  answers: OnboardingAnswers | null;
  entitlement: EntitlementStatus;
  trialStartedAt: string | null;
  grandfathered: boolean;
  days: Record<string, DaySource>;
  checkIns: Record<string, Record<string, string>>;
  freeRepairs: number;
  purchasedRepairs: number;
  watchList: WatchItem[];
  joinedWithKeyFrom: string | null;
}

export async function pull(userId: string): Promise<ServerGrowth | null> {
  try {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const [prof, ent, days, cis, cred, watch, chain] = await Promise.all([
      supabase.from('profiles').select('onboarded_at, onboarding').eq('id', userId).single(),
      supabase.from('user_entitlements').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('streak_days').select('day, source').eq('user_id', userId).gte('day', since),
      supabase.from('check_ins').select('day, question_id, answer').eq('user_id', userId).gte('day', since),
      supabase.from('repair_credits').select('free_credits, purchased_credits, purchased_total').eq('user_id', userId).maybeSingle(),
      supabase.from('watch_items').select('id, name, brand, added_from, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.rpc('get_chain'),
    ]);

    const e = ent.data as any;
    const grandfathered = !!(e?.grandfathered_until && new Date(e.grandfathered_until) > new Date());
    const status: EntitlementStatus = grandfathered
      ? 'active'
      : e?.status === 'trial' || e?.status === 'active' || e?.status === 'expired'
        ? e.status
        : e?.status === 'billing_issue'
          ? 'active' // Apple's grace period: keep access while billing retries
          : 'none';

    const dayMap: Record<string, DaySource> = {};
    (days.data ?? []).forEach((d: any) => (dayMap[d.day] = d.source));
    const ciMap: Record<string, Record<string, string>> = {};
    (cis.data ?? []).forEach((c: any) => {
      ciMap[c.day] = { ...(ciMap[c.day] ?? {}), [c.question_id]: c.answer };
    });

    return {
      onboardedAt: (prof.data as any)?.onboarded_at ?? null,
      answers: (prof.data as any)?.onboarding ?? null,
      entitlement: status,
      trialStartedAt: e?.trial_started_at ?? null,
      grandfathered,
      days: dayMap,
      checkIns: ciMap,
      freeRepairs: (cred.data as any)?.free_credits ?? 0,
      purchasedRepairs: (cred.data as any)?.purchased_total ?? 0,
      watchList: (watch.data ?? []).map((w: any) => ({
        id: w.id,
        name: w.name,
        brand: w.brand ?? '',
        addedFrom: `${w.added_from} · ${new Date(w.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
      })),
      joinedWithKeyFrom: (chain.data as any)?.upstream?.name ?? null,
    };
  } catch {
    return null;
  }
}
