---
name: project-users-dashboard-approval-patterns
description: Recurring patterns from Users Dashboard + Approval Gate validation: wrong ID passed to approveAction, missing membershipId on UserWithMemberships, repository bypass in actions, stale [token] route, missing MembersClient approve tests
metadata:
  type: project
---

# Users Dashboard & Approval Gate Patterns

## Critical recurring pattern: quinielaId passed instead of membershipId

In `UserDetailPanel.tsx`, `handleApprove` passes `membership.quinielaId` to `approveAction(membershipId)`. This is because `UserWithMemberships.memberships` does not include a `membershipId` field — only `quinielaId, quinielaName, role, approvedAt`. The test in `UsersClient.test.tsx` was written to match the broken implementation (asserting `'q-1'` quinielaId), masking the bug.

**Why:** `UserWithMemberships` type in `users.types.ts` was defined without `membershipId` on the inner memberships array, but `approveMember` in the service requires a membership UUID.

**How to apply:** Always check that the type used in a panel/modal component includes all the IDs needed by downstream actions. Verify test assertions match the correct semantic (membershipId vs quinielaId).

## Repository directly called in server action (architecture violation)

`getUserDetail` in `app/[lang]/(private)/dashboard/actions.ts` (L77) calls `usersRepo.findByIdWithMemberships()` directly instead of going through a service. This pattern has appeared in previous validations too.

**Why:** Developers often skip the service layer for "read-only" fetches, treating repositories as safe to call directly from actions.

**How to apply:** Flag any server action that instantiates and calls a `*Repository` method directly without going through a service.

## Old [token] route not cleaned up

After adding `[shortCode]` route, the old `[token]` route at `app/[lang]/(public)/invite/[token]/` was left in place. Both routes coexist. The [token] route also lacks `pendingApprovalDict` prop and pending state handling.

**How to apply:** Always verify route cleanup when a rename/replacement is done.

## MembersClient.test.tsx missing Approve button tests

Despite the Approve button being a new AC in the brief, `MembersClient.test.tsx` has zero tests for approve scenarios. Pattern: when a new action is added to an existing component, tests for the new action are often missing.

## Double DB read in acceptInviteAsExistingUser

`app/[lang]/(public)/invite/[shortCode]/actions.ts` calls `invitationsRepo.findByShortCode(shortCode)` at L45, then calls `service.acceptInviteByShortCode()` which internally calls `findByShortCode` again. Same double-read pattern seen in auth proxy DB reads.

## ok vs success discriminant inconsistency

`ApproveMemberResult` uses `{ ok: true }` / `{ ok: false }` while all other result types in memberships/invitations use `{ success: true }` / `{ success: false }`. Similarly `UserListResult` uses `ok`. This inconsistency is present throughout the codebase and should be noted in each validation run.
