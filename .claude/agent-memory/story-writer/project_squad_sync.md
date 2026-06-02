---
name: project-squad-sync
description: World Cup player sync module story, v2 revised 2026-06-02; players-only, no competitions table, teams already exist, admin button trigger, idempotent upsert, throttled, 3 new tables
metadata:
  type: project
---

World Cup Player Sync story revised to v2 on 2026-06-02. Product owner stripped competitions, squads, and nationality from scope. Sync now writes only to `players`, `sync_runs`, and `sync_run_items`. The `teams` table already exists and must never be touched by this sync.

Key decisions locked in v2:
- No `competitions` table, no `competition_teams` join — app is WC-only.
- Teams are looked up by `provider_team_id`; if no match, the team is skipped and recorded.
- `players` table has exactly 4 meaningful columns: `name`, `shirt_number`, `position`, `team_id`.
- Nationality omitted — implicit from team in a WC context.
- Sync triggered by a button in the main quiniela admin view → `POST /api/admin/players/sync`.
- Absent players are NOT deactivated in this story (deactivation explicitly out of scope).
- Rate limit: 6 s between team-detail requests (10 req/min cap).

**Why:** Product owner wants the smallest viable player dataset that supports roster-aware features. Multi-competition complexity is deferred indefinitely.

**How to apply:** When technical brief or implementation lands, confirm the `teams` table is never written to and that `players` upsert key is `provider_player_id`. Deactivation/soft-delete is a follow-on story — do not conflate with this one.

[[project-scoring-feature]]
