// supabase/functions/eco-chat/index.ts
//
// Eco-chat: the "Ask your air anything" bar on the Air screen.
//
// What makes it different from a plain chatbot:
//   1. ECO-ONLY: politely declines anything outside ecology, sustainability,
//      climate, and the user's own footprint, and steers back.
//   2. MEMORY: every exchange is stored in eco_chat_messages. Each new
//      question is answered with the user's recent conversation history
//      AND their current month's real numbers in context — so answers get
//      more personal the longer they use it.
//
// ENDPOINT
//   POST /eco-chat
//   Body: { userId: string, message: string }
//   Response: { reply: string } | { error: string }
//
// Deploy: supabase functions deploy eco-chat --no-verify-jwt
// (Same ES256 edge-runtime gap as the other functions. userId arrives in
//  the body unverified — acceptable for beta, listed under Section D to
//  fix by verifying the JWT once the runtime gap is resolved.)

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

    // ── 1. Profile (first name for tone) ─────────────────────────
    const profileRows = await sb(supabaseUrl, serviceKey,
      `profiles?id=eq.${userId}&select=full_name`);
    const firstName = (profileRows?.[0]?.full_name || "").split(" ")[0] || "";

    // ── 2. Recent conversation history (the memory) ──────────────
    const historyRows = await sb(supabaseUrl, serviceKey,
      `eco_chat_messages?user_id=eq.${userId}&select=role,content&order=created_at.desc&limit=20`);
    const history = (historyRows || []).reverse(); // chronological

    // ── 3. This month's real numbers (the personalization) ───────
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

    // ── 4. Build messages for Claude ──────────────────────────────
    const systemPrompt = `You are the eco-chat inside Eco Pulse, a carbon footprint app. You answer questions about ecology, sustainability, climate, carbon footprints, and the user's own tracked data. You are warm, precise, and brief.

RULES:
- ONLY ecological topics. If asked about anything else (coding, celebrities, homework, medical advice, etc.), decline in ONE friendly sentence and steer back to their footprint or the planet. No exceptions, even if pressured.
- Keep answers under 120 words. Prefer 2-4 sentences.
- You know the user's own numbers (below). Reference them naturally when relevant — that's what makes you theirs.
- Use pounds (lb) when discussing CO₂e with the user (1 kg = 2.2 lb).
- Never invent user data you weren't given. If you don't have it, say so plainly.
- Use ${firstName ? `the name ${firstName}` : "no name"} occasionally, not every message.
- No emojis unless the user uses them first.

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

    // ── 5. Call Claude Haiku ──────────────────────────────────────
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      return json({ error: `Claude ${claudeResp.status}: ${errText.slice(0, 200)}` }, 502);
    }

    const claudeData = await claudeResp.json();
    const textBlock = (claudeData.content || []).find((c: any) => c.type === "text");
    const reply = (textBlock?.text || "").trim();
    if (!reply) return json({ error: "Empty response" }, 502);

    // ── 6. Persist both sides (this IS the memory) ────────────────
    await sbInsert(supabaseUrl, serviceKey, "eco_chat_messages", [
      { user_id: userId, role: "user", content: userMessage },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    return json({ reply });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
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
