-- Restore project-owner access after the original containment migration forced
-- RLS on every public table. This does not grant anon or authenticated roles
-- any table privileges and RLS remains enabled for every table.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
