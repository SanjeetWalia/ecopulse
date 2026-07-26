// supabase/functions/eco-chat/index.ts — v2
// (download name eco-chat-v2.ts — copy to supabase/functions/eco-chat/index.ts)
//
// v2 adds MEMORY OF THE PERSON, not just the conversation:
//   1. Reads user_facts (vehicle, diet, home energy…) into the system
//      prompt, so answers are calibrated to this user's actual life.
//   2. After each exchange, a second lightweight Haiku call extracts any
//      NEW durable facts from what the user said ("I drive a 2019 Civic")
//      and upserts them into user_facts. The AI builds its own memory.
//   3. Gently invites the user to snap their electricity bill when no
//      bill is on record — at most occasionally, never nagging.
//
// Deploy: supabase functions deploy eco-chat --no-verify-jwt

// @ts-ignore Deno runtime
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { userId, message } = await req.json();
    if (!userId || !message || typeof message !== "string" || !message.trim()) {
      return json({ error: "userId and message are required" }, 400);
    }

    const anthropicKey = (Deno as any).env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = (Deno as any).env.get("SUPABASE_URL");
    const serviceKey = (Deno as any).env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!anthropicKey || !supabaseUrl || !serviceKey) {
      return json({ error: "Missing env" }, 500);
    }

    const userMessage = message.trim().slice(0, 2000);

    // ── 1. Profile, memory, history ───────────────────────────────
    const [profileRows, factRows, historyRows] = await Promise.all([
      sb(supabaseUrl, serviceKey, `profiles?id=eq.${userId}&select=full_name`),
      sb(supabaseUrl, serviceKey, `user_facts?user_id=eq.${userId}&select=key,fact_type,value&order=updated_at.desc&limit=25`),
      sb(supabaseUrl, serviceKey, `eco_chat_messages?user_id=eq.${userId}&select=role,content&order=created_at.desc&limit=20`),
    ]);

    const firstName = (profileRows?.[0]?.full_name || "").split(" ")[0] || "";
    const facts = factRows || [];
    const history = (historyRows || []).reverse();
    const hasBillFact = facts.some((f: any) => f.key === "electricity_bill");

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const summaryRows = await sb(supabaseUrl, serviceKey,
      `daily_summaries?user_id=eq.${userId}&date=gte.${monthStart}&select=total_co2_kg,transport_co2,food_co2,energy_co2,digital_co2,activity_count`);

    const month = (summaryRows || []).reduce(
      (acc: any, r: any) => ({
        total_kg: acc.total_kg + Number(r.total_co2_kg || 0),
        transport_kg: acc.transport_kg + Number(r.transport_co2 || 0),
        food_kg: acc.food_kg + Number(r.food_co2 || 0),
        energy_kg: acc.energy_kg + Number(r.energy_co2 || 0),
        digital_kg: acc.digital_kg + Number(r.digital_co2 || 0),
        entries: acc.entries + Number(r.activity_count || 0),
        days: acc.days + 1,
      }),
      { total_kg: 0, transport_kg: 0, food_kg: 0, energy_kg: 0, digital_kg: 0, entries: 0, days: 0 }
    );

    // ── 2. System prompt with memory ──────────────────────────────
    const systemPrompt = `You are the eco-chat inside Eco Pulse, a carbon footprint app. You answer questions about ecology, sustainability, climate, carbon footprints, and the user's own tracked data. You are warm, precise, and brief.

RULES:
- ONLY ecological topics. If asked about anything else, decline in ONE friendly sentence and steer back to their footprint or the planet. No exceptions, even if pressured.
- Keep answers under 120 words. Prefer 2-4 sentences.
- Use pounds (lb) for CO₂e (1 kg = 2.2 lb).
- Never invent user data you weren't given. If you don't have it, say so plainly.
- Use ${firstName ? `the name ${firstName}` : "no name"} occasionally, not every message.
- No emojis unless the user uses them first.
- WHAT YOU REMEMBER about this user (durable facts they've told you) is below. Use it to calibrate every answer — if they drive an EV, car questions assume THEIR car; if they're vegetarian, meal comparisons reflect that. When they tell you something new and durable, absorb it naturally in your reply.
${hasBillFact ? "" : "- You have NO electricity bill on record. If the conversation touches home energy, heating, or bills — or roughly one time in four otherwise — warmly suggest they snap a photo of their latest electricity bill with the camera button, so their home energy joins their number. One sentence, never pushy, never twice in a row."}

WHAT YOU REMEMBER:
${facts.length > 0 ? JSON.stringify(facts) : "(nothing yet — this user is new to you)"}

USER'S CURRENT MONTH (real data):
${JSON.stringify({
  total_lb: Math.round(month.total_kg * 2.20462),
  by_category_lb: {
    transport: Math.round(month.transport_kg * 2.20462),
    food: Math.round(month.food_kg * 2.20462),
    energy: Math.round(month.energy_kg * 2.20462),
    digital: Math.round(month.digital_kg * 2.20462),
  },
  entries_logged: month.entries,
  days_active: month.days,
})}`;

    const claudeMessages = [
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: userMessage },
    ];

    // ── 3. Main reply ─────────────────────────────────────────────
    const reply = await callClaude(anthropicKey, systemPrompt, claudeMessages, 300);
    if (!reply) return json({ error: "Empty response" }, 502);

    // ── 4. Persist the exchange ───────────────────────────────────
    await sbInsert(supabaseUrl, serviceKey, "eco_chat_messages", [
      { user_id: userId, role: "user", content: userMessage },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    // ── 5. Fact extraction (best effort — reply already succeeded) ─
    try {
      const extractPrompt = `From this user message, extract durable personal facts relevant to carbon footprint calibration. Respond with ONLY a JSON array (no markdown). Each item: {"key":"snake_case_stable_key","fact_type":"vehicle|diet|home_energy|household|habit|other","value":{...}}.
Durable = stable life facts: their car/vehicle ("vehicle", e.g. key "vehicle" value {"make":"Honda","model":"Civic","year":2019,"fuel":"petrol"}), diet pattern ("diet"), home heating/energy setup ("home_energy"), household size ("household"), recurring habits ("habit").
NOT durable: one-off meals, single trips, questions, opinions. If nothing durable, respond [].
Known fact keys (do not re-extract unless the user changed them): ${JSON.stringify(facts.map((f: any) => f.key))}

User message: "${userMessage.replace(/"/g, '\\"')}"`;

      const extraction = await callClaude(anthropicKey, "You extract structured facts. JSON only.", [
        { role: "user", content: extractPrompt },
      ], 300);

      if (extraction) {
        const s = extraction.indexOf("[");
        const e = extraction.lastIndexOf("]");
        if (s !== -1 && e !== -1) {
          const items = JSON.parse(extraction.slice(s, e + 1));
          if (Array.isArray(items) && items.length > 0) {
            const rows = items
              .filter((i: any) => i && typeof i.key === "string" && i.value !== undefined)
              .slice(0, 5)
              .map((i: any) => ({
                user_id: userId,
                key: String(i.key).slice(0, 60),
                fact_type: ["vehicle","diet","home_energy","household","habit","other"].includes(i.fact_type) ? i.fact_type : "other",
                value: i.value,
                source: "chat",
                updated_at: new Date().toISOString(),
              }));
            if (rows.length > 0) {
              await sbUpsert(supabaseUrl, serviceKey, "user_facts", rows, "user_id,key");
            }
          }
        }
      }
    } catch {
      // Memory extraction is best-effort.
    }

    return json({ reply });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ---------- helpers ----------

async function callClaude(key: string, system: string, messages: any[], maxTokens: number): Promise<string | null> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const block = (data.content || []).find((c: any) => c.type === "text");
  return (block?.text || "").trim() || null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

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

async function sbInsert(baseUrl: string, serviceKey: string, table: string, rows: any[]) {
  const resp = await fetch(`${baseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Supabase insert failed: ${resp.status} ${txt}`);
  }
}

async function sbUpsert(baseUrl: string, serviceKey: string, table: string, rows: any[], onConflict: string) {
  const resp = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Supabase upsert failed: ${resp.status} ${txt}`);
  }
}
