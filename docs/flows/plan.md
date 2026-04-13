# Plan flow

The `plan` flow is a lightweight two-step workflow for thinking before acting. It exists to separate exploration from commitment: the agent reads and asks questions first, then produces a written plan — without touching any code.

## Why it exists

Most agents jump straight to implementation. They miss context, make assumptions, and produce plans that need rework because the design was never validated against the actual codebase. The `plan` flow enforces a pause before implementation begins.

It is intentionally minimal. Two steps, no branching, no validators. The goal is a written plan the human can review and approve before anything is built.

## Steps

### `research` (optional)

The agent explores the codebase to understand the problem. It traces relevant code paths, identifies what exists, and flags constraints or risks. Crucially, it interviews the user — asking one question at a time — until both sides have reached a shared understanding of the problem.

This step is marked `required: false` because the user may already have done this thinking themselves and only need a plan written down.

### `plan`

The agent synthesizes the research into a concrete, ordered implementation plan. The output is a `plan.md` with checkboxes — specific enough to act on directly, but still just a plan. Implementation happens outside this flow.

## When to use it

Use `plan` when:

- You are starting a non-trivial feature or refactor and want to think it through before touching code
- You want to interview the codebase and yourself before committing to an approach
- You need a written artifact to review, share, or hand off before work begins

Skip it when the task is small enough that you already know exactly what to do.

## Flow

```
research (optional) ──→ plan
```
