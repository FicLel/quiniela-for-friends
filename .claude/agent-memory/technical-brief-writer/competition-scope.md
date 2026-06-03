---
name: competition-scope
description: There is ONE global matches table for all quinielas; no competition_id on quinielas; team/player lookups are always global.
metadata:
  type: project
---

There is a single global `public.matches` table for all quinielas. The matches table stores the 2026 World Cup. There is no `competition_id` column on `public.quinielas` and no per-quiniela competition scoping.

**Why:** The product was built around a single World Cup event. Quiniela-scoping of competition data was never implemented.

**How to apply:** When the story says "teams from the quiniela's linked competition", it means all teams from the global matches table. Methods like `findDistinctTeamsByQuiniela(quinielaId)` proposed in mapper findings would be misleading — use `findDistinctTeams()` instead, returning all distinct `{ name, externalId }` pairs from the matches table.

See also: [[migration-naming]], [[repository-patterns]]
