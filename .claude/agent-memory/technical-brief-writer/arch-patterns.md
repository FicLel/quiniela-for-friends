---
name: arch-patterns
description: Core hexagonal architecture patterns, naming conventions, and module layout for this quiniela project
metadata:
  type: project
---

Hexagonal architecture: Views (app/) → Services (*Service.ts) → Ports/Interfaces → Clients (*Client.ts) / Repositories (*Repository.ts).

Each domain is a top-level folder at project root: /auth, /bets, /matches, /users.

Module files inside each domain:
- *Service.ts — business logic, depends only on port interfaces
- *Client.ts — wraps Supabase JS client or external APIs
- *Repository.ts — TypeORM persistence adapter
- *.types.ts — DTOs and value objects
- *.schemas.ts — validation schemas

Views (app/) import only *Service.ts, never repositories or clients directly.

Path alias: @/* resolves to project root (./*).

No global infra/ folder. Cross-cutting helpers go in /shared or /core.

**Why:** Defined in docs/architecture.md and docs/modules.md.
**How to apply:** Every new feature starts with Service + port interface, then repository/client, then view.
