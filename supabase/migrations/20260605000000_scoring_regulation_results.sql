-- ---------------------------------------------------------------------------
-- Migration: 20260605000000_scoring_regulation_results
-- Purpose  : Add regulation-time goals and sync timestamp to matches;
--            add lock/submit timestamps to predictions;
--            create prediction_scores table for three-point scoring.
-- ---------------------------------------------------------------------------

-- Extend matches
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS regulation_home_goals  INTEGER NULL,
  ADD COLUMN IF NOT EXISTS regulation_away_goals  INTEGER NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at         TIMESTAMPTZ NULL;

-- Extend user_expected_results
ALTER TABLE public.user_expected_results
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

-- New table: prediction_scores
CREATE TABLE IF NOT EXISTS public.prediction_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id    UUID NOT NULL REFERENCES public.user_expected_results(id) ON DELETE CASCADE,
  quiniela_id      UUID NOT NULL REFERENCES public.quinielas(id)             ON DELETE CASCADE,
  home_goal_point  SMALLINT NOT NULL DEFAULT 0 CHECK (home_goal_point  BETWEEN 0 AND 1),
  away_goal_point  SMALLINT NOT NULL DEFAULT 0 CHECK (away_goal_point  BETWEEN 0 AND 1),
  outcome_point    SMALLINT NOT NULL DEFAULT 0 CHECK (outcome_point    BETWEEN 0 AND 1),
  total_points     SMALLINT NOT NULL DEFAULT 0 CHECK (total_points     BETWEEN 0 AND 3),
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prediction_scores_unique UNIQUE (prediction_id, quiniela_id)
);

CREATE INDEX IF NOT EXISTS prediction_scores_quiniela_idx   ON public.prediction_scores(quiniela_id);
CREATE INDEX IF NOT EXISTS prediction_scores_prediction_idx ON public.prediction_scores(prediction_id);

ALTER TABLE public.prediction_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prediction_scores_service_role"
  ON public.prediction_scores AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
