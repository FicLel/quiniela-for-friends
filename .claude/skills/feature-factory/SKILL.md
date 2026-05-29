---
name: feature-factory
description: >
  Orchestrate a complete feature build from idea to implementation using the full subagent pipeline.
  Invoke this skill when the user says "build a feature", "ship a feature", "implement this feature",
  "feature factory", "run the full chain", "take this from idea to code", or describes a feature
  they want fully implemented end-to-end. Runs codebase-feature-mapper → story-writer →
  [human approval] → technical-brief-writer → [human approval] → the-backend → the-frontend →
  implementation-validator, with human checkpoints and automatic re-routing on critical gaps.
---

# Feature Factory

You are the conductor of a multi-step feature pipeline. Your job is to spawn subagents in order,
carry their outputs forward as context, and pause at approval gates so the human stays in control
of the decisions that matter. You do not implement anything yourself — you brief subagents clearly
and stitch their outputs together.

## Artifacts to track

Maintain these throughout the run — each step feeds the next:

| Artifact | Produced in | Used by |
|---|---|---|
| Feature description | Human input | All steps |
| Mapper findings | Step 1 | Steps 2, 4, 6, 7, 8 |
| Approved story | Step 3 | Steps 4, 8 |
| Approved brief | Step 5 | Steps 6, 7, 8 |
| Backend summary | Step 6 | Step 7 |
| Validator report | Step 8 | Steps 9, 10 |

---

## The chain

### Step 1 — Codebase exploration

Spawn `codebase-feature-mapper` with the feature description. Brief it to:
- Identify which files, modules, and functions are relevant to this feature.
- Note what already exists vs. what needs to be built from scratch.
- Return a concise findings summary: file paths, existing patterns, and gaps.

### Step 2 — Story writing

Spawn `story-writer` with the feature description and the mapper findings. Ask it to produce a
structured user story: acceptance criteria, edge cases, and explicit out-of-scope boundaries.

### Step 3 — Story approval gate ⏸

Present the story to the human and ask:

> "Here is the user story. Please review and tell me: **Approved**, **Changes requested** (include
> your notes), or **Rejected**."

- **Approved** → continue to Step 4.
- **Changes requested** → re-invoke `story-writer` with the human's feedback plus the original
  mapper findings. Repeat this gate until the story is approved or rejected.
- **Rejected** → stop the chain. Summarize what the mapper found and which story directions were
  explored, so the human has a clean starting point for a different approach.

### Step 4 — Technical brief

Spawn `technical-brief-writer` with the **approved story** and the mapper findings. Ask it to
produce a technical brief covering: backend changes (routes, services, repositories, migrations),
frontend changes (components, pages, hooks, tests), and test expectations for both layers.

### Step 5 — Brief approval gate ⏸

Present the brief to the human and ask:

> "Here is the technical brief. Please review: **Approved**, **Changes requested** (include notes),
> or **Rejected**."

- **Approved** → continue to Step 6.
- **Changes requested** → re-invoke `technical-brief-writer` with the human's feedback, the
  approved story, and the mapper findings. Repeat until approved or rejected.
- **Rejected** → stop the chain. Explicitly note that the approved story is preserved, so the
  human can resume later with a different technical approach.

### Step 6 — Backend implementation

Spawn `the-backend` with the **approved technical brief** and the mapper findings. Ask it to
implement API routes, services, repositories, migrations, and unit tests. Ask it to return a
**backend summary** — the API contracts (endpoints, request/response shapes, service interfaces)
that the frontend will consume.

### Step 7 — Frontend implementation

Spawn `the-frontend` with:
- The **approved technical brief**.
- The **backend summary** from Step 6.
- The mapper findings.

Ask it to implement pages, components, hooks, client-side state, and component/unit tests.

### Step 8 — Validation

Spawn `implementation-validator` with the **approved story**, the **approved technical brief**, and
instructions to read the affected source files. Ask it to produce a severity-grouped gap report:
**Critical**, **Important**, **Minor**.

Report the findings to the human, grouped by severity.

### Step 9 — Critical gap routing

If there are **Critical** findings:
- For each critical gap, determine whether it is a backend or frontend responsibility based on
  what the finding describes.
- Re-invoke the appropriate builder (`the-backend` or `the-frontend`) with the brief, the backend
  summary, and the specific critical findings it must address.
- After the builder responds, re-spawn `implementation-validator` and repeat Step 8.
- Loop until no Critical findings remain, or until the human explicitly accepts remaining gaps.

If only Important or Minor findings remain, present them and let the human decide whether to
address them now or log them for a follow-up.

### Step 10 — Final review gate ⏸

Present a summary:
- What was built (backend and frontend scope in plain language).
- Any outstanding Important/Minor findings.

Ask: "Ready to open a PR, or is there anything you want to address first?"

Do not push code or open a PR without the human explicitly saying to proceed.

---

## Briefing subagents

Every subagent starts cold — it has not seen this conversation. When spawning one, always include:
- The feature description.
- Relevant prior artifacts (mapper findings, approved story, approved brief, backend summary).
- A clear statement of what to produce.

Terse prompts produce shallow work. Give each subagent enough context to act without asking you
for clarification.

## At approval gates

Keep the ask short. State what was produced, then ask the three-option question directly. Don't
bury the gate in prose — the human needs to see clearly that you are waiting for a decision.
