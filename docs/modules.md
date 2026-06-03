# Modules & Folder Structure

We organize code by **domain module** and scope infrastructure inside each module folder. [web:19][web:26]

Typical domain modules:

- `auth`   – authentication & user identity
- `bets`   – placing, listing, settling quiniela bets
- `matches`– matches, scores, schedules
- `users`  – user profiles, preferences, etc.

## Module layout

Each module lives at the project root as a folder named after the domain:

```txt
/auth
  AuthService.ts        # domain/application service
  AuthClient.ts         # Supabase auth client wrapper (adapter)
  AuthRepository.ts     # persistence adapter (if needed)
  auth.types.ts         # DTOs / value objects
  auth.schemas.ts       # validation schemas (optional)

/bets
  BetsService.ts
  BetsRepository.ts
  BetsClient.ts         # external odds API, if any
  bets.types.ts
  bets.schemas.ts
```

Rules:

- **One folder per module**, named after the domain (`auth`, `bets`, `matches`, `users`, etc.).  
- Inside each module:
  - `*Service.ts`:
    - Business logic (use cases).
    - Depends on ports/interfaces for persistence or external APIs.
  - `*Repository.ts`:
    - Implements persistence using the Supabase JS client (`@supabase/supabase-js`).  
  - `*Client.ts`:
    - Implements external API or Supabase client usage.
  - Extra files like `*.types.ts`, `*.schemas.ts`, `*.mappers.ts` are allowed to keep concerns local to the module.

## Views & Routing

Views live under `app/` and consume module services:

```txt
/app
  (public)/
    login/
      page.tsx          # Uses AuthService from "@/auth/AuthService"
  (private)/
    dashboard/
      page.tsx
    bets/
      page.tsx
```

Conventions:

- Use the `@/*` alias to import from modules, for example:
  - `import { AuthService } from "@/auth/AuthService";`
  - `import { BetsService } from "@/bets/BetsService";`
- Views NEVER import repositories or clients directly—only services.

## Module‑scoped infrastructure

- No global `infra/` or `repository/` folder.
- Infrastructure is scoped to each module:
  - `AuthRepository`, `AuthClient` inside `/auth`
  - `BetsRepository`, `BetsClient` inside `/bets`
- Cross‑cutting helpers (for example DB connection factory, logging utilities) can live in a shared folder such as `/shared` or `/core`, but they must not contain domain logic.