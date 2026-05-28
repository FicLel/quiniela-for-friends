-- World Cup match data is global (no tenant/league scoping).
-- A `league_id` FK will be needed when per-league quiniela pools are introduced.

CREATE TABLE IF NOT EXISTS public.matches (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id             INTEGER     NOT NULL UNIQUE,
  stage                   TEXT        NOT NULL,
  "group"                 TEXT        NOT NULL,
  matchday                INTEGER     NOT NULL,
  status                  TEXT        NOT NULL,
  scheduled_at            TIMESTAMPTZ NOT NULL,
  home_team_external_id   INTEGER     NOT NULL,
  home_team_name          TEXT        NOT NULL,
  home_team_short_name    TEXT        NOT NULL,
  home_team_tla           TEXT        NOT NULL,
  home_team_crest         TEXT        NULL,
  away_team_external_id   INTEGER     NOT NULL,
  away_team_name          TEXT        NOT NULL,
  away_team_short_name    TEXT        NOT NULL,
  away_team_tla           TEXT        NOT NULL,
  away_team_crest         TEXT        NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for group-based filtering (used by findAllGroupStageMatches)
CREATE INDEX IF NOT EXISTS matches_group_idx ON public.matches("group");

-- Auto-update updated_at on every row modification
DROP TRIGGER IF EXISTS set_matches_updated_at ON public.matches;
CREATE TRIGGER set_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS (no policies — all access goes through the service-role key)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
