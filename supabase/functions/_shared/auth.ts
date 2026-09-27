// supabase/functions/_shared/auth.ts
//
// Resolve the caller from their access token instead of trusting a userId in
// the request body. The v3/v4 functions accept `userId` from the body and are
// deployed with --no-verify-jwt, so anyone holding the anon key could ask for
// another user's calibration (OBS-038). New functions use this; the old ones
// should move to it when they are next touched.

export async function callerId(req: Request, supabaseUrl: string, anonOrServiceKey: string): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : ""
  if (!token) return null
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonOrServiceKey, authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const user = await res.json()
    return typeof user?.id === "string" ? user.id : null
  } catch {
    return null
  }
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}
