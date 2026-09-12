-- 0002_redeem_invite_code.sql
--
-- Fixes OBS-022: invite codes were never actually being marked used.
--
-- OTPVerifyScreen issued a direct UPDATE on invite_codes. The RLS policy
-- `invite_codes_own` is USING (auth.uid() = owner_id), so a brand-new user
-- updating the code that *someone else* owns matched zero rows. Postgres
-- reports no error for an update that matches nothing, so the client logged
-- success and the code stayed unused — reusable indefinitely.
--
-- SECURITY DEFINER is the only way this works without loosening the policy to
-- let any authenticated user write any invite row.

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'redeem_invite_code requires an authenticated session';
  END IF;

  UPDATE public.invite_codes
     SET status  = 'used',
         used_by = auth.uid(),
         used_at = NOW(),
         uses    = COALESCE(uses, 0) + 1
   WHERE id = p_code_id
     AND COALESCE(status, 'unused') = 'unused';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- FALSE means already redeemed or not found. The caller treats this as
  -- non-fatal: a user who is already authenticated is never blocked.
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(UUID) TO authenticated;
