// src/lib/growth.ts
//
// Data layer for the v5 screens. Every read goes through here so the switch
// from sample data to Supabase happens in one file.
//
// UI phase (now): SAMPLE_MODE returns the samples in src/lib/sample.ts.
// Backend phase: each function queries the tables and RPCs from migration
// 0007 and returns the same shapes.

import {
  SAMPLE_MODE,
  SAMPLE_CHAIN,
  SAMPLE_KEYS,
  SAMPLE_REWARDS,
  SAMPLE_HEADS_UP,
  SAMPLE_TIMELINE,
  ChainPerson,
  KeyInfo,
  HeadsUpItem,
} from './sample';
import { supabase } from './supabase';
import { BASELINE_KG_PER_DAY, KG_TO_LB } from './scope';

export type { ChainPerson, KeyInfo, HeadsUpItem };

export interface ChainView {
  upstream: { name: string; pact: string } | null;
  you: ChainPerson;
}

export async function getChain(): Promise<ChainView> {
  if (SAMPLE_MODE) return SAMPLE_CHAIN;
  const { data, error } = await supabase.rpc('get_chain');
  if (error || !data) throw error ?? new Error('get_chain failed');
  const members: any[] = data.members ?? [];
  const byId = new Map<string, ChainPerson>();
  members.forEach((m) =>
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      givenBackLb: Number(m.givenBackLb) || 0,
      joinedDaysAgo: Number(m.joinedDaysAgo) || 0,
      firstMonthPaid: !!m.firstMonthPaid,
      children: [],
    })
  );
  let root: ChainPerson | undefined;
  members.forEach((m) => {
    const node = byId.get(m.id)!;
    if (m.parent && byId.has(m.parent)) byId.get(m.parent)!.children.push(node);
    else if (m.depth === 0) root = node;
  });
  return {
    upstream: data.upstream ?? null,
    you: root ?? { id: 'me', name: 'You', givenBackLb: 0, joinedDaysAgo: 0, firstMonthPaid: false, children: [] },
  };
}

export async function getKeys(): Promise<KeyInfo[]> {
  if (SAMPLE_MODE) return SAMPLE_KEYS;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from('invite_codes')
    .select('id, code, status, earned_from')
    .eq('owner_id', u.user.id)
    .order('created_at', { ascending: false });
  return (data ?? []).map((k: any) => ({
    id: k.id,
    code: k.code,
    earnedFrom: k.earned_from ?? 'Your founding keys',
    used: (k.status ?? 'unused') !== 'unused',
  }));
}

function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
}

export async function getRewards(): Promise<{ id: string; when: string; text: string }[]> {
  if (SAMPLE_MODE) return SAMPLE_REWARDS;
  const { data } = await supabase
    .from('chain_rewards')
    .select('id, kind, created_at, source_user_id, beneficiary_id, source:profiles!chain_rewards_source_user_id_fkey(full_name, username)')
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []).map((r: any) => {
    const who = (r.source?.full_name || r.source?.username || 'Someone').split(' ')[0];
    const self = r.source_user_id === r.beneficiary_id;
    const text =
      r.kind === 'free_repair'
        ? `${self ? 'You' : who} paid a first month. Everyone in your chain got a free streak repair.`
        : self
          ? 'Your key earned you a half-price month.'
          : `${who} paid their first month with your key. Your next month is half price.`;
    return { id: r.id, when: ago(r.created_at), text };
  });
}

function toItem(i: any, matched: boolean, watch?: any): HeadsUpItem {
  return {
    id: i.id,
    kind: i.kind,
    matched,
    title: i.title,
    body: i.body,
    action: i.action,
    sourceName: i.source_name,
    sourceUrl: i.source_url,
    published: i.published_at ? new Date(i.published_at + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '',
    evidence: i.evidence ?? undefined,
    lotCodes: i.lot_codes ?? undefined,
    matchedItem: watch
      ? {
          name: watch.name,
          when: new Date(watch.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          how: String(watch.added_from).startsWith('receipt') ? 'receipt' : String(watch.added_from).startsWith('snap') ? 'snap' : 'label scan',
        }
      : undefined,
  };
}

export async function getHeadsUp(): Promise<HeadsUpItem[]> {
  if (SAMPLE_MODE) return SAMPLE_HEADS_UP;
  const [mine, digest] = await Promise.all([
    supabase
      .from('heads_up_matches')
      .select('item:heads_up_items(*), watch:watch_items(name, added_from, created_at)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('heads_up_items')
      .select('*')
      .in('kind', ['regulation', 'testing'])
      .not('reviewed_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(10),
  ]);
  const matched = (mine.data ?? []).filter((m: any) => m.item).map((m: any) => toItem(m.item, true, m.watch));
  const ids = new Set(matched.map((m) => m.id));
  const week = (digest.data ?? []).filter((i: any) => !ids.has(i.id)).map((i: any) => toItem(i, false));
  return [...matched, ...week];
}

export type Timeline = typeof SAMPLE_TIMELINE;

/**
 * Weekly air given back for the last 12 weeks, from daily_summaries, with
 * two projections: as you are (your last four weeks) and with your plan
 * (plus the lb/week of the moves switched on). Money has no ledger yet, so
 * it is left out until kept pacts record what they saved.
 */
export async function getTimeline(planLbPerWeek = 0): Promise<Timeline> {
  if (SAMPLE_MODE) return SAMPLE_TIMELINE;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not signed in');
  const weeks = 12;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - weeks * 7 + 1);
  const { data } = await supabase
    .from('daily_summaries')
    .select('date, total_co2_kg')
    .eq('user_id', u.user.id)
    .gte('date', start.toISOString().slice(0, 10));
  const past = Array.from({ length: weeks }, () => ({ kg: 0, days: 0 }));
  (data ?? []).forEach((r: any) => {
    const i = Math.floor((new Date(r.date + 'T12:00:00').getTime() - start.getTime()) / (7 * 86_400_000));
    if (i >= 0 && i < weeks) {
      past[i].kg += Number(r.total_co2_kg) || 0;
      past[i].days += 1;
    }
  });
  const lb = past.map((w) => (w.days ? Math.max(0, (BASELINE_KG_PER_DAY * w.days - w.kg) * KG_TO_LB) : 0));
  const recent = lb.slice(-4).filter((v) => v > 0);
  const asYouAre = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  return {
    weeksPast: weeks,
    weeksFuture: 12,
    air: { past: lb.map((v) => Math.round(v)), asYouAre: Math.round(asYouAre), withPlan: Math.round(asYouAre + planLbPerWeek), unit: 'lb', totalPast: Math.round(lb.reduce((a, b) => a + b, 0)) },
    money: { past: [], asYouAre: 0, withPlan: 0, unit: '$', totalPast: 0 },
  };
}

// ---- chain maths ------------------------------------------------------------

export function chainTotals(p: ChainPerson): { people: number; lb: number } {
  let people = 0;
  let lb = 0;
  const walk = (n: ChainPerson) => {
    people += 1;
    lb += n.givenBackLb;
    n.children.forEach(walk);
  };
  walk(p);
  return { people, lb };
}

export function flattenChain(p: ChainPerson, depth = 0, out: { person: ChainPerson; depth: number }[] = []) {
  out.push({ person: p, depth });
  p.children.forEach((c) => flattenChain(c, depth + 1, out));
  return out;
}
