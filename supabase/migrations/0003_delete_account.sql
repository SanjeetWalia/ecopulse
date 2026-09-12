-- 0003_delete_account.sql
--
-- YouScreen calls supabase.rpc('delete_account'). The function exists in the
-- live project but its SQL was never committed — a YouScreen comment says
-- "run supabase/delete_account.sql once" and that file is not in the repo
-- (OBS-018).
--
-- This is a RECONSTRUCTION. To avoid clobbering a working production function
-- with a guess, it only creates the function when one does not already exist.
-- Once you have dumped the real definition, replace this whole file with it and
-- drop the guard.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'delete_account'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.delete_account()
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_uid UUID := auth.uid();
      BEGIN
        IF v_uid IS NULL THEN
          RAISE EXCEPTION 'delete_account requires an authenticated session';
        END IF;

        -- Everything user-owned cascades from profiles, except rows that
        -- deliberately survive with a null owner.
        UPDATE public.invite_codes SET used_by = NULL WHERE used_by = v_uid;

        DELETE FROM public.profiles WHERE id = v_uid;
        DELETE FROM auth.users      WHERE id = v_uid;
      END;
      $body$;
    $fn$;

    REVOKE ALL ON FUNCTION public.delete_account() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
  END IF;
END $$;
