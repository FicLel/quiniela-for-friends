# Stack

- Framework: Next.js 16 App Router with React 19. [web:24]  
- Styling: Tailwind CSS v4 using `@import "tailwindcss"` and `@theme inline { ... }` in global CSS, not the old `@tailwind base/components/utilities`. [web:2][web:5]  
- Package manager: pnpm.  
- Database: Supabase Postgres (managed). [web:6][web:38]  
- Database client: Supabase JS client (`@supabase/supabase-js`), used on the server side via the PostgREST API.  
- Auth: Supabase Auth integrated with Next.js App Router (server components, route handlers, etc.). [web:9][web:22][web:41]  
- Linting: ESLint 9 flat config via `eslint.config.mjs` with `defineConfig` from `eslint/config`.

### Commands

```bash
pnpm dev        # start dev server at http://localhost:3000
pnpm build      # production build
pnpm start      # start production server
pnpm lint       # run ESLint
```

### Project layout basics

- All routes live under `app/` (App Router). [web:24]  
- No `src/` directory; pages and components live directly under `app/`.  
- Path alias `@/*` resolves to the project root (`./*`), not `./src/`.  
- Before adding Next.js‑specific features (routing, data‑fetching, middleware, server actions), consult `node_modules/next/dist/docs/` for the current API. [web:24]