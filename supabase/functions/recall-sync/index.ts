import "@supabase/functions-js/edge-runtime.d.ts"

// recall-sync — Heads up, the recall half (claude/CAMERA-READS.md)
//
// Runs once a day (pg_cron, see supabase/run-once). Pulls new food recalls
// from the FDA (openFDA food enforcement) and USDA FSIS, stores them as
// heads_up_items, then matches each new item against every watch list with
// public.match_heads_up_item. Matches show on Today and in Heads up.
//
// Wording rules: the recall's own reason is quoted as published. We add one
// plain action and never characterise a brand beyond what the source says.
//
// FSIS field names below follow their public Recall API (v1). They were not
// verifiable from here; the first run logs how many rows it could parse, so
// check the function logs once after deploying.
//
// Deploy: supabase functions deploy recall-sync --no-verify-jwt
// Called by: cron, with the service role key as bearer (checked below).

const FDA_URL = "https://api.fda.gov/food/enforcement.json"
const FSIS_URL = "https://www.fsis.usda.gov/fsis/api/recall/v/1"

const ACTION =
  "Check the codes or dates on your package against the ones listed. If they match, don’t use it. Stores will usually refund it, receipt or not."

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

function isoFromYmd(s: string | undefined): string | null {
  if (!s || s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function shortProduct(desc: string): string {
  const first = desc.split(/[;,.]/)[0]?.trim() ?? desc
  return first.length > 70 ? first.slice(0, 67) + "…" : first
}

interface Item {
  external_id: string
  kind: "recall"
  title: string
  body: string
  action: string
  evidence: "official recall"
  source_name: string
  source_url: string
  firm: string | null
  product_text: string
  lot_codes: string[] | null
  region: string | null
  published_at: string | null
}

async function fromFda(days: number): Promise<Item[]> {
  const to = new Date()
  const from = new Date(Date.now() - days * 86_400_000)
  const url = `${FDA_URL}?search=report_date:[${ymd(from)}+TO+${ymd(to)}]&limit=100`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((r: any): Item => ({
    external_id: `fda:${r.recall_number}`,
    kind: "recall",
    title: `${r.recalling_firm} recalls ${shortProduct(r.product_description ?? "a product")}`,
    body: `Reason given: ${String(r.reason_for_recall ?? "").replace(/^"|"$/g, "")}`.slice(0, 900),
    action: ACTION,
    evidence: "official recall",
    source_name: `FDA recall ${r.recall_number}${r.classification ? `, ${r.classification}` : ""}`,
    source_url: "https://www.accessdata.fda.gov/scripts/ires/index.cfm",
    firm: r.recalling_firm ?? null,
    product_text: String(r.product_description ?? "").slice(0, 2000),
    lot_codes: r.code_info && r.code_info !== "No codes" ? [String(r.code_info).slice(0, 400)] : null,
    region: r.distribution_pattern ?? null,
    published_at: isoFromYmd(r.report_date),
  }))
}

async function fromFsis(days: number): Promise<Item[]> {
  const res = await fetch(FSIS_URL, { headers: { accept: "application/json" } })
  if (!res.ok) return []
  const rows: any[] = await res.json()
  const since = Date.now() - days * 86_400_000
  return rows
    .filter((r) => (r.langcode ?? "English") === "English")
    .filter((r) => {
      const t = Date.parse(r.field_recall_date ?? "")
      return Number.isFinite(t) && t >= since
    })
    .map((r): Item => ({
      external_id: `fsis:${r.field_recall_number}`,
      kind: "recall",
      title: String(r.field_title ?? "USDA recall"),
      body: `Reason given: ${String(r.field_recall_reason ?? r.field_summary ?? "").replace(/<[^>]+>/g, "")}`.slice(0, 900),
      action: ACTION,
      evidence: "official recall",
      source_name: `USDA FSIS recall ${r.field_recall_number}`,
      source_url: "https://www.fsis.usda.gov/recalls",
      firm: r.field_establishment ?? null,
      product_text: `${r.field_title ?? ""} ${String(r.field_product_items ?? "").replace(/<[^>]+>/g, "")}`.slice(0, 2000),
      lot_codes: null,
      region: r.field_states ?? null,
      published_at: (r.field_recall_date ?? "").slice(0, 10) || null,
    }))
    .filter((i) => i.external_id !== "fsis:undefined")
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${serviceKey}`) return new Response("forbidden", { status: 403 })

  const days = 10 // overlap covers missed runs; upsert dedupes
  const [fda, fsis] = await Promise.all([fromFda(days).catch(() => []), fromFsis(days).catch(() => [])])
  const items = [...fda, ...fsis]

  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  }

  let stored: { id: string }[] = []
  if (items.length) {
    const up = await fetch(`${supabaseUrl}/rest/v1/heads_up_items?on_conflict=external_id`, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(items),
    })
    stored = up.ok ? await up.json() : []
  }

  let matches = 0
  for (const row of stored) {
    const m = await fetch(`${supabaseUrl}/rest/v1/rpc/match_heads_up_item`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_item: row.id }),
    })
    if (m.ok) matches += Number(await m.json()) || 0
  }

  const summary = { fda: fda.length, fsis: fsis.length, new_items: stored.length, new_matches: matches }
  console.log("[recall-sync]", JSON.stringify(summary))
  return new Response(JSON.stringify(summary), { headers: { "content-type": "application/json" } })
})
