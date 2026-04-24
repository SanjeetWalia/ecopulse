// supabase/functions/moko-avi-summary/index.ts
//
// Moko-Avi: the personal summary agent for Eco Pulse.
// Named for Sanjeet's nephew Avir. "Moko" after the free New Zealand
// bottlenose dolphin who helped stranded whales navigate back to open sea —
// the metaphor: Moko-Avi helps one user at a time make sense of their day.
//
// ENDPOINT
// --------
// POST /moko-avi-summary
// Body: { userId: string, date?: string (YYYY-MM-DD local), timezone?: string }
//   date defaults to "today in user's timezone"
//   timezone defaults to profile.timezone or America/Chicago
//
// Response:
//   { summary: string | null, status: "ready" | "warmup" | "empty" | "error" }
//
// STATUSES
//   ready   -> summary is populated; display it
//   warmup  -> fewer than 10 consecutive days of activity; client shows
//              "Moko-Avi is still learning about you."
//   empty   -> no activities on this date; client shows nothing or placeholder
//   error   -> something failed upstream; client shows nothing, no crash
//
// BEHAVIOR
// --------
// 1. Reads profile (name, timezone)
// 2. Checks 10-consecutive-days warmup:
//    counts the user's current streak of consecutive calendar days with
//    at least one activity (in their local timezone). If < 10 -> warmup.
// 3. Fetches today's activities + past 14 days of daily_summaries
// 4. Sends compact context to Claude Haiku with the Moko-Avi voice prompt
// 5. Returns a 10-30 word warm, comparative, non-prescriptive sentence

// @ts-ignore Deno runtime
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { userId, date, timezone } = await req.json();
    if (!userId) return json({ status: "error", summary: null, error: "userId required" }, 400);

    const anthropicKey = (Deno as any).env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = (Deno as any).env.get("SUPABASE_URL");
    const supabaseServiceKey = (Deno as any).env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!anthropicKey || !supabaseUrl || !supabaseServiceKey) {
      return json({ status: "error", summary: null, error: "Missing env" }, 500);
    }

    // --- 1. Fetch profile for timezone + name --------------------------------
    const profile = await sb(supabaseUrl, supabaseServiceKey,
      `profiles?id=eq.${userId}&select=full_name,timezone`);
    if (!profile || profile.length === 0) {
      return json({ status: "error", summary: null, error: "Profile not found" }, 404);
    }
    const userTz = timezone || profile[0].timezone || "America/Chicago";
    const firstName = (profile[0].full_name || "").split(" ")[0] || "";

    // Target local date
    const targetDate = date || localDateString(new Date(), userTz);

    // --- 2. Check 10-consecutive-days warmup --------------------------------
    // Fetch last 30 days of daily_summaries (more than enough for a 10-day check).
    const summariesResp = await sb(supabaseUrl, supabaseServiceKey,
      `daily_summaries?user_id=eq.${userId}&select=date,total_co2_kg,activity_count&order=date.desc&limit=30`);

    const consecutiveDays = countConsecutiveDaysEndingAt(summariesResp || [], targetDate);
    if (consecutiveDays < 10) {
      return json({
        status: "warmup",
        summary: null,
        consecutive_days: consecutiveDays,
      });
    }

    // --- 3. Fetch today's activities for context ----------------------------
    // We need activities whose logged_at date (in the user's TZ) equals targetDate.
    // Easiest: fetch last 48h worth by UTC, then filter in memory.
    const since = new Date();
    since.setHours(since.getHours() - 48);
    const activitiesResp = await sb(supabaseUrl, supabaseServiceKey,
      `activities?user_id=eq.${userId}&logged_at=gte.${since.toISOString()}&select=label,category,activity_type,co2_kg,logged_at`);

    const todayActivities = (activitiesResp || []).filter((a: any) =>
      localDateString(new Date(a.logged_at), userTz) === targetDate
    );

    if (todayActivities.length === 0) {
      return json({ status: "empty", summary: null });
    }

    // --- 4. Build context for Claude ---------------------------------------
    // Past 14 days (exclude today). Used for baseline comparisons.
    const recent14 = (summariesResp || [])
      .filter((s: any) => s.date !== targetDate)
      .slice(0, 14)
      .map((s: any) => ({
        date: s.date,
        total_co2_kg: Number(s.total_co2_kg),
        activity_count: s.activity_count,
      }));

    const todayTotal = todayActivities.reduce((sum: number, a: any) => sum + Number(a.co2_kg || 0), 0);

    const context = {
      first_name: firstName,
      target_date: targetDate,
      today: {
        total_co2_kg: round2(todayTotal),
        activity_count: todayActivities.length,
        activities: todayActivities.map((a: any) => ({
          label: a.label,
          category: a.category,
          co2_kg: round2(Number(a.co2_kg)),
          hour: new Date(a.logged_at).toLocaleString("en-US", {
            hour: "numeric",
            hour12: true,
            timeZone: userTz,
          }),
        })),
      },
      recent_14_days: recent14,
    };

    // --- 5. Call Claude Haiku -----------------------------------------------
    const systemPrompt = `You are Moko-Avi, a small, warm guide inside Eco Pulse — a carbon tracking app. You help one user understand their own day in context.

RULES:
- Write 1-2 short sentences, 10-30 words total. Shorter on quieter days.
- Warm and friendly, not preachy. Narrate what the data shows.
- NEVER prescribe, recommend, or suggest actions. No "you should," "try," "consider."
- NEVER give external climate facts, only talk about the user's own data.
- NEVER reference other users.
- Compare today to the user's own recent baseline when useful. Use natural language ("lighter than your week," "about your typical Wednesday"), not specific percentages unless ≥50% different.
- If today has ONE activity, name it. Don't invent trends from one data point.
- Use first name occasionally (roughly 1 in 3 summaries), not every time.
- No emojis unless the data contains them.
- Do NOT repeat the CO2e number — the user sees it right above your sentence.
- If the day is "so far" (not complete yet — assume true until end of day in user's timezone), say "so far" once in a while.

Respond with ONLY the sentence(s). No preamble, no sign-off, no quotes.`;

    const userPrompt = `Write Moko-Avi's summary for ${firstName || "the user"}'s day.

Data:
${JSON.stringify(context, null, 2)}`;

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      return json({
        status: "error",
        summary: null,
        error: `Claude ${claudeResp.status}: ${errText.slice(0, 200)}`,
      }, 500);
    }

    const claudeData = await claudeResp.json();
    const textBlock = (claudeData.content || []).find((c: any) => c.type === "text");
    const summary = (textBlock?.text || "").trim();

    if (!summary) {
      return json({ status: "error", summary: null, error: "Empty Claude response" }, 500);
    }

    return json({ status: "ready", summary });
  } catch (err) {
    return json({
      status: "error",
      summary: null,
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

// ---------- helpers ----------

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  });
}

// Fetch from Supabase via PostgREST
async function sb(baseUrl: string, serviceKey: string, path: string) {
  const resp = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Supabase fetch failed: ${resp.status} ${txt}`);
  }
  return resp.json();
}

// Convert a Date to a YYYY-MM-DD string in the given IANA timezone
function localDateString(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

// Count consecutive calendar days ending at (and including) targetDate that
// have >= 1 activity (i.e., appear as rows in daily_summaries).
function countConsecutiveDaysEndingAt(summaries: any[], targetDate: string): number {
  const dates = new Set(summaries.map((s) => s.date));
  let count = 0;
  let cursor = new Date(targetDate + "T12:00:00Z"); // noon-UTC anchor to avoid DST edge
  // If target date itself is missing, streak is 0
  while (dates.has(isoDateOnly(cursor))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
