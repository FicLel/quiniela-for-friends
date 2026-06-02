-- Migration: per-quiniela predictions with shared/per-quiniela mode toggle
-- Adds app_settings table and extends user_expected_results with quiniela_id

-- ---------------------------------------------------------------------------
-- 1. app_settings — single-row settings table (unique index on true)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_mode  TEXT        NOT NULL DEFAULT 'shared'
                               CHECK (prediction_mode IN ('shared', 'per_quiniela')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforces a single row: only one settings record can ever exist
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_single_row ON public.app_settings ((true));

CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_service_role"
  ON public.app_settings AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed the single settings row
INSERT INTO public.app_settings (prediction_mode) VALUES ('shared') ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. user_expected_results — add quiniela_id FK (nullable)
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_expected_results
  ADD COLUMN IF NOT EXISTS quiniela_id UUID REFERENCES public.quinielas(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Constraint migration: (user_id, match_id) → (user_id, match_id, quiniela_id)
-- ---------------------------------------------------------------------------

-- Drop the old unique constraint that doesn't include quiniela_id
ALTER TABLE public.user_expected_results
  DROP CONSTRAINT IF EXISTS user_expected_results_unique;

-- New composite unique for per-quiniela rows
ALTER TABLE public.user_expected_results
  ADD CONSTRAINT user_expected_results_unique_per_quiniela
  UNIQUE (user_id, match_id, quiniela_id);

-- Partial unique index for shared (NULL) rows: one shared prediction per (user, match)
CREATE UNIQUE INDEX IF NOT EXISTS user_expected_results_unique_shared
  ON public.user_expected_results (user_id, match_id)
  WHERE quiniela_id IS NULL;
