-- Knockout placeholder support for 2026 FIFA World Cup.
-- The World Cup expands to 48 teams; a new Round of 32 precedes the traditional
-- Round of 16. Placeholder matches are seeded before group stage ends so users
-- can pre-fill predictions against bracket slots (e.g., "Group A Winner vs Group B Runner-up").
-- Team names are updated to real values once the API returns them after June 27.

-- external_id is NULL for placeholders (no API ID assigned yet)
ALTER TABLE public.matches ALTER COLUMN external_id DROP NOT NULL;

-- team external IDs are also NULL until a real match is assigned
ALTER TABLE public.matches ALTER COLUMN home_team_external_id DROP NOT NULL;
ALTER TABLE public.matches ALTER COLUMN away_team_external_id DROP NOT NULL;

-- Stable position in the knockout bracket (e.g., 'R32_01', 'R16_03', 'FINAL_01').
-- Used as the upsert key for placeholder seeding and later team-name updates.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bracket_slot TEXT UNIQUE NULL;

-- Human-readable matchup description (e.g., "Group A Winner vs Group B Runner-up").
-- Displayed on the card when team names are still TBD.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS matchup_description TEXT NULL;

-- Index for bracket_slot lookups (used by updateKnockoutTeams)
CREATE INDEX IF NOT EXISTS matches_bracket_slot_idx ON public.matches(bracket_slot);
