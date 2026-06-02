---
name: fix-existing-tests-when-mocks-break
description: When a repository implementation changes (e.g., upsert→insert/update), fix the existing test mocks in the same PR — don't leave them broken
metadata:
  type: feedback
---

When a repository method's Supabase call chain changes (e.g., replacing `.upsert()` with `.insert()`/`.update()`), the unit test mocks must be updated in the same changeset to reflect the new chain. Leaving old mocks pointing to removed methods causes `TypeError: this.supabase.from(...).insert is not a function`.

**Why:** The C2 fix replaced PostgREST `.upsert()` with explicit `SELECT then INSERT/UPDATE`, which broke 6 existing ExpectedResultsRepository tests because the mock only exposed `.upsert` but not `.insert`/`.update`.

**How to apply:** Whenever a repository method changes its Supabase chain, always read the existing test file before making repository changes, then update the mock chain in the same edit pass.
