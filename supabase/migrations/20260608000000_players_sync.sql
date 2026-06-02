-- ---------------------------------------------------------------------------
-- Migration: 20260608000000_players_sync
-- Purpose  : Add players, sync_runs, and sync_run_items tables for the
--            World Cup player sync feature. Also adds a helper RPC for
--            retrieving distinct team external IDs from the matches table.
-- ---------------------------------------------------------------------------

-- players table
CREATE TABLE IF NOT EXISTS public.players (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_player_id   INTEGER     NOT NULL UNIQUE,
  team_external_id     INTEGER     NOT NULL,
  name                 TEXT        NOT NULL,
  position             TEXT        NULL,
  shirt_number         INTEGER     NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS players_team_external_id_idx ON public.players(team_external_id);

DROP TRIGGER IF EXISTS set_players_updated_at ON public.players;
CREATE TRIGGER set_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_service_role"
  ON public.players AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- sync_runs table
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status       TEXT        NOT NULL DEFAULT 'in_progress'
                           CHECK (status IN ('in_progress', 'completed', 'failed')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ NULL
);

-- Partial unique index: at most one in_progress run at a time
CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_one_in_progress
  ON public.sync_runs(status) WHERE (status = 'in_progress');

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_runs_service_role"
  ON public.sync_runs AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- sync_run_items table
CREATE TABLE IF NOT EXISTS public.sync_run_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id       UUID        NOT NULL REFERENCES public.sync_runs(id) ON DELETE CASCADE,
  team_external_id  INTEGER     NOT NULL,
  status            TEXT        NOT NULL CHECK (status IN ('success', 'error')),
  players_upserted  INTEGER     NULL,
  error_message     TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_run_items_sync_run_id_idx ON public.sync_run_items(sync_run_id);

ALTER TABLE public.sync_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_run_items_service_role"
  ON public.sync_run_items AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Helper function: returns all distinct team external IDs from the matches table
CREATE OR REPLACE FUNCTION public.get_distinct_team_external_ids()
RETURNS TABLE(team_external_id INTEGER)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT home_team_external_id AS team_external_id
    FROM public.matches WHERE home_team_external_id IS NOT NULL
  UNION
  SELECT DISTINCT away_team_external_id
    FROM public.matches WHERE away_team_external_id IS NOT NULL
  ORDER BY team_external_id;
$$;
