-- Fix: creator admin membership should be pre-approved
CREATE OR REPLACE FUNCTION public.create_quiniela_with_admin(p_name TEXT, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.quinielas(name) VALUES (p_name) RETURNING id INTO v_id;
  INSERT INTO public.quiniela_memberships(quiniela_id, user_id, role, approved_at)
    VALUES (v_id, p_user_id, 'admin', NOW());
  RETURN v_id;
END;
$$;

-- Backfill existing admin memberships that are stuck with NULL approved_at
UPDATE public.quiniela_memberships
  SET approved_at = joined_at
  WHERE role = 'admin' AND approved_at IS NULL;
