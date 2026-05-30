-- Add 8-char short_code to invitations
ALTER TABLE public.quiniela_invitations
  ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

UPDATE public.quiniela_invitations
  SET short_code = substring(gen_random_uuid()::text FROM 1 FOR 8)
  WHERE short_code IS NULL;

ALTER TABLE public.quiniela_invitations
  ALTER COLUMN short_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS invitations_short_code_idx
  ON public.quiniela_invitations(short_code);

-- Add approval gate to memberships (NULL = pending, non-null = approved)
ALTER TABLE public.quiniela_memberships
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;

-- Backfill: existing members are considered approved
UPDATE public.quiniela_memberships
  SET approved_at = joined_at
  WHERE approved_at IS NULL;

CREATE INDEX IF NOT EXISTS memberships_pending_idx
  ON public.quiniela_memberships(approved_at)
  WHERE approved_at IS NULL;
