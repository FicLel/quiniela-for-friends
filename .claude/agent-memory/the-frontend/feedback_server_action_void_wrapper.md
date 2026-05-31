---
name: server-action-void-wrapper
description: When passing a server action as an onX prop typed Promise<void>, wrap it in an arrow function to discard the return value
metadata:
  type: feedback
---

When a server action returns `Promise<SomeResultType>` but the component prop is typed `(args) => Promise<void>`, TypeScript rejects the direct pass-through. Wrap it at the call site:

```tsx
onSaveScore={async (matchId, home, away) => {
  await saveExpectedResult(matchId, home, away)
}}
```

**Why:** The frontend doesn't need to act on mutation results when there is no toast or UI feedback (as in the score-entry feature). The prop type `Promise<void>` is the correct contract for components that are indifferent to the result.

**How to apply:** Any time a server action result type needs to be discarded at the prop boundary — keep the prop typed `void`, wrap at the page/server-component level.
