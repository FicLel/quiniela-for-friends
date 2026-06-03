-- Migration: 20260611000000_fix_extra_questions_fk
-- Purpose  : Correct foreign key constraints on extra_questions tables.
--            The original migration mistakenly referenced auth.users(id).
--            This project uses a custom public.users table (no Supabase Auth).

ALTER TABLE public.extra_questions
  DROP CONSTRAINT extra_questions_created_by_fkey;
ALTER TABLE public.extra_questions
  ADD CONSTRAINT extra_questions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.extra_question_answers
  DROP CONSTRAINT extra_question_answers_user_id_fkey;
ALTER TABLE public.extra_question_answers
  ADD CONSTRAINT extra_question_answers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.extra_question_results
  DROP CONSTRAINT extra_question_results_user_id_fkey;
ALTER TABLE public.extra_question_results
  ADD CONSTRAINT extra_question_results_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.extra_question_audit_log
  DROP CONSTRAINT extra_question_audit_log_changed_by_fkey;
ALTER TABLE public.extra_question_audit_log
  ADD CONSTRAINT extra_question_audit_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE RESTRICT;
