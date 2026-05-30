---
name: project-shortcode-approval-gate
description: short_code on invitations, approved_at on memberships, admin user list, approveMember service method, acceptInviteByShortCode service method, dashboard actions
metadata:
  type: project
---

Feature added 2026-05-30. Migration `20260531000000_short_code_and_approved_at.sql` adds:
- `short_code TEXT UNIQUE NOT NULL` to `quiniela_invitations` (8-char hex, indexed)
- `approved_at TIMESTAMPTZ NULL` to `quiniela_memberships` (NULL = pending, non-null = approved, indexed on NULL)

Key architectural decisions:
- `InvitationsService.sendInvite` generates `shortCode = randomBytes(4).toString('hex')` separately from the raw token; retries up to 5 times on unique constraint collision. Invite URL uses shortCode, not rawToken.
- `InvitationsService.acceptInviteByShortCode` mirrors `acceptInvite` but uses `findByShortCode` instead of `findByTokenHash`. Added to both `IInvitationsService` interface and `InvitationsService` implementation.
- `MembershipsService.approveMember(callerUserId, membershipId)`: verifies membership exists first, then checks caller is admin in same quiniela, then calls `repository.approve()`. Returns `{ ok: true/false }` union (different from the `{ success }` pattern used in other service methods — matches brief spec).
- `UsersRepository.listAll`: two-phase query — first filter user_ids via memberships table (when status/quinielaId filter present), then query users table with search/sort/pagination, then fetch all memberships for matched users. Returns full memberships array per user regardless of filter.
- `UsersRepository.findByIdWithMemberships`: single-user lookup with full memberships.
- `UsersService.listAllUsers`: only 'admin' callerRole is authorized; pageSize is always 20.
- Dashboard actions in `app/[lang]/(private)/dashboard/actions.ts`: listUsers, approveMember, getUserDetail.
- New invite route `app/[lang]/(public)/invite/[shortCode]/actions.ts` with `acceptInviteAsNewUser` returning `pendingApproval: true` in the result (no redirect). Old `[token]` route left intact for backward compat — frontend agent handles migration.

**Why:** Approval gate prevents unauthorized access to quinielas; shortCode removes raw token from URL for security.

**How to apply:** When adding new invite or membership features, check that `approved_at` semantics are respected (NULL = pending). New users joining via invite start with approved_at=NULL.
