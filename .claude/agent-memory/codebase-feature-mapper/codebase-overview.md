---
name: codebase-overview
description: Core project structure, module organization, and key patterns for the quiniela betting application
metadata:
  type: reference
---

## Stack & Architecture

- **Framework**: Next.js 16 App Router + React 19
- **Styling**: Tailwind CSS v4
- **Database**: Supabase Postgres (managed)
- **ORM**: Supabase JS client (not TypeORM; no entities defined in code)
- **Auth**: Supabase Auth via AuthClient wrapper
- **Pattern**: Hexagonal architecture (services → ports → repositories)

## Module Organization

Each domain module (at project root) contains:
- `*Service.ts` – business logic
- `*Repository.ts` – Supabase JS client adapter (snake_case ↔ camelCase mapping)
- `*.types.ts` – DTOs, port interfaces
- `*.schemas.ts` (optional) – validation

Key modules:
- `auth/` – Supabase Auth integration
- `competitions/` – World Cup match import + sync
- `expectedResults/` – user_expected_results predictions (home_score, away_score)
- `quinielas/` – pools/betting groups
- `memberships/` – pool membership + approvals (approved_at gating)
- `invitations/` – pool invites
- `users/` – user profiles

## Current Database Schema (Migrations)

### matches table (20260528000000)
- `id`, `external_id` (UNIQUE, nullable after 20260604)
- `stage`, `group`, `matchday`, `status`
- `scheduled_at`
- team data (external_id, name, shortName, tla, crest)
- `bracket_slot` (nullable, UNIQUE, for knockout placeholders)
- `matchup_description` (nullable, for TBD teams)
- **Missing**: `regulation_team_a_goals`, `regulation_team_b_goals`, `last_synced_at` (needed for scoring)

### user_expected_results table (20260602000000)
- `id`, `user_id`, `match_id` (UNIQUE pair)
- `home_score`, `away_score` (integers, 0+)
- `created_at`, `updated_at`
- **Missing**: `predicted_team_a_goals`, `predicted_team_b_goals`, `locked_at`, `submitted_at` (prediction metadata)
- **Missing**: scoring columns (prediction_score table needed separately)

### quiniela_memberships table (20260530000000)
- `id`, `quiniela_id`, `user_id`, `role` ('admin' | 'member')
- `joined_at`
- `approved_at` (added 20260531000000) – NULL = pending, non-null = approved

**No existing tables for**:
- PredictionScore / scoring history
- PoolLeaderboardEntry (materialized or derived)
- Match result sync tracking

## Views & Routes

Under `app/[lang]/(private)/`:
- `dashboard/` – user dashboard
- `quinielas/page.tsx` – pool list (admin-only)
- `quinielas/[quinielaId]/members/page.tsx` – pool member mgmt
- `welcome/page.tsx` – match predictions + card display (MatchCard component)

## Service Patterns

### Repository Interface Pattern
```typescript
export interface IXyzRepository {
  // Methods return domain types (camelCase)
}

export class XyzRepository implements IXyzRepository {
  // Uses Supabase JS client
  // Maps snake_case DB rows → camelCase domain types via toXyz()
}
```

### Service Interface Pattern
```typescript
export interface IXyzService {
  // Public methods with discriminated union results
}

export class XyzService implements IXyzService {
  constructor(
    private readonly repository: IXyzRepository,
    private readonly otherDeps: IOtherRepository
  ) {}
  
  // Business rules in service; I/O through repositories
}
```

## Key Conventions

1. **No TypeORM entities** – direct Supabase JS client
2. **snake_case DB, camelCase domain** – mapping at repository boundary
3. **Discriminated union results** – `{ success: true, data } | { success: false, error }`
4. **Service injection** – constructor-based, testable
5. **Port interfaces** – services depend on IXyzRepository, not concrete repos
6. **RLS policies** – all rows have service_role policy; direct app access via service role key

## Testing & Scenarios

- No test runner configured yet
- Tests written as pseudo-specs in comments
- Focus: service use cases + repository integration

