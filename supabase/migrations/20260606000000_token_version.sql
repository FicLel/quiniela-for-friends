-- Add token_version to users so stale JWTs can be detected and invalidated.
-- Every time a user's system role changes, increment token_version.
-- The private layout compares the JWT's tokenVersion to this column and
-- redirects to login if they differ, forcing the user to get a fresh token.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

-- Atomically increments token_version for a given user.
CREATE OR REPLACE FUNCTION public.increment_token_version(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.users
  SET token_version = token_version + 1
  WHERE id = p_user_id;
$$;
