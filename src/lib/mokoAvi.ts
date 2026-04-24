// src/lib/mokoAvi.ts
//
// Client module for the Moko-Avi summary agent.
// - Calls the `moko-avi-summary` Supabase edge function
// - Caches results in-memory per (userId, date) for 10 minutes
// - Exposes `invalidateMokoAviCache` so activity write paths can
//   clear the cache after logs/edits/deletes.

import { supabase } from "./supabase";

export type MokoAviStatus = "ready" | "warmup" | "empty" | "error" | "loading";

export interface MokoAviResult {
  status: MokoAviStatus;
  summary: string | null;
  consecutive_days?: number;
}

interface CacheEntry {
  fetchedAt: number;
  result: MokoAviResult;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache: Map<string, CacheEntry> = new Map();

function cacheKey(userId: string, date: string): string {
  return `${userId}:${date}`;
}

/**
 * Get today's local YYYY-MM-DD in the user's device timezone.
 * Matches what the edge function uses internally when no `date` is passed.
 */
export function todayLocalDate(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

/**
 * Fetch a Moko-Avi summary. Returns cached result if fresh.
 * On error, returns { status: "error", summary: null } so callers can
 * render gracefully without crashing.
 */
export async function fetchMokoAviSummary(
  userId: string,
  date?: string
): Promise<MokoAviResult> {
  const resolvedDate = date || todayLocalDate();
  const key = cacheKey(userId, resolvedDate);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.result;
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "moko-avi-summary",
      {
        body: {
          userId,
          date: resolvedDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }
    );

    if (error) {
      const result: MokoAviResult = { status: "error", summary: null };
      // Don't cache errors — let the next call retry
      return result;
    }

    const result: MokoAviResult = {
      status: (data?.status as MokoAviStatus) ?? "error",
      summary: data?.summary ?? null,
      consecutive_days: data?.consecutive_days,
    };

    // Only cache successful outcomes (including warmup and empty — those are valid states)
    if (result.status !== "error") {
      cache.set(key, { fetchedAt: Date.now(), result });
    }
    return result;
  } catch {
    return { status: "error", summary: null };
  }
}

/**
 * Clear cache entries so next fetch regenerates.
 * Call after any activity write (log/edit/delete) for the affected user+date.
 *
 * @param userId  The user whose cache to clear
 * @param date    If provided, clear just that date. If omitted, clear all
 *                cached dates for this user.
 */
export function invalidateMokoAviCache(userId: string, date?: string): void {
  if (date) {
    cache.delete(cacheKey(userId, date));
    return;
  }
  // Clear all entries for this user across any date
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * Used by tests or manual refresh flows to wipe everything.
 */
export function clearAllMokoAviCache(): void {
  cache.clear();
}
