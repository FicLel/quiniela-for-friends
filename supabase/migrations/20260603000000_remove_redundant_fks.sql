-- Drop created_by from quinielas (redundant — admin membership already captures the creator)
DROP INDEX IF EXISTS public.quinielas_created_by_idx;
ALTER TABLE public.quinielas DROP COLUMN IF EXISTS created_by;

-- Update the RPC: p_user_id is still needed for the admin membership INSERT
CREATE OR REPLACE FUNCTION public.create_quiniela_with_admin(p_name TEXT, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.quinielas(name) VALUES (p_name) RETURNING id INTO v_id;
  INSERT INTO public.quiniela_memberships(quiniela_id, user_id, role) VALUES (v_id, p_user_id, 'admin');
  RETURN v_id;
END;
$$;

-- Drop invited_by_user_id from quiniela_invitations (never queried or displayed)
ALTER TABLE public.quiniela_invitations DROP COLUMN IF EXISTS invited_by_user_id;
