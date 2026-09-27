import "@supabase/functions-js/edge-runtime.d.ts"

// analyze-snap — v5 camera (claude/CAMERA-READS.md)
//
// One button, every read. The model works out what the snap is (meal, menu,
// label, shelf, receipt, bill, fuel, fridge, tag, bin) and reads it. The
// server then:
//   • converts everything to lb, the app's one unit;
//   • attaches pour options where the packaging changes the number (beer);
//   • attaches facts ONLY from public.fact_library, by subject key. The model
//     names subjects; it never writes a fact the user will see as sourced.
//
// Model: Haiku by default (decided: Haiku or Sonnet, Opus dropped). Set
// SNAP_MODEL to the current Sonnet id to trade cost for accuracy.
//
// Auth: the caller is resolved from their access token (see _shared/auth.ts),
// never from a userId in the body.
//
// Deploy: supabase functions deploy analyze-snap
// Secrets: ANTHROPIC_API_KEY (already set), optional SNAP_MODEL

import { callerId, CORS_HEADERS, json } from "../_shared/auth.ts"
import { readFacts, extractStatedFacts, runInBackground } from "../_shared/facts.ts"

const LB = 2.20462
const KINDS = ["meal", "menu", "label", "shelf", "receipt", "bill", "fuel", "fridge", "tag", "bin"] as const
type Kind = typeof KINDS[number]

// kg CO2e per hectolitre by pack (Science of the Total Environment, 2024).
const BEER_PACK_KG_PER_HL: Record<string, number> = { draft: 64.48, bottle: 111.3, can: 116.64 }
const PINT_HL = 0.473 / 100

const SYSTEM = `You read photos for Eco Pulse, a carbon app. First decide what the photo shows, then read it.
Respond with ONLY one JSON object, no markdown.

"kind" is one of: meal, menu, label, shelf, receipt, bill, fuel, fridge, tag, bin.
  meal = food or drink in front of someone. menu = a restaurant menu. label = one packaged product.
  shelf = two packaged products to compare. receipt = a grocery receipt. bill = electricity or utility bill.
  fuel = a fuel receipt or pump display. fridge = inside a fridge or pantry. tag = a clothing care/material tag.
  bin = a single item someone is about to throw away.

Common fields for every kind:
  "kind", "label" (short title), "co2_kg" (total, number), "category" (transport|food|energy|digital|other),
  "activity_type" (car|flight|bus|train|meatmeal|vegmeal|coffee|heating|ac|streaming|custom),
  "confidence" (high|medium|low), "subjects" (array of snake_case subject keys, e.g. "beer_draft", "oat_milk", "beef").

Kind-specific fields:
  meal: "items": [{"name","kg","kcal_lo","kcal_hi","protein_g","guess":true|false,"subject":"snake_case",
         "pack": null|"draft"|"bottle"|"can"}]. Mark guess true when you are not sure what it is.
         For beer, set pack from what you see: a branded pint glass at a bar is usually draft.
  menu: "restaurant" (or null), "dishes": [{"name","kg","kcal_lo","kcal_hi","price"}] for up to 8 dishes you can read.
  label: "brand","product","size","packaging" (material and whether commonly recyclable),
         "label_facts": [{"label","text"}] ONLY things printed on the label: named additives, palm oil if listed,
         whether it has added oils/emulsifiers/stabilisers. Never say "toxic", never give health or allergy advice.
         "nutrition": {"kcal","protein_g","sugar_g","per"} as printed.
  shelf: "a" and "b", each {"name","kg","price","unit_price","unit","kcal","protein_g"}.
  receipt: "store","total_usd","lines":[{"name","category":"Meat|Dairy|Produce|Pantry|Drinks|Household|Other","kg","usd"}].
  bill: "bill": {"kwh","period_days","total_usd"}. co2_kg = kwh × 0.39.
  fuel: "fuel": {"gallons","total_usd","grade"}. co2_kg = gallons × 8.887.
  fridge: "items_at_risk": [{"name","days_left","kg"}].
  tag: "fibres": [{"fibre","pct"}].
  bin: "item","stream":"recycling|compost|trash|special","why".

Reference kg CO2e: beef meal 3.6, chicken meal 1.8, veg meal 0.8, latte 0.21, 1 L dairy milk 3.2, 1 L oat milk 0.9,
petrol car per mile 0.404, grid electricity per kWh 0.39. Keep numbers plausible; say low confidence when unsure.`

function asKind(k: unknown): Kind {
  return (KINDS as readonly string[]).includes(String(k)) ? (k as Kind) : "meal"
}

async function libraryFacts(supabaseUrl: string, serviceKey: string, subjects: string[]) {
  if (!subjects.length) return []
  const list = subjects.map((s) => `"${s.replace(/[^a-z0-9_]/g, "")}"`).join(",")
  const res = await fetch(
    `${supabaseUrl}/rest/v1/fact_library?subject_key=in.(${list})&reviewed_at=not.is.null&select=subject_key,slot,text,lb_delta,usd_delta,source_name,source_url`,
    { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } },
  )
  return res.ok ? await res.json() : []
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const model = Deno.env.get("SNAP_MODEL") || "claude-haiku-4-5"
    if (!anthropicKey || !supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 500)

    const userId = await callerId(req, supabaseUrl, serviceKey)
    if (!userId) return json({ error: "Sign in required" }, 401)

    const { imageBase64, correction, kindHint } = await req.json()
    if (!imageBase64 && !correction) return json({ error: "imageBase64 or correction is required" }, 400)

    const facts = await readFacts(supabaseUrl, serviceKey, userId, 20)
    const context = facts.length
      ? `\nUSER CONTEXT (what this user told us; calibrate to it, e.g. a car is probably their car): ${JSON.stringify(facts.map((f: any) => ({ key: f.key, value: f.value })))}`
      : ""
    const hint = kindHint && KINDS.includes(kindHint) ? `\nThe user says this is: ${kindHint}. Use that kind.` : ""

    const content = correction
      ? [{ type: "text", text: `The photo shows: ${correction}. Read it again with that correction.${hint}` }]
      : [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: `Read this photo.${hint}` },
        ]

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1200, system: SYSTEM + context, messages: [{ role: "user", content }] }),
    })
    const data = await ai.json()
    if (data.error) return json({ error: data.error.message || "Model error" }, 502)

    const text: string = data.content?.[0]?.text || ""
    const s = text.indexOf("{")
    const e = text.lastIndexOf("}")
    if (s === -1 || e === -1) return json({ error: "Could not read the photo" }, 502)
    const r = JSON.parse(text.slice(s, e + 1))

    const kind = asKind(r.kind)
    const subjects: string[] = Array.isArray(r.subjects) ? r.subjects.map(String).slice(0, 12) : []

    // Meal items: lb, and pour options for beer.
    let items: any[] | undefined
    if (kind === "meal" && Array.isArray(r.items)) {
      items = r.items.slice(0, 8).map((it: any, i: number) => {
        const isBeer = typeof it.subject === "string" && it.subject.startsWith("beer")
        const options = isBeer
          ? Object.entries(BEER_PACK_KG_PER_HL).map(([id, kgHl]) => ({
              id,
              label: id === "draft" ? "Draft" : id === "bottle" ? "Bottle" : "Can",
              lb: Number((kgHl * PINT_HL * LB).toFixed(2)),
            }))
          : undefined
        const pack = isBeer && ["draft", "bottle", "can"].includes(it.pack) ? it.pack : isBeer ? "draft" : undefined
        if (isBeer && pack) subjects.push(`beer_${pack}`, "beer_bottle", "beer_can")
        return {
          id: `i${i}`,
          name: String(it.name ?? "Item"),
          guess: !!it.guess,
          lb: options?.find((o) => o.id === pack)?.lb ?? Number(((Number(it.kg) || 0) * LB).toFixed(2)),
          kcal: [Math.round(Number(it.kcal_lo) || 0), Math.round(Number(it.kcal_hi) || 0)],
          proteinG: Math.round(Number(it.protein_g) || 0),
          options,
          optionId: pack,
        }
      })
    }

    // Sourced facts only.
    const lib: any[] = await libraryFacts(supabaseUrl, serviceKey, [...new Set(subjects)])
    const pick = (slot: string) => lib.find((f) => f.slot === slot)
    const good = pick("good")
    const fewKnow = pick("few_know")
    const catchFact = pick("catch")
    const tips = lib.filter((f) => f.slot === "tip")
    const tip = tips.length
      ? {
          title: tips[0].text,
          lb: Number(tips[0].lb_delta) || 0,
          usd: tips[0].usd_delta == null ? null : Number(tips[0].usd_delta),
          showFor: tips.map((t) => String(t.subject_key).replace(/^beer_/, "")),
        }
      : null

    const result = {
      kind,
      label: String(r.label ?? "Snap"),
      co2_kg: Number(r.co2_kg) || 0,
      category: ["transport", "food", "energy", "digital", "other"].includes(r.category) ? r.category : "other",
      activity_type: String(r.activity_type ?? "custom"),
      confidence: ["high", "medium", "low"].includes(r.confidence) ? r.confidence : "medium",
      explanation: "",
      suggestions: [],
      equivalent: null,
      items,
      good: good?.text ?? null,
      few_know: fewKnow?.text ?? null,
      catch: catchFact?.text ?? null,
      tip,
      source: good?.source_name ?? fewKnow?.source_name ?? catchFact?.source_name ?? null,
      menu: kind === "menu" ? { restaurant: r.restaurant ?? null, dishes: r.dishes ?? [] } : undefined,
      label_read: kind === "label" ? { brand: r.brand, product: r.product, size: r.size, packaging: r.packaging, facts: r.label_facts ?? [], nutrition: r.nutrition ?? null } : undefined,
      shelf: kind === "shelf" ? { a: r.a, b: r.b } : undefined,
      receipt: kind === "receipt" ? { store: r.store, total_usd: r.total_usd, lines: r.lines ?? [] } : undefined,
      bill: kind === "bill" && r.bill?.kwh > 0
        ? { kwh: Number(r.bill.kwh), period_days: Math.min(92, Math.max(1, Math.round(Number(r.bill.period_days) || 30))), total_usd: r.bill.total_usd ?? null }
        : null,
      fuel: kind === "fuel" ? r.fuel : undefined,
      fridge: kind === "fridge" ? r.items_at_risk : undefined,
      tag: kind === "tag" ? r.fibres : undefined,
      bin: kind === "bin" ? { item: r.item, stream: r.stream, why: r.why } : undefined,
    }

    // A typed correction is the user speaking; the photo itself is not.
    if (typeof correction === "string" && correction.trim()) {
      runInBackground(
        extractStatedFacts({ anthropicKey, supabaseUrl, serviceKey, userId, userText: correction, source: "photo", knownKeys: facts.map((f: any) => f.key) }),
      )
    }

    return json({ result })
  } catch (err) {
    return json({ error: (err as Error).message || "Internal error" }, 500)
  }
})
