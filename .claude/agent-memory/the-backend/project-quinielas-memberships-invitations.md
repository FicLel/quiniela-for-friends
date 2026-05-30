---
name: project-quinielas-memberships-invitations
description: Quiniela invitation and membership system — schema, three new modules, service business rules, and test patterns
metadata:
  type: project
---

Implemented the full backend for the quiniela invitation and membership system (migration, quinielas/, memberships/, invitations/ modules, 58 unit tests).

**Why:** Core social feature of the app — users need to create quinielas, invite friends, and manage membership.

**How to apply:** Use as canonical reference for:
- Multi-module feature implementation with cross-service dependencies (InvitationsService depends on all three repositories)
- The `revokeInvite` pattern: `IInvitationsRepository` has no `findById`, so ownership verification uses `findAllByQuiniela + Array.find`
- Token security pattern: `node:crypto randomBytes(32).toString('hex')` as raw token, SHA-256 via `createHash('sha256')` as stored hash; URL contains raw, DB contains hash
- `acceptInvite` split: `callerUserId !== null` → logged-in existing user path; `callerUserId === null` → new-user path (and `EMAIL_MISMATCH` signals action layer to redirect to login)
- `leaveQuiniela`: only admins can self-leave; `role=member` → `NOT_A_MEMBER`; last admin → `LAST_ADMIN_CANNOT_LEAVE`
- `removeMember`: admins cannot be removed via this endpoint → `CANNOT_REMOVE_ADMIN`
- bcryptjs salt rounds: 12 (matches AuthService)

**Key files:**
- `supabase/migrations/20260530000000_quinielas_memberships_invitations.sql`
- `quinielas/` — types, repository, service
- `memberships/` — types, repository, service
- `invitations/` — types, repository, service

[[project-competitions-module]]
