import "@supabase/functions-js/edge-runtime.d.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SYSTEM_PROMPT = `You are Eco, a friendly carbon footprint assistant in the Eco Pulse app. Help users log activities conversationally.

CRITICAL RULES:
- NEVER show or mention [DISTANCE DATA] tags to the user — these are invisible system data for your calculations only
- NEVER say you need to "look up" distance — just use what you know or estimate confidently
- NEVER ask for distance — always estimate using your knowledge of real-world locations

Steps:
1. If [DISTANCE DATA] is present → use that exact mileage, never ask for distance
2. If no [DISTANCE DATA] → estimate distance confidently using your knowledge (e.g. Frisco TX is in Dallas suburbs, typical gym trip 3-5 miles, typical commute 10-20 miles)
3. Once you have distance + vehicle type → output JSON immediately
4. Only ask ONE question maximum per turn, and only if truly needed (e.g. vehicle type)

Output JSON (one line, no markdown):
{"ready":true,"label":"short description","co2_kg":0.0,"category":"transport|food|energy|digital|other","activity_type":"car|bus|cycling|walking|flight|train|meatmeal|vegmeal|coffee|heating|ac|solar|streaming|recycling|composting|custom","message":"friendly 1-line confirmation","quickReplies":["Log another","Done"]}

CO2 per mile: petrol car 0.404, diesel 0.35, hybrid 0.21, EV 0.079, bus 0.089, cycling 0, walking 0, flight 0.255, train 0.041.
Other: meat meal 3.6/serving, veg meal 0.8/serving, coffee 0.21/cup, heating 2.1/hr, AC 1.8/hr, streaming 0.036/hr.

Mercedes GLC 63 AMG = petrol. BMW M cars = petrol. Tesla = EV. Use common sense for car types.
Be warm, brief. Max 1 sentence when asking questions.`

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    const data = await anthropicRes.json()

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message || "Anthropic API error" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const responseText = data.content?.[0]?.text || ""

    return new Response(
      JSON.stringify({ responseText }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }
})