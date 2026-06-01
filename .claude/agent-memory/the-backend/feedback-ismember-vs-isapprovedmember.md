---
name: feedback-ismember-vs-isapprovedmember
description: isMember has two distinct semantics — duplicate-prevention (any row) vs access-control gate (approved only) — never collapse them into one method
metadata:
  type: feedback
---

`isMember` in `IMembershipsRepository` intentionally includes pending (unapproved) members. It is used by `InvitationsService.acceptInvite` to prevent duplicate membership rows — if a user already has a pending membership and tries to accept an invite again, the check must find them.

`isApprovedMember` was added as the separate access-control gate (approved_at IS NOT NULL). It is used by the leaderboard API route and leaderboard page.

**Why:** Changing `isMember` to filter `approved_at IS NOT NULL` would allow a user with a pending membership to accumulate a second membership row if they accepted an invite again.

**How to apply:** Always use `isApprovedMember` for any resource-access authorization check. Use `isMember` only for "does this user have any membership row?" duplicate-prevention checks.

Related: [[project-open-invite-links]], [[project-scoring-leaderboard]]
