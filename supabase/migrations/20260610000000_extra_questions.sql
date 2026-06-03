-- Migration: 20260610000000_extra_questions
-- Purpose  : Add four tables to support the "Extra Points Questions" feature:
--            extra_questions, extra_question_answers, extra_question_results,
--            and extra_question_audit_log.

-- ---------------------------------------------------------------------------
-- 1. extra_questions — questions created by quiniela admins
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.extra_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiniela_id     UUID        NOT NULL REFERENCES public.quinielas(id) ON DELETE CASCADE,
  question_text   TEXT        NOT NULL CHECK (char_length(question_text) BETWEEN 1 AND 500),
  question_type   TEXT        NOT NULL CHECK (question_type IN ('team', 'player')),
  status          TEXT        NOT NULL DEFAULT 'unresolved'
                              CHECK (status IN ('unresolved', 'resolved')),
  correct_answer  TEXT        NULL,
  created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS extra_questions_quiniela_id_idx
  ON public.extra_questions(quiniela_id);

CREATE INDEX IF NOT EXISTS extra_questions_quiniela_id_status_idx
  ON public.extra_questions(quiniela_id, status);

DROP TRIGGER IF EXISTS set_extra_questions_updated_at ON public.extra_questions;
CREATE TRIGGER set_extra_questions_updated_at
  BEFORE UPDATE ON public.extra_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.extra_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extra_questions_service_role"
  ON public.extra_questions AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. extra_question_answers — one answer per member per question
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.extra_question_answers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID        NOT NULL REFERENCES public.extra_questions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answer_text   TEXT        NOT NULL CHECK (char_length(answer_text) BETWEEN 1 AND 200),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT extra_question_answers_unique UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS extra_question_answers_question_id_idx
  ON public.extra_question_answers(question_id);

CREATE INDEX IF NOT EXISTS extra_question_answers_user_id_idx
  ON public.extra_question_answers(user_id);

DROP TRIGGER IF EXISTS set_extra_question_answers_updated_at ON public.extra_question_answers;
CREATE TRIGGER set_extra_question_answers_updated_at
  BEFORE UPDATE ON public.extra_question_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.extra_question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extra_question_answers_service_role"
  ON public.extra_question_answers AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. extra_question_results — scored results after admin resolves a question
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.extra_question_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID        NOT NULL REFERENCES public.extra_questions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiniela_id   UUID        NOT NULL REFERENCES public.quinielas(id) ON DELETE CASCADE,
  points        SMALLINT    NOT NULL DEFAULT 0 CHECK (points IN (0, 1)),
  scored_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT extra_question_results_unique UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS extra_question_results_quiniela_id_idx
  ON public.extra_question_results(quiniela_id);

CREATE INDEX IF NOT EXISTS extra_question_results_question_id_idx
  ON public.extra_question_results(question_id);

CREATE INDEX IF NOT EXISTS extra_question_results_user_id_idx
  ON public.extra_question_results(user_id);

ALTER TABLE public.extra_question_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extra_question_results_service_role"
  ON public.extra_question_results AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. extra_question_audit_log — audit trail of all resolve / re-resolve actions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.extra_question_audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       UUID        NOT NULL REFERENCES public.extra_questions(id) ON DELETE CASCADE,
  quiniela_id       UUID        NOT NULL REFERENCES public.quinielas(id) ON DELETE CASCADE,
  changed_by        UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  previous_answer   TEXT        NULL,
  new_answer        TEXT        NOT NULL,
  members_rescored  INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS extra_question_audit_log_question_id_idx
  ON public.extra_question_audit_log(question_id);

CREATE INDEX IF NOT EXISTS extra_question_audit_log_quiniela_id_idx
  ON public.extra_question_audit_log(quiniela_id);

ALTER TABLE public.extra_question_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extra_question_audit_log_service_role"
  ON public.extra_question_audit_log AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
