---
name: tenant-isolation
description: Current state of tenant/league isolation — greenfield, no patterns exist yet as of auth feature
metadata:
  type: project
---

As of the auth feature (first feature built), there is no leagueId or tenantId pattern in the codebase. The project is greenfield with only the default Next.js scaffold.

Supabase Auth manages user identity. The auth module (AuthClient, AuthService) does not yet have tenant context.

Future domain entities (bets, matches, users) will need a leagueId foreign key to enforce per-league data isolation.

**Why:** Noted as a non-negotiable rule in the technical brief writer instructions.
**How to apply:** When designing any entity beyond auth, flag if leagueId is missing. Auth itself is identity-level, not tenant-scoped.

[[arch-patterns]]
