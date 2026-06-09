---
name: migration-naming
description: Migration file naming convention and current latest migration number.
metadata:
  type: project
---

Migration files live in `supabase/migrations/` and follow the pattern `YYYYMMDDHHMMSS_description.sql`.

The latest existing migration is `20260611000000_fix_extra_questions_fk.sql`.

The next migration should use a timestamp of `20260612000000` or later to maintain order.

**How to apply:** When creating a new migration, use `20260612000000_<description>.sql` as the filename. If multiple migrations land on the same day, use `20260612000001_<description>.sql` for the second, etc.
