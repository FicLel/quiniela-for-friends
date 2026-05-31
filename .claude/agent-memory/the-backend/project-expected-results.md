---
name: project-expected-results
description: User match score predictions module — expectedResults/ module, countByUser on memberships, saveExpectedResult action, prediction cleanup on member removal
metadata:
  type: project
---

Implemented the full backend for user expected results (match score predictions).

**Why:** Players need to enter their predicted scores for each World Cup match; scores are gated behind approval.

**Key architectural decisions:**
- `isUserApproved` is implemented by calling `membershipsRepository.countByUser(userId)` — counts rows with `approved_at IS NOT NULL`. Returns true if count > 0.
- `countByUser` added to `IMembershipsRepository` interface and `MembershipsRepository`: counts approved memberships for a user via `.not('approved_at', 'is', null)`.
- `ExpectedResultsService` constructor takes `(IExpectedResultsRepository, IMembershipsRepository)` — cross-module dependency via interfaces.
- Score validation: `Number.isInteger(score) && score >= 0` for both homeScore and awayScore. Checked after approval gate.
- `upsertExpectedResult` wraps the entire body in try/catch → `UNKNOWN_ERROR` if any step throws unexpectedly (including isUserApproved throwing).
- `saveExpectedResult` server action: unauthenticated session returns `NOT_APPROVED` (conservative choice — not a 401, just blocks the operation).
- Prediction cleanup: `removeMember` action looks up membership BEFORE removal (to capture userId), then after success calls `countByUser` and deletes predictions if count === 0.
- `acceptInviteAsExistingUser` now redirects to `/{lang}/welcome` (changed from `/{lang}/quinielas/{quinielaId}`).
- Migration: `supabase/migrations/20260602000000_user_expected_results.sql` — table with UNIQUE(user_id, match_id), `set_updated_at` trigger, RLS enabled with service_role policy.
- MCP was in read-only mode — migration must be applied via `supabase db push` or manual deploy.

**Key files:**
- `expectedResults/expectedResults.types.ts` — ExpectedResult, UpsertExpectedResultInput, SaveExpectedResultResult, IExpectedResultsRepository, IExpectedResultsService
- `expectedResults/ExpectedResultsRepository.ts` — upsert (onConflict: 'user_id,match_id'), findByUserId, deleteByUserId
- `expectedResults/ExpectedResultsService.ts` — isUserApproved, getExpectedResultsForUser, upsertExpectedResult
- `expectedResults/__tests__/ExpectedResultsService.test.ts` — 11 unit tests
- `memberships/memberships.types.ts` — added countByUser to IMembershipsRepository
- `memberships/MembershipsRepository.ts` — implemented countByUser
- `app/[lang]/(private)/welcome/actions.ts` — added saveExpectedResult
- `app/[lang]/(public)/invite/[shortCode]/actions.ts` — redirect changed to /{lang}/welcome
- `app/[lang]/(private)/quinielas/[quinielaId]/members/actions.ts` — removeMember extended with prediction cleanup via ExpectedResultsService.deleteExpectedResultsForUser; leaveQuiniela similarly extended; direct ExpectedResultsRepository calls replaced with service calls (I1 fix)
- `expectedResults/__tests__/ExpectedResultsRepository.test.ts` — 21 unit tests covering upsert (insert + idempotent update), findByUserId (found/empty/null), deleteByUserId (delete/no-op/error), verifySchema, and constructor validation

**Validator fixes applied (2026-05-30):**
- C2: leaveQuiniela now cascades deletes expected results when user has no remaining memberships, using same pattern as removeMember.
- I1: actions file no longer calls ExpectedResultsRepository methods directly; uses ExpectedResultsService.deleteExpectedResultsForUser instead.
- I2: ExpectedResultsRepository.test.ts created with full coverage of all 4 methods.
- IExpectedResultsService gained deleteExpectedResultsForUser(userId: string): Promise<void>.

[[project-quinielas-memberships-invitations]]
[[project-shortcode-approval-gate]]
