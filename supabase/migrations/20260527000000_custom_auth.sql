-- Migration: replace Supabase Auth identity column with a local password_hash.
--
-- Prior to this migration:
--   - auth_id   UUID NOT NULL UNIQUE REFERENCES auth.users(id)  ← external FK to Supabase Auth
--
-- After this migration:
--   - auth_id      column is dropped (Supabase Auth is no longer used as the IdP)
--   - email        already existed (UNIQUE NOT NULL TEXT)
--   - password_hash TEXT NOT NULL  ← bcrypt hash stored in our own table
--
-- Indexes for the old auth_id column are also dropped.
-- The RLS policies that referenced auth.uid() are dropped because
-- PostgREST / Supabase Auth is no longer the access path. All access
-- now goes through the service-role key (server-side only).

-- 1. Drop the RLS policies that reference auth.uid()
DROP POLICY IF EXISTS "users_own_row_select" ON public.users;
DROP POLICY IF EXISTS "users_own_row_update" ON public.users;

-- 2. Drop the old auth_id index and column
DROP INDEX IF EXISTS public.users_auth_id_idx;

ALTER TABLE public.users DROP COLUMN IF EXISTS auth_id;

-- 3. Add the password_hash column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- Remove the DEFAULT now that the column exists (prevents accidental empty hashes)
ALTER TABLE public.users ALTER COLUMN password_hash DROP DEFAULT;
