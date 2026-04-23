import "@supabase/functions-js/edge-runtime.d.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SYSTEM_PROMPT = `You are an expert carbon footprint analyst. Analyze images and estimate CO₂ emissions.
Always respond with ONLY this JSON (no markdown):
{"label":"short description","co2_kg":0.0,"category":"transport|food|energy|shopping|digital|other","activity_type":"car|flight|bus|train|meatmeal|vegmeal|coffee|heating|ac|streaming|custom","explanation":"1-2 sentences","confidence":"high|medium|low","suggestions":["greener alternative 1","greener alternative 2"]}
CO₂ reference: beef meal 3.6kg, chicken 1.8kg, veg meal 0.8kg, coffee/latte 0.21kg, chai latte 0.18kg, petrol car/mile 0.404kg, flight/mile 0.255kg.`

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const { imageBase64, correction } = await req.json()

    if (!imageBase64 && !correction) {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or correction is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
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