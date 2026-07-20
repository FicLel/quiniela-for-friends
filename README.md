# Quiniela for Friends

A SaaS application for running private soccer betting pools (*quinielas*) among friends. Members predict match outcomes, earn points, and compete on a leaderboard — all scoped to their own pool.

<img width="805" height="903" alt="image" src="https://github.com/user-attachments/assets/eeb5a811-c81b-479e-b351-d5f2af44baa2" />

<img width="916" height="665" alt="image" src="https://github.com/user-attachments/assets/269fa939-4473-4006-a92b-205acaecb0e9" />

<img width="468" height="741" alt="image" src="https://github.com/user-attachments/assets/ea76f14e-a0f9-43c2-af5d-9cf93585aef6" />


---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Domain Modules](#domain-modules)
- [Routing & Pages](#routing--pages)
- [API Routes](#api-routes)
- [Database & Migrations](#database--migrations)
- [Internationalization](#internationalization)
- [Testing](#testing)
- [AI Agents & Claude Code Workflows](#ai-agents--claude-code-workflows)
- [Known Issues](#known-issues)
- [Contributing](#contributing)

---

## Features

- **Authentication** — email/password login via Supabase Auth with custom session JWTs.
- **Quiniela pools** — create pools, invite friends via shareable short-code links.
- **Match predictions** — submit home/away score predictions before each match.
- **Scoring engine** — automatic point calculation when match results are entered.
- **Leaderboard** — per-pool ranking by total points with tiebreaker logic.
- **Extra questions** — bonus prediction questions (e.g. top scorer, champion team).
- **Player sync** — import player rosters from football-data.org for autocomplete in extra questions.
- **Admin panel** — manage competition settings, sync matches and players, resolve extra questions.
- **Internationalization** — English and Spanish UI.
- **Role-based access** — `admin` and `player` roles enforced at route and API level.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres (managed) |
| Database client | Supabase JS client (`@supabase/supabase-js`) via PostgREST |
| Auth | Supabase Auth + custom session JWTs (jose) |
| Validation | Zod v4 |
| i18n | Custom dictionary-based (en / es) |
| Package manager | pnpm |
| Testing | Jest 30 + ts-jest + Testing Library |
| Linting | ESLint 9 flat config |

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project (free tier works)
- A [football-data.org](https://www.football-data.org) API key (free tier for World Cup data)
- Supabase CLI (for running migrations): `npm install -g supabase`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to expose to browsers) | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **never expose to browsers** | Supabase Dashboard → Settings → API |
| `SESSION_SECRET` | HS256 JWT signing secret, minimum 32 characters | Generate: `openssl rand -base64 48` |
| `FOOTBALL_DATA_ORG_API_KEY` | football-data.org API key | https://www.football-data.org/client/register |
| `NEXT_PUBLIC_APP_URL` | Public app URL (used in invite links) | `http://localhost:3000` for local dev |

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` must never appear in client-side bundles. Only use them in Server Components, Route Handlers, and Server Actions.

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase and API credentials

# 3. Run all database migrations against your Supabase project
supabase db push

# 4. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other commands

```bash
pnpm build      # Production build
pnpm start      # Start production server (requires pnpm build first)
pnpm lint       # Run ESLint
pnpm test       # Run Jest test suite
```

---

## Project Structure

```
/
├── app/                        # Next.js App Router routes
│   ├── [lang]/                 # Locale-prefixed routes (en | es)
│   │   ├── (private)/          # Authenticated pages
│   │   │   ├── welcome/        # Home: match list + quiniela switcher
│   │   │   ├── quinielas/      # Pool management, predictions, leaderboard
│   │   │   ├── dashboard/      # Admin: user management
│   │   │   ├── admin/          # Admin: competition settings
│   │   │   └── auth/           # Change password
│   │   └── (public)/           # Unauthenticated pages
│   │       ├── login/          # Login page
│   │       └── invite/         # Invite link landing page
│   ├── api/                    # Route Handlers (REST endpoints)
│   │   ├── admin/              # Admin-only API routes
│   │   │   ├── matches/sync/   # Sync matches from football-data.org
│   │   │   ├── players/        # Player sync workflow routes
│   │   │   └── settings/       # App settings CRUD
│   │   ├── pools/[poolId]/     # Per-pool API (leaderboard)
│   │   └── quinielas/[quinielaId]/extra-questions/  # Extra questions API
│   └── _components/            # Shared UI components
│
├── auth/                       # Auth module (service, client, types)
├── appSettings/                # Competition settings module
├── competitions/               # Competition data module
├── expectedResults/            # User predictions module
├── extraQuestions/             # Extra bonus questions module
├── i18n/                       # Dictionaries and i18n helpers
├── invitations/                # Invite link module
├── memberships/                # Pool membership module
├── players/                    # Player roster module
├── quinielas/                  # Quiniela pool module
├── scoring/                    # Points calculation and leaderboard
├── users/                      # User profile module
│
├── supabase/migrations/        # SQL migration files (chronological)
├── docs/                       # Architecture and stack documentation
└── .agents/skills/             # Claude Code agent skills
```

---

## Architecture

The project follows **hexagonal (ports & adapters) architecture**. See [`docs/architecture.md`](docs/architecture.md) for the full rules.

```
Views (app/)
  └── call → Services (domain modules)
                └── depend on → Ports (interfaces)
                                  └── implemented by → Repositories / Clients
```

**Rules:**
- Views never import repositories, clients, or the Supabase client directly.
- Services contain all business logic and depend only on interfaces (ports).
- Repositories implement persistence with the Supabase JS client via PostgREST.
- Clients wrap external APIs (football-data.org, Supabase Auth).
- New features go: service + port first → repository/client → view.

---

## Domain Modules

Each domain module lives at the project root in a folder named after its domain:

| Module | Responsibility |
|---|---|
| `auth/` | Login, logout, session creation, password change |
| `users/` | User profiles, roles |
| `quinielas/` | Pool creation, listing pools for a user |
| `memberships/` | Joining pools, approval workflow |
| `invitations/` | Short-code invite links |
| `expectedResults/` | Storing and retrieving user predictions |
| `scoring/` | Calculating points, aggregating leaderboard |
| `appSettings/` | Admin-configurable competition settings |
| `competitions/` | Competition/tournament data |
| `players/` | Player roster sync from football-data.org |
| `extraQuestions/` | Bonus prediction questions per pool |

Each module contains:
- `*Service.ts` — business logic (use cases)
- `*Repository.ts` — persistence via Supabase JS client (PostgREST)
- `*Client.ts` — external API or Supabase client wrapper (where needed)
- `*.types.ts` — DTOs and domain types
- `*.schemas.ts` — Zod validation schemas (where needed)
- `__tests__/` — unit and integration tests

---

## Routing & Pages

All user-facing routes are locale-prefixed (`/en/...` or `/es/...`).

| Path | Description | Auth required |
|---|---|---|
| `/[lang]/login` | Email/password login | No |
| `/[lang]/invite/[shortCode]` | Invite link landing | No |
| `/[lang]/welcome` | Home screen with match list | Yes |
| `/[lang]/quinielas` | List your pools | Yes |
| `/[lang]/quinielas/new` | Create a new pool | Yes |
| `/[lang]/quinielas/[id]/members` | Manage pool members | Yes |
| `/[lang]/quinielas/[id]/leaderboard` | Points leaderboard | Yes |
| `/[lang]/quinielas/[id]/extra-questions` | Answer bonus questions | Yes |
| `/[lang]/quinielas/[id]/admin/extra-questions` | Manage bonus questions (admin) | Admin |
| `/[lang]/dashboard` | User management (admin) | Admin |
| `/[lang]/admin/settings` | Competition settings (admin) | Admin |
| `/[lang]/auth/change-password` | Change password | Yes |

---

## API Routes

| Method | Path | Description | Role |
|---|---|---|---|
| GET/PUT | `/api/admin/settings` | Read and update competition settings | Admin |
| POST | `/api/admin/matches/sync` | Trigger match sync from football-data.org | Admin |
| POST | `/api/admin/players/sync/start` | Start a player roster sync run | Admin |
| POST | `/api/admin/players/sync/finish` | Mark a sync run as complete | Admin |
| POST | `/api/admin/players/sync/item-error` | Record a per-team sync error | Admin |
| GET | `/api/admin/players/team-detail` | Fetch team + squad from football-data.org | Admin |
| POST | `/api/admin/players/save-team` | Persist a team's players to the DB | Admin |
| GET | `/api/pools/[poolId]/leaderboard` | Fetch leaderboard for a pool | Member |
| GET/POST | `/api/quinielas/[id]/extra-questions` | List / create bonus questions | Admin |
| POST | `/api/quinielas/[id]/extra-questions/[qId]/answers` | Submit an answer | Member |
| POST | `/api/quinielas/[id]/extra-questions/[qId]/resolve` | Resolve a bonus question | Admin |
| GET | `/api/quinielas/[id]/extra-questions/players` | Autocomplete players for a question | Member |
| GET | `/api/quinielas/[id]/extra-questions/teams` | Autocomplete teams for a question | Member |

---

## Database & Migrations

Migrations live in `supabase/migrations/` and are numbered by timestamp.

```bash
# Apply all pending migrations to your Supabase project
supabase db push

# Or link a project and push interactively
supabase link --project-ref <your-project-ref>
supabase db push
```

Migration history (in order):

| File | Purpose |
|---|---|
| `20260526000000_auth_setup.sql` | Base auth tables and RLS |
| `20260526000001_password_auth_setup.sql` | Password auth configuration |
| `20260526000002_users_rls_bypass.sql` | Service-role RLS bypass |
| `20260527000000_custom_auth.sql` | Custom JWT session tables |
| `20260528000000_matches.sql` | Matches and competition tables |
| `20260530000000_quinielas_memberships_invitations.sql` | Pools, memberships, invite links |
| `20260531000000_short_code_and_approved_at.sql` | Invite short codes and approval timestamps |
| `20260601000000_open_invite_links.sql` | Public invite link support |
| `20260602000000_user_expected_results.sql` | User predictions storage |
| `20260603000000_remove_redundant_fks.sql` | Schema cleanup |
| `20260603000001_fix_admin_membership_approval.sql` | Admin membership auto-approval fix |
| `20260604000000_knockout_placeholders.sql` | Knockout stage placeholder matches |
| `20260605000000_scoring_regulation_results.sql` | Regulation-time result scoring |
| `20260606000000_token_version.sql` | JWT token versioning (session invalidation) |
| `20260608000000_players_sync.sql` | Player roster sync tables |
| `20260609000000_per_quiniela_predictions.sql` | Per-pool prediction scores and leaderboard |
| `20260610000000_extra_questions.sql` | Bonus questions tables |
| `20260611000000_fix_extra_questions_fk.sql` | Extra questions FK fix |

> Never edit existing migration files. Add a new timestamped file for every schema change.

---

## Internationalization

The app supports English (`en`) and Spanish (`es`). All routes are prefixed with the locale segment.

Dictionaries live in `i18n/dictionaries/en.json` and `i18n/dictionaries/es.json`.

The middleware (`app/middleware.ts`) reads the `Accept-Language` header and redirects bare paths to the correct locale prefix.

To add a new string:
1. Add the key in both `en.json` and `es.json`.
2. Use `getDictionary(lang)` in server components or pass the dictionary down as a prop.

---

## Testing

```bash
pnpm test              # Run all tests
pnpm test --watch      # Watch mode
pnpm test path/to/file # Run a single test file
```

Tests live in `__tests__/` folders next to the code they cover. The project uses:

- **Jest 30** with `ts-jest` for TypeScript support.
- **Testing Library** (`@testing-library/react`) for component tests.
- **`jest-environment-jsdom`** for DOM-dependent tests.

Test strategy (from [`docs/testing.md`](docs/testing.md)):

- **Unit tests** around Services (business logic) and pure domain functions.
- **Integration tests** around Repositories (Supabase queries) and auth flows.
- Ports/interfaces are mocked in unit tests; real Supabase clients are used in integration tests.
- Write tests or test scenarios before implementing new features (TDD).

---

## AI Agents & Claude Code Workflows

This project is set up for AI-assisted development with **Claude Code**. The `.claude/` directory and `CLAUDE.md` configure how the AI behaves in this codebase.

### How the agents work

Claude Code has access to a set of **skills** (slash commands) that orchestrate common workflows:

| Skill | What it does |
|---|---|
| `/feature-factory` | Full end-to-end feature pipeline: maps codebase → writes user story → writes technical brief → implements backend → implements frontend → validates. Pauses at each step for your approval. |
| `/ui-ux-designer` | Designs screen layouts, user flows, and component placement before any code is written. |
| `/component-api-designer` | Designs TypeScript props interfaces for React components before implementation. |
| `/code-review` | Reviews the current diff for correctness bugs and simplification opportunities. Supports `--fix` to apply changes and `--comment` to post as inline PR comments. |
| `/security-review` | Audits pending changes for security vulnerabilities. |
| `/verify` | Launches the app, navigates through the changed feature, and confirms it works before marking complete. |
| `/run` | Starts the dev server and observes the running app. |
| `/simplify` | Applies reuse, simplification, and cleanup improvements to changed code. |
| `/schedule` | Creates scheduled recurring agent routines (cron-style remote runs). |

### Feature factory pipeline

When you describe a new feature, the pipeline runs in this order:

```
codebase-feature-mapper
  → story-writer (human approval)
  → technical-brief-writer (human approval)
  → the-backend (implements services, repositories, routes, tests)
  → the-frontend (implements React components, pages, hooks)
  → implementation-validator (gap analysis report)
```

If the validator finds critical gaps it routes back to the relevant build agent automatically.

### MCP integrations

The project uses the **Supabase MCP server** (configured in `.mcp.json`), which lets Claude Code:
- Inspect the live database schema.
- Read logs and advisors from the Supabase dashboard.
- Generate TypeScript types from the DB schema.

> The MCP server is read-only in this configuration.

### Agent skills

The `.agents/skills/` directory contains agent skill packages:
- `supabase/` — Supabase agent skill for critical DB and security guidance.
- `supabase-postgres-best-practices/` — Reference guides for Postgres patterns (indexing, locking, RLS, etc.).

### Architecture rules for the AI

The AI is instructed to:
1. Always read `docs/stack.md`, `docs/architecture.md`, `docs/modules.md`, and `docs/testing.md` before proposing changes.
2. Map any new feature or bug to existing code before writing new code.
3. Follow hexagonal architecture (no direct Supabase client imports in views).
4. Write service + port first, then repository, then view.
5. Read `node_modules/next/dist/docs/` before using Next.js-specific APIs, since this version may differ from training data.

---

## Known Issues

Deferred items from recent implementation-validator runs:

- **Player sync** — see [`docs/player-sync-known-issues.md`](docs/player-sync-known-issues.md): error handling gaps in `PlayersRepository.getActiveSync`, three missing 403 test scenarios, and a `SECURITY DEFINER` function missing `SET search_path`.
- **Per-quiniela predictions** — see [`docs/per-quiniela-predictions-known-issues.md`](docs/per-quiniela-predictions-known-issues.md): missing repository tests for `upsertBatch` and `aggregateByQuiniela`, and a narrow TOCTOU race window in `ExpectedResultsRepository.upsert`.

---

## Contributing

1. Fork the repo and create a feature branch.
2. Run `pnpm install` and `pnpm test` to make sure everything is green.
3. Follow the hexagonal architecture rules in `docs/architecture.md`.
4. Add tests for any new service logic or repository methods.
5. Run `pnpm lint` before opening a PR.
6. Never edit existing migration files — always add a new timestamped file.
