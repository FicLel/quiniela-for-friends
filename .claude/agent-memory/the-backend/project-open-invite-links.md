---
name: project-open-invite-links
description: Open multi-use invite links feature — email dropped from invitations, open invites reusable, isMember added to memberships
metadata:
  type: project
---

Implemented open invite links for quinielas (2026-05-30).

- `email` on `Invitation` is now `string | null`; null = open invite anyone can use
- `sendInvite` no longer takes an `email` param — always creates null-email row
- Before creating a new open invite, any existing active open invite is revoked (one active open invite per quiniela)
- `acceptInviteByShortCode` does NOT call `markAccepted` — open invite stays valid for repeat use
- Logged-in user acceptance: checks `isMember` first; returns `alreadyMember: true` if already joined, otherwise creates membership with `approved_at = NULL`
- New-user acceptance: if invite has non-null email and that email already exists → `EMAIL_ALREADY_EXISTS` (changed from `EMAIL_MISMATCH`)
- `AcceptInviteResult` success shape: `{ quinielaId, pendingApproval?: true, alreadyMember?: true, wasNewUser?: true }`
- `EMAIL_MISMATCH` removed from `AcceptInviteResult` error union; replaced by `EMAIL_ALREADY_EXISTS`
- `ALREADY_A_MEMBER` removed from `SendInviteResult` error union
- `isMember(quinielaId, userId): Promise<boolean>` added to `IMembershipsRepository` and `MembershipsRepository`
- `findActiveOpenByQuiniela(quinielaId): Promise<Invitation | null>` added to `IInvitationsRepository` and `InvitationsRepository`
- Migration file: `supabase/migrations/20260601000000_open_invite_links.sql` (must be applied manually — MCP is read-only)

**Why:** UX improvement — admins share a single link, no need to collect emails upfront.

**How to apply:** Frontend agent must update:
1. `members/page.tsx` — `inviteMemberAction` prop type (remove `email` param)
2. `invite/[shortCode]/page.tsx` — guard `invitation.email` for null before use
These are the only remaining typecheck failures after this backend implementation.
