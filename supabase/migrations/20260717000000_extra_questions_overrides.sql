-- Migration: 20260717000000_extra_questions_overrides
-- Purpose  : Extend the "Extra Points Questions" feature with per-user answer
--            review/override (with audit logging), an optional answer
--            deadline per question, and a configurable points value per
--            question. Additive only — does not touch 20260610000000.

-- ---------------------------------------------------------------------------
-- extra_questions: configurable points + optional deadline
-- ---------------------------------------------------------------------------

ALTER TABLE public.extra_questions
  ADD COLUMN IF NOT EXISTS points_value SMALLINT NOT NULL DEFAULT 1 CHECK (points_value > 0),
  ADD COLUMN IF NOT EXISTS answer_deadline TIMESTAMPTZ NULL;

-- ---------------------------------------------------------------------------
-- extra_question_results: widen points, add explicit correctness + override tracking
-- ---------------------------------------------------------------------------

ALTER TABLE public.extra_question_results
  DROP CONSTRAINT IF EXISTS extra_question_results_points_check;

ALTER TABLE public.extra_question_results
  ADD COLUMN IF NOT EXISTS is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overridden_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ NULL;

ALTER TABLE public.extra_question_results
  ADD CONSTRAINT extra_question_results_points_nonneg CHECK (points >= 0);

-- ---------------------------------------------------------------------------
-- extra_question_audit_log: distinguish whole-question resolves from per-user overrides
-- ---------------------------------------------------------------------------

ALTER TABLE public.extra_question_audit_log
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'resolve'
    CHECK (entry_type IN ('resolve', 'override')),
  ADD COLUMN IF NOT EXISTS target_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_points SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS new_points SMALLINT NULL;

ALTER TABLE public.extra_question_audit_log
  ALTER COLUMN new_answer DROP NOT NULL;

CREATE INDEX IF NOT EXISTS extra_question_audit_log_target_user_id_idx
  ON public.extra_question_audit_log(target_user_id);
