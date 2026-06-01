---
name: project-competitions-module
description: Competitions module — World Cup match import, types, knockout placeholders, and DB schema
metadata:
  type: project
---

The `competitions/` module handles World Cup schedule import, query, and knockout bracket seeding.

- `competitions.types.ts` — `Match`, `MatchImportRecord` (IDs now nullable), `KnockoutPlaceholderRecord`, `ICompetitionsClient`, `ICompetitionsRepository`, `ICompetitionsService`, `ImportMatchesResult`, `SeedPlaceholdersResult`
- `CompetitionsClient.ts` — fetches from `football-data.org v4` `/WC/matches?season=2026`, reads `FOOTBALL_DATA_ORG_API_KEY`. `fetchGroupStageMatches()` filters `GROUP_STAGE`; `fetchAllKnockoutMatches()` filters 6 knockout stages (ROUND_OF_32 through FINAL)
- `CompetitionsService.ts` — `importGroupStageMatches()`, `getAllMatches()`, `seedKnockoutPlaceholders()`, `syncKnockoutMatches()`. Contains `KNOCKOUT_PLACEHOLDER_DATA` const (32 records: 16 R32 + 8 R16 + 4 QF + 2 SF + 1 3P + 1 F)
- `CompetitionsRepository.ts` — Supabase upsert on `external_id` conflict; upsert on `bracket_slot` conflict for placeholders; `updateKnockoutTeams()` uses `.update().eq('stage').eq('matchday').not('bracket_slot','is',null)` per record
- `supabase/migrations/20260528000000_matches.sql` — `public.matches` table with `"group"` (quoted reserved word), RLS enabled
- `supabase/migrations/20260601000000_knockout_placeholders.sql` — makes external_id and team external IDs nullable; adds `bracket_slot TEXT UNIQUE NULL` and `matchup_description TEXT NULL`
- `app/[lang]/(private)/welcome/actions.ts` — `importWorldCupMatches()`, `saveExpectedResult()`, `seedKnockoutPlaceholders()` (admin-only), `syncKnockoutMatches()` (admin-only)
- `Match.stage` is a plain `string` — no stage enum/union type, stores raw API values
- `externalId`, `homeTeamExternalId`, `awayTeamExternalId` are `number | null` on both `Match` and `MatchImportRecord` (nullable for placeholder rows)
- `Match` has `bracketSlot: string | null` and `matchupDescription: string | null`

**Why:** Knockout placeholders needed because the 2026 WC expands to 48 teams with a new Round of 32; users can predict before teams are determined.

**How to apply:** `KNOCKOUT_PLACEHOLDER_DATA` = 32 records total (not 42 — the brief count was wrong). Update tests accordingly.

**Test mock pattern:** `CompetitionsRepository.test.ts` uses a module-level `useFindAllChain` boolean to route `mockSelect('*')`. The `mockFrom` router exposes `select`, `upsert`, and `update`. The `update` chain: `.update() → .eq('stage') → .eq('matchday') → .not('bracket_slot','is',null)`. Mock terminator: `mockUpdateNot`.

**CompetitionsService.test.ts mock pattern:** `makeRepository()` helper must include ALL methods of `ICompetitionsRepository`. `makeClient()` helper must include ALL methods of `ICompetitionsClient`. Update both whenever a new method is added to those interfaces.

**Admin auth pattern in server actions:** `app/[lang]/(private)/welcome/actions.ts` uses a local `getSession()` helper that calls `AuthClient.getTokenFromServerAction()` then `verifyToken()`. Check `session?.role !== 'admin'` before proceeding for admin-only actions.
