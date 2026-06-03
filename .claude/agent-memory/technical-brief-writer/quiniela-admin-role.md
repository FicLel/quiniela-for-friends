---
name: quiniela-admin-role
description: Quiniela-level admin uses quiniela_memberships.role; session.role is the global app role ('admin'|'player').
metadata:
  type: project
---

There are two distinct "admin" concepts in this codebase:

1. **Global app admin** — stored in `session.role === 'admin'` (the JWT payload from `AuthClient`). Used for system-wide operations (import matches, manage users, etc.).

2. **Quiniela-level admin** — stored as `role = 'admin'` in `public.quiniela_memberships`. Used for per-quiniela operations (approve members, manage invites, etc.).

**How to apply:** When a feature requires a quiniela-level admin check, query `quiniela_memberships` with `eq('quiniela_id', ...).eq('user_id', ...).eq('role', 'admin').not('approved_at', 'is', null)`. Do NOT use `session.role` for quiniela-scoped admin gates — those are separate concepts.

The existing `MembershipsRepository.findByQuinielaAndUser(quinielaId, userId)` returns a `Membership` object that includes `role`, so you can check `membership.role === 'admin'` after fetching.

See also: [[auth-module-patterns]], [[repository-patterns]]
