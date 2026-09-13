-- 0006_invite_code_validation.sql
--
-- Closes the invite-code enumeration hole.
--
-- THE PROBLEM. Production carries these two policies on invite_codes:
--
--   invite_codes_public_read  FOR SELECT TO public USING (true)
--   "validate code"           FOR SELECT TO public USING (true)
--
-- TO public includes the anon role, and the anon key ships inside the app
-- bundle (it is also in src/lib/supabase.ts). So anyone who extracts that key
-- can run `select * from invite_codes` and read every unused code in the pool.
-- The invite-only gate is the product's entire access-control story right now,
-- and it can be walked around by reading a table.
--
-- WelcomeScreen needed that SELECT because it validates a code BEFORE the user
-- has any session. This function gives it exactly what it needs and nothing
-- else: is this one code usable, and what is its id. No listing, no pool.
--
-- The matching policy drops are deliberately NOT in this migration. Dropping
-- the SELECT policy before a build containing the new WelcomeScreen is live
-- would break signup for every invitee holding a code. See
-- supabase/run-once/2026-09-13-editor.sql, step 6.

CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS TABLE (code_id UUID, state TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ic.id,
         CASE WHEN COALESCE(ic.status, 'unused') = 'unused' THEN 'valid' ELSE 'used' END
    FROM public.invite_codes ic
   WHERE UPPER(TRIM(ic.code)) = UPPER(TRIM(p_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO anon, authenticated;
