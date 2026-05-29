# Architecture: Hexagonal

We follow a **hexagonal (ports & adapters)** architecture. [web:23][web:40][web:43]

Core ideas:

- **Domain / Application (Services)** is at the center.
- **Adapters** (repositories, clients, UI, APIs) surround the core.
- Dependencies flow **inward**: outer layers depend on inner, never the other way. [web:35][web:37]

## Layers

### Views (UI / Presentation)

- Next.js App Router pages and layouts under `app/`. [web:24]  
- React components for the UI.
- Responsibilities:
  - Handle routing and rendering.
  - Call application services to perform actions.
- Must **not** talk directly to TypeORM, Supabase client, or raw SQL.

### Services (Domain / Application)

- Implement business rules for the quiniela / betting domain (placing bets, validating odds, settling results, etc.). [web:23][web:40]  
- Define the interfaces (ports) they need from persistence or external APIs.
- Should not depend on Supabase or Next.js; they depend only on abstractions.

### Repositories & Clients (Infrastructure)

- **Repositories**:
  - Implement persistence ports using TypeORM targeting Supabase Postgres. [web:6][web:13]  
- **Clients**:
  - Wrap external APIs (including Supabase JS client when used as an API, if needed).
- These live inside each module (auth, bets, matches, etc.) rather than a single global infra folder.

### Auth

- Supabase Auth is the identity provider. [web:22][web:9]  
- Auth integration (session retrieval, middleware, route protection) uses Next.js App Router patterns. [web:9][web:41]  
- Domain services treat authenticated users as domain objects / IDs, not as Supabase client instances.

## Design rules

- UI → calls **services**.
- Services → depend on **ports** (interfaces).
- Repositories/Clients → implement ports, using Supabase and TypeORM.
- New features should be modeled first in services and ports, then implemented in repositories/clients, then finally wired into views.