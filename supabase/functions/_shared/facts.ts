// supabase/functions/_shared/facts.ts — the memory layer (Section N)
//
// Until September 2026 fact extraction lived only inside eco-chat, so a user
// who only snapped meals and logged trips built no memory at all and their
// numbers were never calibrated (OBS-014). This module is shared by every AI
// path, and every path that hears the user in their own words now feeds it.
//
// Two kinds of fact, never mixed (OBS-015):
//   origin 'stated'   — the user said it. Extracted from their own words.
//   origin 'observed' — the app computed it from their behaviour.
// An inference must never masquerade as something the user said, which is why
// the discriminator is a column rather than a convention.
//
// Extraction is always best-effort. A failure here must never fail the reply
// the user is actually waiting for.

export const FACT_TYPES = ["vehicle", "diet", "home_energy", "household", "habit", "other"] as const;

export interface FactRow {
  user_id: string;
  key: string;
  fact_type: string;
  value: unknown;
  source: string;
  origin: "stated" | "observed";
  confidence: number;
  updated_at: string;
  last_confirmed_at?: string | null;
}

/**
 * Run work after the response has been sent when the runtime allows it.
 * Fact extraction costs a second model call, and the user should never wait
 * for it on the logging path.
 */
export function runInBackground(work: Promise<unknown>): void {
  const safe = work.catch(() => {});
  try {
    // @ts-ignore Deno edge runtime
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(safe);
      return;
    }
  } catch {
    // fall through
  }
  // No waitUntil available — let it run unawaited. Worst case it is cut off,
  // which is acceptable for best-effort memory.
  void safe;
}

export async function readFacts(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  limit = 25,
): Promise<any[]> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/user_facts?user_id=eq.${userId}&select=key,fact_type,value,origin,confidence&order=updated_at.desc&limit=${limit}`,
      { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function upsertFacts(
  supabaseUrl: string,
  serviceKey: string,
  rows: FactRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await fetch(`${supabaseUrl}/rest/v1/user_facts?on_conflict=user_id,key`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
}

async function callHaiku(
  anthropicKey: string,
  system: string,
  userContent: string,
  maxTokens = 300,
): Promise<string | null> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.content?.[0]?.text ?? null;
}

/**
 * Extract durable STATED facts from something the user actually wrote, and
 * store them. `source` records which path heard it: chat | activity | photo.
 *
 * Only ever call this with the user's own words. A model's description of a
 * photograph is not the user telling you anything.
 */
export async function extractStatedFacts(opts: {
  anthropicKey: string;
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  userText: string;
  source: "chat" | "activity" | "photo";
  knownKeys?: string[];
}): Promise<number> {
  const { anthropicKey, supabaseUrl, serviceKey, userId, source } = opts;
  const userText = (opts.userText || "").trim();
  if (!userId || userText.length < 8) return 0;

  const known = opts.knownKeys ?? [];

  const prompt = `From this user message, extract durable personal facts relevant to carbon footprint calibration. Respond with ONLY a JSON array (no markdown). Each item: {"key":"snake_case_stable_key","fact_type":"vehicle|diet|home_energy|household|habit|other","value":{...},"confidence":0.0-1.0}.

Durable = stable life facts: their car or vehicle (key "vehicle", e.g. {"make":"Honda","model":"Civic","year":2019,"fuel":"petrol"}), diet pattern ("diet"), home heating and energy setup ("home_energy"), household size ("household"), recurring habits such as a regular commute ("habit").

NOT durable, never extract: one-off meals, single trips, questions, opinions, anything hypothetical, anything about another person.
Confidence: 1.0 when stated plainly ("I drive a Civic"), lower when implied ("took the Civic in again").
If nothing durable, respond [].

Known fact keys (do not re-extract unless the user has changed them): ${JSON.stringify(known)}

User message: ${JSON.stringify(userText.slice(0, 2000))}`;

  try {
    const raw = await callHaiku(anthropicKey, "You extract structured facts. JSON only.", prompt);
    if (!raw) return 0;

    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return 0;

    const items = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(items) || items.length === 0) return 0;

    const now = new Date().toISOString();
    const rows: FactRow[] = items
      .filter((i: any) => i && typeof i.key === "string" && i.value !== undefined)
      .slice(0, 5)
      .map((i: any) => ({
        user_id: userId,
        key: String(i.key).slice(0, 60),
        fact_type: (FACT_TYPES as readonly string[]).includes(i.fact_type) ? i.fact_type : "other",
        value: i.value,
        source,
        origin: "stated" as const,
        confidence: typeof i.confidence === "number" ? Math.min(1, Math.max(0, i.confidence)) : 0.8,
        updated_at: now,
        last_confirmed_at: now,
      }));

    await upsertFacts(supabaseUrl, serviceKey, rows);
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Store OBSERVED facts — what the app worked out for itself. Never presented
 * to the user as something they said.
 */
export async function writeObservedFacts(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  facts: { key: string; fact_type?: string; value: unknown; confidence?: number }[],
): Promise<void> {
  const now = new Date().toISOString();
  const rows: FactRow[] = facts.map((f) => ({
    user_id: userId,
    key: f.key.slice(0, 60),
    fact_type: f.fact_type && (FACT_TYPES as readonly string[]).includes(f.fact_type) ? f.fact_type : "other",
    value: f.value,
    source: "observer",
    origin: "observed" as const,
    confidence: f.confidence ?? 0.6,
    updated_at: now,
  }));
  await upsertFacts(supabaseUrl, serviceKey, rows);
}
