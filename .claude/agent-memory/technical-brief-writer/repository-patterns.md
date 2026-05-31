---
name: repository-patterns
description: Repository implementation patterns used across all modules — Supabase client, verifySchema, toX mapper, snake_case↔camelCase
metadata:
  type: project
---

All repositories follow the same pattern (see CompetitionsRepository, MembershipsRepository, UsersRepository):

1. Constructor validates NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars; creates a `createClient()` instance.
2. `private schemaCheck: Promise<void> | null = null` — lazy verifySchema() checks table exists once per instance via `.select('id').limit(0)`.
3. Private `toX(row: Record<string, unknown>): DomainType` mapper converts snake_case DB columns to camelCase domain fields.
4. All date columns stored as TIMESTAMPTZ; mapped with `new Date(row.col as string)`.
5. Upserts use `{ onConflict: 'conflict_column', ignoreDuplicates: false }`.
6. Service-role key bypasses RLS — all tables have RLS enabled but a permissive service_role policy.

Migration file naming: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
Next migration number to use: 20260602000000 or higher.

**Why:** Consistent pattern across all 5 existing repositories.
**How to apply:** New repositories must follow this exact pattern. No TypeORM entities — all modules use Supabase JS client directly.
