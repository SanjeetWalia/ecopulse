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

export type { ChainPerson, KeyInfo, HeadsUpItem };

export interface ChainView {
  upstream: { name: string; pact: string } | null;
  you: ChainPerson;
}

export async function getChain(): Promise<ChainView> {
  if (SAMPLE_MODE) return SAMPLE_CHAIN;
  throw new Error('getChain: backend not wired yet');
}

export async function getKeys(): Promise<KeyInfo[]> {
  if (SAMPLE_MODE) return SAMPLE_KEYS;
  throw new Error('getKeys: backend not wired yet');
}

export async function getRewards(): Promise<{ id: string; when: string; text: string }[]> {
  if (SAMPLE_MODE) return SAMPLE_REWARDS;
  throw new Error('getRewards: backend not wired yet');
}

export async function getHeadsUp(): Promise<HeadsUpItem[]> {
  if (SAMPLE_MODE) return SAMPLE_HEADS_UP;
  throw new Error('getHeadsUp: backend not wired yet');
}

export type Timeline = typeof SAMPLE_TIMELINE;

export async function getTimeline(): Promise<Timeline> {
  if (SAMPLE_MODE) return SAMPLE_TIMELINE;
  throw new Error('getTimeline: backend not wired yet');
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
