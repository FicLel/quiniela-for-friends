---
name: component-api-designer
description: >
  Design the TypeScript props API for a React component in this Next.js quiniela/soccer betting project.
  Use this skill whenever the user describes a component they want to build, asks for props design,
  wants a component interface, or says things like "design a bet card", "what props should X have",
  "create a filter bar component", "how should I type this component", or "design the API for X".
  Always invoke this skill before writing component implementation code.
---

# Component API Designer

You are designing a React component's **props interface** for a Next.js 16 / React 19 App Router
quiniela (soccer betting pool) SaaS. The goal is a clean, reusable TypeScript API — not the
implementation or styles.

## Project conventions

- **No `src/` directory.** Components live under `app/` (e.g. `app/components/BetCard.tsx`) or
  co-located with their route (e.g. `app/(private)/bets/BetCard.tsx`).
- **Path alias:** `@/*` resolves to the project root.
- **Tailwind CSS v4** — Tailwind is used for styling, but props should not expose Tailwind class
  names. Use semantic variant/size props instead.
- **Domain modules:** `auth`, `bets`, `matches`, `users`. Components receive domain types defined
  in `<module>/<module>.types.ts`.

## Deciding: server vs client component

Ask yourself: does this component need any of these?

- User interaction: `onClick`, `onChange`, form submit, hover state
- Browser APIs: `window`, `localStorage`, `useEffect`, `useState`, `useRef`
- Real-time updates or WebSocket subscriptions

**If yes → `"use client"` at the top. If no → server component (no directive needed).**

Call this out explicitly in your output. A component that only receives data and renders HTML is
almost always a server component.

## Output format

For every component design, produce exactly these four sections:

### 1. Component classification
One sentence: server or client component, and why.

### 2. Props interface
A single TypeScript `interface` (or `type` if a union is needed). Use types from domain modules
where they exist. Avoid `any`. Use `ReactNode` for slot content. Mark optional props with `?`.

```tsx
// app/components/BetCard.tsx  ← canonical file location

interface BetCardProps {
  bet: Bet;              // from @/bets/bets.types
  variant?: "compact" | "expanded";
  onSettle?: (betId: string) => void;  // makes this a client component
}
```

### 3. Variants & states table
A markdown table listing each visual/behavioral variant or state, what triggers it, and what prop
drives it. Keep it tight — if there's only one variant, say so.

| Variant / State | Trigger | Prop |
|---|---|---|
| compact | used in list rows | `variant="compact"` |
| expanded | default detail view | `variant="expanded"` (default) |
| loading | data not yet available | `isLoading?: boolean` |

### 4. Usage example
A minimal JSX snippet showing the most common usage. Import from the domain module's types file.
No implementation details, no className strings.

```tsx
import type { Bet } from "@/bets/bets.types";

<BetCard bet={bet} variant="compact" onSettle={handleSettle} />
```

### 5. Design notes (only if non-obvious)
A short bullet list explaining decisions a reader might question. Skip this section entirely if
everything in the interface is self-explanatory.

## Common quiniela domain types (reference)

These types don't exist in the codebase yet but represent the domain well — use them as a guide
when the component interacts with these concepts:

```ts
// bets
type BetStatus = "pending" | "won" | "lost" | "void";
interface Bet { id: string; matchId: string; prediction: MatchResult; status: BetStatus; points: number; }

// matches
type MatchResult = "home" | "draw" | "away";
interface Match { id: string; homeTeam: string; awayTeam: string; kickoff: Date; result?: MatchResult; }

// users
interface UserProfile { id: string; displayName: string; avatarUrl?: string; }
```

## Guardrails

- Do not propose implementation code (JSX body, logic, hooks).
- Do not include `className` or Tailwind classes in props.
- Do not add `children?: ReactNode` unless the component genuinely acts as a layout wrapper.
- Do not design for hypothetical future features — only what the user described.
- If the user gives a vague description, ask one clarifying question before designing.
