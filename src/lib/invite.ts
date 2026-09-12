// src/lib/invite.ts
//
// Invite-code redemption, shared by both signup paths (phone OTP and email).
//
// Why this exists:
//   1. Email signup may not return a session immediately (Supabase email
//      confirmation). The code therefore cannot be redeemed at signup time —
//      it is stashed locally and redeemed on the first authenticated launch.
//   2. The old inline redemption in OTPVerifyScreen issued a direct UPDATE on
//      invite_codes. RLS policy `invite_codes_own` is USING (auth.uid() =
//      owner_id), so a brand-new user updating *someone else's* code matches
//      zero rows and the update silently no-ops (OBS-022). Redemption now goes
//      through the SECURITY DEFINER RPC `redeem_invite_code`, which is the only
//      way this can actually work under the current policies.
//
// Migration: supabase/migrations/0002_redeem_invite_code.sql

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const PENDING_KEY = 'ecopulse.pendingInvite';

export type PendingInvite = { id: string; code: string };

export async function stashPendingInvite(invite: PendingInvite): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(invite));
  } catch {
    // Storage failure is non-fatal — the user still gets an account.
  }
}

export async function readPendingInvite(): Promise<PendingInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingInvite) : null;
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

/**
 * Mark an invite code as used. Requires an authenticated session.
 * Falls back to the locally stashed invite when no id is passed.
 * Never throws — a failed redemption must not block a user who is already in.
 */
export async function redeemInvite(inviteCodeId?: string | null): Promise<boolean> {
  let id = inviteCodeId ?? null;
  if (!id) {
    const pending = await readPendingInvite();
    id = pending?.id ?? null;
  }
  if (!id) return false;

  try {
    const { error } = await supabase.rpc('redeem_invite_code', { p_code_id: id });
    if (error) {
      console.warn('[invite] redeem_invite_code failed:', error.message);
      return false;
    }
    await clearPendingInvite();
    return true;
  } catch (e) {
    console.warn('[invite] redeem threw:', e);
    return false;
  }
}
