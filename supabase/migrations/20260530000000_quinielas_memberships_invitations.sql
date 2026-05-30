-- public.quinielas
CREATE TABLE IF NOT EXISTS public.quinielas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_by UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quinielas_created_by_idx ON public.quinielas(created_by);
CREATE TRIGGER set_quinielas_updated_at
  BEFORE UPDATE ON public.quinielas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.quinielas ENABLE ROW LEVEL SECURITY;

-- public.quiniela_memberships
CREATE TABLE IF NOT EXISTS public.quiniela_memberships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiniela_id UUID        NOT NULL REFERENCES public.quinielas(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiniela_memberships_unique_member UNIQUE (quiniela_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_quiniela_id_idx ON public.quiniela_memberships(quiniela_id);
CREATE INDEX IF NOT EXISTS memberships_user_id_idx     ON public.quiniela_memberships(user_id);
ALTER TABLE public.quiniela_memberships ENABLE ROW LEVEL SECURITY;

-- public.quiniela_invitations
CREATE TABLE IF NOT EXISTS public.quiniela_invitations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiniela_id        UUID        NOT NULL REFERENCES public.quinielas(id) ON DELETE CASCADE,
  email              TEXT        NOT NULL,
  role_to_assign     TEXT        NOT NULL DEFAULT 'member' CHECK (role_to_assign IN ('admin','member')),
  token_hash         TEXT        NOT NULL UNIQUE,
  expires_at         TIMESTAMPTZ NOT NULL,
  accepted_at        TIMESTAMPTZ NULL,
  revoked_at         TIMESTAMPTZ NULL,
  invited_by_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiniela_invitations_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT quiniela_invitations_not_both_accepted_revoked CHECK (NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS invitations_email_quiniela_idx ON public.quiniela_invitations(email, quiniela_id);
CREATE INDEX IF NOT EXISTS invitations_token_hash_idx     ON public.quiniela_invitations(token_hash);
CREATE INDEX IF NOT EXISTS invitations_quiniela_id_idx    ON public.quiniela_invitations(quiniela_id);
ALTER TABLE public.quiniela_invitations ENABLE ROW LEVEL SECURITY;

-- Atomic quiniela + admin membership creation
CREATE OR REPLACE FUNCTION public.create_quiniela_with_admin(p_name TEXT, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.quinielas(name, created_by) VALUES (p_name, p_user_id) RETURNING id INTO v_id;
  INSERT INTO public.quiniela_memberships(quiniela_id, user_id, role) VALUES (v_id, p_user_id, 'admin');
  RETURN v_id;
END;
$$;

-- RLS policies (service_role bypasses; these guard future direct DB access)
CREATE POLICY "quinielas_service_role" ON public.quinielas AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "memberships_service_role" ON public.quiniela_memberships AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "invitations_service_role" ON public.quiniela_invitations AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
