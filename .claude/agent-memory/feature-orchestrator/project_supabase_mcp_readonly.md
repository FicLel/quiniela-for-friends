---
name: project-supabase-mcp-readonly
description: The Supabase MCP connection in this environment is read-only — agents cannot apply migrations themselves.
metadata:
  type: project
---

`mcp__supabase__apply_migration` fails with `"Cannot apply migration in read-only mode."` in this environment, for both the-backend subagent and the orchestrator itself. Confirmed 2026-07-17 while building the extra-questions answer-override feature.

**Why:** The Supabase MCP server this project is wired to is configured read-only, likely intentionally, to prevent agents from pushing schema changes straight to the live/linked project without human review.

**How to apply:** Whenever a feature's technical brief includes a new migration file, expect the-backend to write the file but be unable to apply it. Do not treat this as a build-agent failure — surface it as a critical-but-infrastructural gap in the validation step. The actual application must be done by the user (or someone with write access) via `supabase db push` or pasting the SQL into the Supabase dashboard SQL editor. After they confirm it's applied, verify independently with `mcp__supabase__execute_sql` (query `information_schema.columns` / `pg_constraint` / `pg_indexes` for the new schema objects) before re-running implementation-validator — do not just take "fixed" at face value, and do not let build-agent memory claims of "migration applied" go unverified either (the-backend's memory has previously recorded a false "applied" claim — see [[feedback-verify-migration-claims]]).
