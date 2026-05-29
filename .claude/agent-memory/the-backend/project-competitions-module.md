---
name: project-competitions-module
description: Competitions module — World Cup match import, types, and DB schema introduced in 2026-05-28 feature
metadata:
  type: project
---

The `competitions/` module was added to implement World Cup group-stage schedule import and query.

- `competitions.types.ts` — `Match`, `MatchImportRecord`, `ICompetitionsClient`, `ICompetitionsRepository`, `ICompetitionsService`, `ImportMatchesResult`
- `CompetitionsClient.ts` — fetches from `football-data.org v4` `/WC/matches?season=2026`, filters `GROUP_STAGE`, reads `FOOTBALL_DATA_ORG_API_KEY`
- `CompetitionsService.ts` — `importGroupStageMatches()` with FETCH_FAILED / DB_ERROR / UNKNOWN_ERROR discriminated union
- `CompetitionsRepository.ts` — Supabase upsert on `external_id` conflict; `findAllGroupStageMatches()` ordered group → matchday → scheduled_at; `findAllMatches()` ordered by scheduled_at only (all stages)
- `supabase/migrations/20260528000000_matches.sql` — `public.matches` table with `"group"` (quoted reserved word), RLS enabled, no policies, reuses `set_updated_at()` trigger
- `app/(private)/welcome/actions.ts` — `importWorldCupMatches()` Server Action (wires up all three classes)
- `Match.stage` is a plain `string` — no stage enum/union type, stores raw API values (e.g. `GROUP_STAGE`, `ROUND_OF_16`)
- i18n `welcome` section has view-toggle keys: `viewByDate`, `viewByGroup`, `knockoutRoundOf16`, `knockoutQuarterFinals`, `knockoutSemiFinals`, `knockoutFinal`

**Why:** `group` is a reserved word in SQL — it must be double-quoted in the DDL (`"group" TEXT NOT NULL`).

**How to apply:** Always quote `group` column references in raw SQL migrations.

**Test mock pattern:** `CompetitionsRepository.test.ts` uses a module-level `useFindAllChain` boolean to route `mockSelect('*')` to either the 3-chain (`findAllGroupStageMatches`) or single-order chain (`findAllMatches`). Reset to `false` in `beforeEach`. Use `makeRepoForFindAllMatches()` for `findAllMatches` tests. When adding new repository read methods, add a new terminator mock and extend this routing pattern.

**CompetitionsService.test.ts mock pattern:** `makeRepository()` helper must include ALL methods of `ICompetitionsRepository` — update it whenever a new method is added to the interface, or typecheck will fail with "undefined is not assignable".
