-- Make email optional (null = open invite, anyone can accept)
ALTER TABLE public.quiniela_invitations
  ALTER COLUMN email DROP NOT NULL;

-- Drop unique index on (quiniela_id, email) if it exists
DROP INDEX IF EXISTS public.invitations_quiniela_email_active_idx;
