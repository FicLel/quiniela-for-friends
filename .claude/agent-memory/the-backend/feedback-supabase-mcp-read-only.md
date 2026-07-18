---
name: feedback-supabase-mcp-read-only
description: The Supabase MCP connection in this environment is read-only — apply_migration and DDL writes fail
metadata:
  type: reference
---

`mcp__supabase__apply_migration` (and presumably any write via `mcp__supabase__execute_sql`) fails with
`"Cannot apply migration in read-only mode."` in this environment. Read tools (`list_tables`,
`execute_sql` for SELECTs) work fine and reflect the real linked project's current schema.

There is no `supabase` CLI binary available either (checked both Git Bash `command -v` and PowerShell
`Get-Command`), and the repo's `supabase/config.toml` exists but nothing is linked/running locally.

**How to apply:** Write the migration file into `supabase/migrations/` (this is real, verified work) and
tell the user explicitly that it has NOT been applied — they need to run it themselves via Supabase CLI
(`supabase db push`) or the Supabase dashboard SQL editor, since neither the MCP tools nor a local CLI
are write-capable from this session. Do not claim a migration was "applied" unless `apply_migration`
actually returned success — verify with a read query (e.g. check `information_schema.columns`) before
reporting it as done.
