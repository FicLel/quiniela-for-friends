CREATE TABLE IF NOT EXISTS public.user_expected_results (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id    UUID        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score  INTEGER     NOT NULL CHECK (home_score >= 0),
  away_score  INTEGER     NOT NULL CHECK (away_score >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_expected_results_unique UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS user_expected_results_user_id_idx ON public.user_expected_results(user_id);
CREATE INDEX IF NOT EXISTS user_expected_results_match_id_idx ON public.user_expected_results(match_id);

-- set_updated_at trigger function already exists in the project
CREATE TRIGGER set_user_expected_results_updated_at
  BEFORE UPDATE ON public.user_expected_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_expected_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_expected_results_service_role"
  ON public.user_expected_results
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
