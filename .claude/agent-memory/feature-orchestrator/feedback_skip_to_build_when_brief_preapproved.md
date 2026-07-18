---
name: feedback-skip-to-build-when-brief-preapproved
description: When the user supplies an already-approved technical brief up front, skip mapping/story/brief phases and start directly at backend implementation.
metadata:
  type: feedback
---

When a task explicitly says a technical brief (and often story/mapping too) is already approved and reproduces it in full, do not re-run codebase-feature-mapper, story-writer, or technical-brief-writer, and do not re-present them for approval gates. Start directly at the-backend, then the-frontend, then implementation-validator.

**Why:** Confirmed 2026-07-17 on the extra-questions answer-override feature — the user front-loaded a fully-written, final brief and explicitly instructed skipping straight to backend/frontend/validation. Re-deriving already-settled product decisions (e.g. "overrides only after resolve", "re-resolve wipes overrides") would have been redundant and risked contradicting decisions already settled with the user.

**How to apply:** Look for explicit signal in the task instructions — phrasing like "codebase exploration and an approved technical brief already exist," "skip your ... phases entirely," or a brief pasted in full and marked "final and authoritative." Absent that explicit signal, follow the full canonical pipeline with both human approval gates. See [[project-supabase-mcp-readonly]] for a related operational constraint discovered during this same run (migrations can't be applied by agents in this environment, only by the user).
