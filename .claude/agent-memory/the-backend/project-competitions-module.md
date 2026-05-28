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
- `CompetitionsRepository.ts` — Supabase upsert on `external_id` conflict; `findAllGroupStageMatches()` ordered group → matchday → scheduled_at
- `supabase/migrations/20260528000000_matches.sql` — `public.matches` table with `"group"` (quoted reserved word), RLS enabled, no policies, reuses `set_updated_at()` trigger
- `app/(private)/welcome/actions.ts` — `importWorldCupMatches()` Server Action (wires up all three classes)

**Why:** `group` is a reserved word in SQL — it must be double-quoted in the DDL (`"group" TEXT NOT NULL`).

**How to apply:** Always quote `group` column references in raw SQL migrations.
