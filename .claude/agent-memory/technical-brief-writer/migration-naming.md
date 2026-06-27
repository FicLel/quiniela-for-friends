---
name: migration-naming
description: Migration file naming convention and current latest migration number.
metadata:
  type: project
---

Migration files live in `supabase/migrations/` and follow the pattern `YYYYMMDDHHMMSS_description.sql`.

As of 2026-06-24, the latest existing migration is `20260616000000_password_reset_tokens.sql` (sequence also includes `20260610000000_extra_questions.sql` and `20260611000000_fix_extra_questions_fk.sql` before it). Always re-glob `supabase/migrations/*.sql` to confirm the current latest before naming a new one — this list moves fast.

**How to apply:** When creating a new migration, take the latest timestamp found via Glob and add at least one day/second to it to maintain order. If multiple migrations land on the same day, increment the seconds segment.
