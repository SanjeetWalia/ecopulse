import "@supabase/functions-js/edge-runtime.d.ts"

// revenuecat-webhook — entitlement and streak-repair purchases
//
// RevenueCat is the store layer (StoreKit receipts, trials, offers). It calls
// this function on every subscription event; this is the ONLY writer of
// public.user_entitlements, so the app can never grant itself access.
//
//   Trial started           → status 'trial'
//   First paid month        → status 'active', first_paid_at set once
//                             (fires the chain-rewards trigger in 0007)
//   Renewal                 → 'active'
//   Cancellation            → will_renew false; access runs to period end
//   Billing issue           → 'billing_issue'
//   Expiration              → 'expired' (the app shows the paywall again)
//   $0.99 streak repair     → +1 purchased repair credit
//
// The app must call Purchases.logIn(<supabase user id>) so app_user_id is our
// user id.
//
// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets: REVENUECAT_WEBHOOK_SECRET (same value as the Authorization header
//          set in the RevenueCat dashboard), optional REPAIR_PRODUCT_ID.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("forbidden", { status: 403 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const repairProduct = Deno.env.get("REPAIR_PRODUCT_ID") || "ecopulse_streak_repair"
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" }

  const body = await req.json()
  const ev = body?.event ?? {}
  const userId: string = ev.app_user_id ?? ""
  if (!UUID_RE.test(userId)) {
    // Anonymous RevenueCat ids ($RCAnonymousID) can't be tied to a user yet.
    return new Response(JSON.stringify({ skipped: "anonymous app_user_id" }), { status: 200 })
  }

  const at = (ms?: number | null) => (ms ? new Date(ms).toISOString() : null)
  const now = new Date().toISOString()

  // Streak repair: a consumable, not a subscription.
  if (ev.type === "NON_RENEWING_PURCHASE" && ev.product_id === repairProduct) {
    await fetch(`${supabaseUrl}/rest/v1/rpc/credit_repair_purchase`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_user: userId }),
    })
    return new Response(JSON.stringify({ ok: true, credited: "repair" }))
  }

  const cur = await fetch(`${supabaseUrl}/rest/v1/user_entitlements?user_id=eq.${userId}&select=*`, { headers })
  const existing = cur.ok ? (await cur.json())[0] : undefined

  const patch: Record<string, unknown> = {
    user_id: userId,
    product_id: ev.product_id ?? existing?.product_id ?? null,
    current_period_ends_at: at(ev.expiration_at_ms) ?? existing?.current_period_ends_at ?? null,
    updated_at: now,
  }

  const paidPeriod = ev.period_type && ev.period_type !== "TRIAL"

  switch (ev.type) {
    case "INITIAL_PURCHASE":
      if (ev.period_type === "TRIAL") {
        patch.status = "trial"
        patch.trial_started_at = at(ev.purchased_at_ms) ?? now
      } else {
        patch.status = "active"
        patch.first_paid_at = existing?.first_paid_at ?? at(ev.purchased_at_ms) ?? now
      }
      patch.will_renew = true
      break
    case "RENEWAL": // includes a trial converting to its first paid month
      patch.status = "active"
      if (paidPeriod || !ev.period_type) patch.first_paid_at = existing?.first_paid_at ?? at(ev.purchased_at_ms) ?? now
      patch.will_renew = true
      break
    case "UNCANCELLATION":
      patch.will_renew = true
      break
    case "CANCELLATION":
      patch.will_renew = false
      break
    case "BILLING_ISSUE":
      patch.status = "billing_issue"
      break
    case "EXPIRATION":
      patch.status = "expired"
      patch.will_renew = false
      break
    default:
      return new Response(JSON.stringify({ ignored: ev.type ?? "unknown" }))
  }

  const up = await fetch(`${supabaseUrl}/rest/v1/user_entitlements?on_conflict=user_id`, {
    method: "POST",
    headers: { ...headers, prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(patch),
  })
  if (!up.ok) {
    // Non-2xx makes RevenueCat retry, which is what we want.
    return new Response(await up.text(), { status: 500 })
  }
  return new Response(JSON.stringify({ ok: true, type: ev.type }))
})
