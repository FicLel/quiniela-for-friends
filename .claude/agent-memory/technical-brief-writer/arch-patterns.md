---
name: arch-patterns
description: Core hexagonal architecture patterns, naming conventions, and module layout for this quiniela project
metadata:
  type: project
---

Hexagonal architecture: Views (app/) → Services (*Service.ts) → Ports/Interfaces → Clients (*Client.ts) / Repositories (*Repository.ts).

Each domain is a top-level folder at project root (NOT under src/): /auth, /competitions, /quinielas, /memberships, /invitations, /users, /scoring, /expectedResults.

Module files inside each domain:
- *Service.ts — business logic, depends only on port interfaces
- *Client.ts — wraps external APIs (football-data.org) or Supabase JS client
- *Repository.ts — Supabase JS client persistence adapter (PostgREST via `.from()`, `.select()`, `.insert()`, etc.)
- *.types.ts — DTOs, domain types, and port interfaces
- *.schemas.ts — validation schemas (optional)

Views (app/) import only *Service.ts, never repositories or clients directly.

Path alias: @/* resolves to project root (./*).

No global infra/ folder. Cross-cutting helpers go in /shared or /core.

API routes: app/api/admin/{domain}/{action}/route.ts
Server Actions: app/[lang]/(private)/{page}/actions.ts with 'use server' directive
Admin UI components: app/[lang]/(private)/{page}/_components/*.tsx

**Why:** Defined in docs/architecture.md and docs/modules.md; confirmed by reading codebase.
**How to apply:** Every new feature starts with Service + port interface, then repository/client, then view.
