---
name: project-worktree-setup
description: How the frontend agent worktree is structured and what files are missing vs the main repo
metadata:
  type: project
---

Frontend agent work happens in a sparse git worktree at `.claude/worktrees/agent-<id>/`. This worktree only contains files committed to git — it does NOT have untracked files from main (auth/, jest.config.js, login components, etc.).

**Why:** The worktree is created from the git history, not the working tree. Untracked files in main are NOT copied.

**How to apply:** When implementing a frontend feature in a worktree, always check whether auth/, jest.config.js, and other non-committed files exist. If they don't, create them in the worktree. The node_modules are shared via pnpm and ARE accessible even without them being in the worktree's package.json.

Key missing files to recreate when needed:
- `auth/AuthClient.ts` — JWT session management, `getTokenFromServerAction()` reads cookie via `next/headers`
- `jest.config.js` — needs `setupFilesAfterEnv` + `jest.setup.ts` for `@testing-library/jest-dom`
- `jest.setup.ts` — `import '@testing-library/jest-dom'`
