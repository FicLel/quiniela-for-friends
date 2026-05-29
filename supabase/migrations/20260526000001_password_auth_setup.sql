CREATE TABLE IF NOT EXISTS public.users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL UNIQUE,
  role                  TEXT NOT NULL CHECK (role IN ('admin', 'player')),
  must_change_password  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_idx ON public.users(auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx   ON public.users(email);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN
  IF NOT (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "users_own_row_select" ON public.users;
CREATE POLICY "users_own_row_select" ON public.users
  FOR SELECT USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS "users_own_row_update" ON public.users;
CREATE POLICY "users_own_row_update" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id);

-- Note: the RLS policies above apply only to Supabase PostgREST connections
-- (anon/authenticated roles). TypeORM connects via DATABASE_URL using the
-- 'postgres' superuser role, which bypasses RLS by default in PostgreSQL.
-- FORCE ROW LEVEL SECURITY is NOT applied here, so TypeORM operations
-- (e.g. setMustChangePassword) bypass these policies intentionally.
-- See migration 20260526000002_users_rls_bypass.sql for full rationale.
