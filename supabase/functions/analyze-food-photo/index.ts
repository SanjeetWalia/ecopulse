import "@supabase/functions-js/edge-runtime.d.ts"

// analyze-food-photo — v4
// (download name analyze-food-photo-v4.ts — copy to supabase/functions/analyze-food-photo/index.ts)
//
// v4 adds PERSONAL CALIBRATION + BILL READING:
//   1. Accepts optional userId; fetches user_facts and injects them as
//      USER CONTEXT — so a photo of "a car" is analyzed as THEIR car,
//      a meal against THEIR diet baseline.
//   2. Detects utility/electricity bills: extracts kWh and billing-period
//      days into a "bill" field, and records the bill as a user fact so
//      the chat stops asking for it. The client offers to spread the
//      bill's CO₂ across its billing days.
//   3. Keeps v3's fixes: valid categories only, "equivalent" field.
//
// Deploy: supabase functions deploy analyze-food-photo --no-verify-jwt

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const VALID_CATEGORIES = ["transport", "food", "energy", "digital", "other"]

const BASE_SYSTEM_PROMPT = `You are an expert carbon footprint analyst. Analyze images and estimate CO₂ emissions.
Always respond with ONLY this JSON (no markdown):
{"label":"short description","co2_kg":0.0,"category":"transport|food|energy|digital|other","activity_type":"car|flight|bus|train|meatmeal|vegmeal|coffee|heating|ac|streaming|custom","equivalent":"one plain-English comparison under 12 words, everyday units (phone charges, miles driven, coffees), never repeating the kg number","explanation":"1-2 sentences","confidence":"high|medium|low","suggestions":["greener alternative 1","greener alternative 2"],"bill":null}
Rules for category: shopping, purchases, and packaging belong under "other". Anything not clearly transport/food/energy/digital is "other".
BILLS: if the image is an electricity/utility bill, set category "energy", extract usage and period, and set "bill":{"kwh":NUMBER,"period_days":NUMBER} (period_days from the billing period dates; default 30 if unreadable). co2_kg = kwh × 0.39 (US grid average). label like "Electricity bill · 412 kWh / 30 days". For non-bills, "bill" must be null.
CO₂ reference: beef meal 3.6kg, chicken 1.8kg, veg meal 0.8kg, coffee/latte 0.21kg, chai latte 0.18kg, petrol car/mile 0.404kg, EV/mile 0.12kg, flight/mile 0.255kg, phone full charge 0.008kg, 1hr HD streaming 0.036kg, grid electricity 0.39kg/kWh.`

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const { imageBase64, correction, userId } = await req.json()

    if (!imageBase64 && !correction) {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or correction is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    // ── Personal calibration: fetch the user's durable facts ──────
    let userContext = ""
    let facts: any[] = []
    if (userId && supabaseUrl && serviceKey) {
      try {
        const resp = await fetch(
          `${supabaseUrl}/rest/v1/user_facts?user_id=eq.${userId}&select=key,fact_type,value&order=updated_at.desc&limit=20`,
          { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } }
        )
        if (resp.ok) {
          facts = await resp.json()
          if (Array.isArray(facts) && facts.length > 0) {
            userContext = `\nUSER CONTEXT (durable facts about this specific user — calibrate to these; e.g. a photo of a car is most likely THEIR car unless clearly not): ${JSON.stringify(facts)}`
          }
        }
      } catch { /* calibration is best-effort */ }
    }

    const userMessage = correction
      ? `The image shows: ${correction}. Please recalculate the CO₂ footprint for this specific item.`
      : "What is the carbon footprint of what you see in this image? Give me a precise CO₂ estimate."

    const content = correction
      ? [{ type: "text", text: userMessage }]
      : [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: userMessage },
        ]

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 700,
        system: BASE_SYSTEM_PROMPT + userContext,
        messages: [{ role: "user", content }],
      }),
    })

    const data = await anthropicRes.json()

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message || "Anthropic API error" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const text = data.content?.[0]?.text || ""
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")

    if (start === -1 || end === -1) {
      return new Response(
        JSON.stringify({ error: "Could not parse response" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const parsed = JSON.parse(text.slice(start, end + 1))

    // Defensive normalization
    if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = "other"
    if (typeof parsed.equivalent !== "string" || parsed.equivalent.trim() === "") parsed.equivalent = null
    if (parsed.bill && (typeof parsed.bill.kwh !== "number" || parsed.bill.kwh <= 0)) parsed.bill = null
    if (parsed.bill) {
      parsed.bill.period_days = Math.min(92, Math.max(1, Math.round(Number(parsed.bill.period_days) || 30)))
    }

    // If it's a bill and we know the user, remember it — the chat's
    // "snap your bill" nudge turns off automatically.
    if (parsed.bill && userId && supabaseUrl && serviceKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/user_facts?on_conflict=user_id,key`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            "content-type": "application/json",
            prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify([{
            user_id: userId,
            key: "electricity_bill",
            fact_type: "home_energy",
            value: { kwh: parsed.bill.kwh, period_days: parsed.bill.period_days, noted_at: new Date().toISOString() },
            source: "bill",
            updated_at: new Date().toISOString(),
          }]),
        })
      } catch { /* best-effort */ }
    }

    return new Response(
      JSON.stringify({ result: parsed }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }
})
