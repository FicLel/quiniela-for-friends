---
name: tenant-isolation
description: Current state of tenant/league isolation — quiniela_id is the tenant key; enforced at the repository layer via scoped queries
metadata:
  type: project
---

The project uses `quiniela_id` as its tenant boundary (not a separate `leagueId`/`tenantId`). Each `quiniela_memberships` row has a `quiniela_id` FK, and each `quiniela_invitations` row has a `quiniela_id` FK.

Isolation is enforced at the repository layer: all reads are scoped by `quiniela_id` (e.g., `findAllByQuiniela`, `findByQuinielaAndUser`). RLS is enabled on all tables but policies only grant `service_role` access, meaning application-level scoping is the real guard.

The `users` table and `public.users` are global (no quiniela scope), which is intentional — user identity is cross-quiniela.

A system-wide user list (AC-1 of the users-dashboard feature) deliberately reads all users without quiniela scoping. The admin-only gate is enforced at the service layer by checking the caller's `role` field in the JWT session (`role: 'admin' | 'player'` from `SessionPayload`).

**Why:** Quiniela-scoped isolation verified by reading migration SQL and repository code. RLS grants service_role only, so app-level scoping is authoritative.
**How to apply:** New queries that join across quinielas are only permitted for system-admin callers (role = 'admin'). Always verify the caller's role before returning cross-quiniela data.

[[arch-patterns]]
