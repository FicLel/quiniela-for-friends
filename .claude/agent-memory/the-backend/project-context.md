---
name: project-context
description: Core facts about the quiniela SaaS project — stack, architecture, module layout, and path aliases
metadata:
  type: project
---

This is a quiniela / soccer betting SaaS built with Next.js 16 App Router (React 19, TypeScript). Key facts:

- **Package manager**: pnpm
- **Database**: Supabase Postgres (managed). Accessed via the Supabase JS client (`@supabase/supabase-js`) PostgREST API — no TypeORM.
- **Auth**: Supabase Auth (Email OTP flow, no self-registration).
- **Architecture**: Hexagonal — Views → Services → Ports → Repositories/Clients. No global `infra/` folder; infrastructure is scoped to each domain module (`/auth`, `/bets`, etc.).
- **Path alias**: `@/*` resolves to the project root (not `./src`). No `src/` directory.
- **App Router route groups**: `app/(public)/` for public routes, `app/(private)/` for protected routes.
- **Module layout**: Each domain module at project root has `*Service.ts`, `*Client.ts`, `*.types.ts`, `*.schemas.ts`.

**Why:** Understanding this prevents accidental `src/` references and ensures new code lands in the right module folder.
**How to apply:** Always place new domain modules at the project root (e.g. `/bets/BetsService.ts`), never inside `/app` or a global `/infra` folder.
