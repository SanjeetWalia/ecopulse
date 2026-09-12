// supabase/functions/observe-facts/index.ts — Section N3
//
// Nightly: write back what the app has SEEN, as facts with origin 'observed'.
//
// Why this exists. The optimizer on Today is rule-based — it takes the biggest
// category and suggests trimming it by 10%. That is the same advice for every
// user with the same top category, which is not coaching. Real personalisation
// needs a baseline to compare against, and the app was never writing one down
// (OBS-015). These observed facts are also the foundation Sections O and P sit
// on: a target has to be proposed off a baseline, and "best week ever" cannot
// be detected without one.
//
// Observed facts are never presented as something the user said. The origin
// column is what keeps that honest.
//
// Deploy: supabase functions deploy observe-facts
// Schedule: see supabase/migrations/0005_observe_facts_schedule.sql

import { writeObservedFacts } from "../_shared/facts.ts";

const WINDOW_DAYS = 14;
const BASELINE_DAYS = 10;

interface Summary {
  user_id: string;
  date: string;
  total_co2_kg: number | null;
  transport_co2: number | null;
  food_co2: number | null;
  energy_co2: number | null;
  digital_co2: number | null;
  activity_count: number | null;
}

// @ts-ignore Deno runtime
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  // @ts-ignore
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // @ts-ignore
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing env" }, 500);
  }

  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceDate = since.toISOString().slice(0, 10);

  const res = await fetch(
    `${supabaseUrl}/rest/v1/daily_summaries?date=gte.${sinceDate}` +
      `&select=user_id,date,total_co2_kg,transport_co2,food_co2,energy_co2,digital_co2,activity_count` +
      `&order=date.desc`,
    { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return json({ error: `summaries fetch failed: ${res.status}` }, 502);

  const rows: Summary[] = await res.json();

  const byUser = new Map<string, Summary[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  let usersWritten = 0;

  for (const [userId, days] of byUser) {
    // A baseline off two days of data is noise dressed as insight. The same
    // 10-day gate Moko-Avi already uses applies here.
    if (days.length < BASELINE_DAYS) continue;

    const recent = days.slice(0, BASELINE_DAYS);
    const kg = (r: Summary) => Number(r.total_co2_kg || 0);

    const avg = recent.reduce((a, r) => a + kg(r), 0) / recent.length;

    const weekday = recent.filter((r) => {
      const d = new Date(`${r.date}T12:00:00`).getDay();
      return d >= 1 && d <= 5;
    });
    const weekend = recent.filter((r) => {
      const d = new Date(`${r.date}T12:00:00`).getDay();
      return d === 0 || d === 6;
    });

    const cat = {
      transport: recent.reduce((a, r) => a + Number(r.transport_co2 || 0), 0),
      food: recent.reduce((a, r) => a + Number(r.food_co2 || 0), 0),
      energy: recent.reduce((a, r) => a + Number(r.energy_co2 || 0), 0),
      digital: recent.reduce((a, r) => a + Number(r.digital_co2 || 0), 0),
    };
    const catTotal = Object.values(cat).reduce((a, b) => a + b, 0) || 1;
    const dominant = Object.entries(cat).sort((a, b) => b[1] - a[1])[0][0];

    const loggedDays = days.filter((r) => Number(r.activity_count || 0) > 0).length;

    const facts = [
      {
        key: "personal_baseline",
        fact_type: "habit",
        value: {
          kg_per_day: round(avg),
          days_used: recent.length,
          computed_at: new Date().toISOString(),
        },
        confidence: 0.8,
      },
      {
        key: "category_mix",
        fact_type: "habit",
        value: {
          transport_pct: round((cat.transport / catTotal) * 100, 0),
          food_pct: round((cat.food / catTotal) * 100, 0),
          energy_pct: round((cat.energy / catTotal) * 100, 0),
          digital_pct: round((cat.digital / catTotal) * 100, 0),
          dominant,
        },
        confidence: 0.7,
      },
      {
        key: "logging_cadence",
        fact_type: "habit",
        value: {
          days_logged: loggedDays,
          of_last: days.length,
          window_days: WINDOW_DAYS,
        },
        confidence: 0.9,
      },
    ];

    if (weekday.length >= 3 && weekend.length >= 2) {
      const wdAvg = weekday.reduce((a, r) => a + kg(r), 0) / weekday.length;
      const weAvg = weekend.reduce((a, r) => a + kg(r), 0) / weekend.length;
      facts.push({
        key: "weekday_vs_weekend",
        fact_type: "habit",
        value: {
          weekday_kg: round(wdAvg),
          weekend_kg: round(weAvg),
          heavier: wdAvg >= weAvg ? "weekday" : "weekend",
        },
        confidence: 0.65,
      });
    }

    try {
      await writeObservedFacts(supabaseUrl, serviceKey, userId, facts);
      usersWritten++;
    } catch {
      // One user's failure must not stop the pass.
    }
  }

  return json({ users_seen: byUser.size, users_written: usersWritten });
});

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
