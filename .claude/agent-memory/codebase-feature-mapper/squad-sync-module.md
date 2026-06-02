---
name: squad-sync-module
description: Mapping for World Cup Squad Sync Module feature - API client patterns, repository/service patterns, existing infrastructure
metadata:
  type: reference
---

## Feature: World Cup Squad Sync Module

Feature goal: fetch team squads from football-data.org v4 API, persist to Supabase, track sync runs, throttle at 1 req/6s.

## Existing Infrastructure to Leverage

### 1. External API Client Pattern
- **File**: `competitions/CompetitionsClient.ts`
- **Pattern**: 
  - Static `requireEnv()` helper for env var validation
  - Typed RawApiResponse, RawTeam shapes
  - Fetch with `X-Auth-Token` header from `FOOTBALL_DATA_ORG_API_KEY`
  - Error handling: network errors + non-2xx responses wrapped in typed Error
  - Returns DTO types (camelCase): `MatchImportRecord[]`
  - No direct Supabase imports; client is pure external API adapter

### 2. Repository Pattern
- **Files**: `competitions/CompetitionsRepository.ts`, `users/UsersRepository.ts`
- **Pattern**:
  - Constructor: validate NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  - Lazy `verifySchema()`: schema check cached in Promise; called before each method
  - Supabase JS client: createClient(url, key)
  - snake_case ↔ camelCase mapping at boundary (private methods: `toXyz()`, `toDbRow()`)
  - Methods: `upsert()`, `findAll()`, `findById()`, `update()`
  - Error wrapping: throw with descriptive messages

### 3. Service Pattern
- **Files**: `competitions/CompetitionsService.ts`, `users/UsersService.ts`
- **Pattern**:
  - Constructor: inject `IRepository` + optional `IOtherService`
  - Business logic only; no imports from @supabase, fetch, next/*
  - All I/O through injected dependencies
  - Result types: discriminated unions `{ success: true, data } | { success: false, error }`
  - Error handling: catch + return error variants, never throw

### 4. Type/Interface Pattern
- **File**: `competitions/competitions.types.ts`
- **Pattern**:
  - Domain types (Match, User) — mapped from DB, camelCase
  - DTO types (MatchImportRecord, etc.) — for API/DB transfer, mirrors columns
  - Port interfaces (ICompetitionsClient, ICompetitionsRepository, ICompetitionsService)
  - Result discriminated unions with specific error codes

### 5. Test Pattern
- **Files**: `competitions/__tests__/CompetitionsClient.test.ts`, `CompetitionsService.test.ts`, etc.
- **Framework**: Jest (ts-jest preset)
- **Pattern**:
  - Mock fixtures at top (raw API shapes)
  - Global.fetch mocked with jest.fn()
  - Supabase client mocked via jest.mock() + custom return builders
  - Test structure: Fixtures → Setup → Test cases

## Database Patterns

### Migrations
- **Location**: `supabase/migrations/`
- **Format**: Numbered SQL files: `2026MMDD000000_description.sql`
- **Patterns**:
  - CREATE TABLE IF NOT EXISTS
  - TIMESTAMPTZ columns with DEFAULT NOW()
  - Indices for frequently filtered columns
  - Triggers: set_updated_at on UPDATE
  - RLS: ALTER TABLE ENABLE ROW LEVEL SECURITY + grant service_role policy
  - Foreign keys: ON DELETE CASCADE
  - UNIQUE constraints for upsert keying

### Existing Tables Used by Competitions
- **matches**: external_id (UNIQUE), stage, group, matchday, status, scheduled_at, team data, bracket_slot, regulation_home_goals, regulation_away_goals, last_synced_at
- **quinielas**: id, name, created_at
- **quiniela_memberships**: quiniela_id, user_id, role, approved_at

## Next.js Route Handler Pattern

- **File**: `app/api/admin/matches/sync/route.ts`
- **Pattern**:
  - POST handler exports async function POST(request: Request): Promise<Response>
  - Auth check: instantiate AuthClient, call getTokenFromServerAction(), verifyToken(), check session.role
  - Parse body: await request.json(), wrap in try/catch
  - Validation: separate validatePayload() helper that returns null on failure
  - Service instantiation: new RepoClass(), inject into ServiceClass
  - Response: Response.json(result, { status: ... })

## Module Organization for Squad Sync

Based on patterns, squad sync should go into a new `squads/` module:

```
/squads
  SquadsClient.ts       – fetches squad data from football-data.org
  SquadsRepository.ts   – persists to squads, squad_players, sync_runs, sync_run_items
  SquadsService.ts      – orchestrates sync, throttling, idempotency
  squads.types.ts       – Team, Player, Squad, SyncRun, SyncRunItem, DTOs, interfaces
  squads.schemas.ts     – Zod validation (optional)
  __tests__/
    SquadsClient.test.ts
    SquadsRepository.test.ts
    SquadsService.test.ts
```

## Dependencies to Install

- [ ] None anticipated beyond existing packages
- Supabase JS client already installed
- Jest already configured

## Environment Variables

- `FOOTBALL_DATA_ORG_API_KEY` – already defined (used by CompetitionsClient)
- No new env vars needed

## Database Migrations Needed

New tables required:
- `squads` – id, team_id (FK to some team table or external_id), external_id, lastSyncedAt
- `squad_players` – id, squad_id, player_name, position, external_id
- `sync_runs` – id, startedAt, completedAt, status, error_message
- `sync_run_items` – id, sync_run_id, team_id, status, error_message

## Throttling Implementation

- No existing throttling library in deps
- Implement inline: track last request time, sleep(6000) if < 6s elapsed
- Pattern: async function with Promise-based delay

## Next Steps

1. Create new `squads/` module folder
2. Write squads.types.ts with all domain and DTO types
3. Implement SquadsClient (fetch logic + throttle gate)
4. Implement SquadsRepository (insert/update/upsert + sync_runs tracking)
5. Implement SquadsService (orchestrate, idempotency)
6. Write migrations for new tables
7. Write tests following CompetitionsClient pattern
8. Create API route handler (optional; could be scheduled job)
