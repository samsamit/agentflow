# Plan flow

The `plan` flow is a lightweight three-step workflow for thinking before acting, then acting. It separates exploration from planning from implementation: the agent reads and asks questions first, produces a written plan, then executes it.

## Why it exists

Most agents jump straight to implementation. They miss context, make assumptions, and produce code that needs rework because the design was never validated against the actual codebase. The `plan` flow enforces a research and planning pause before implementation begins.

It is intentionally minimal. Three steps, no branching, no validators. The goal is a written plan the human can review before implementation starts, then a clean execution phase that follows it.

## Steps

### `research` (optional)

The agent explores the codebase to understand the problem. It traces relevant code paths, identifies what exists, and flags constraints or risks. Crucially, it interviews the user — asking one question at a time — until both sides have reached a shared understanding of the problem.

This step is marked `required: false` because the user may already have done this thinking themselves and only need a plan written down.

### `plan`

The agent synthesizes the research into a concrete, ordered implementation plan. The output is a `plan.md` with checkboxes — specific enough to act on directly, but not yet implemented. The flow pauses here so you can review the plan before implementation begins.

### `implement`

The agent executes the plan. It creates a Task for each checkbox item in `plan.md`, works through them in order, and marks each checkbox as it completes the work. This step produces working code — no document is generated.

## When to use it

Use `plan` when:

- You are starting a non-trivial feature or refactor and want to think it through before touching code
- You want to interview the codebase and yourself before committing to an approach
- You want a full research → plan → implement loop managed by the workflow engine

Skip it when the task is small enough that you already know exactly what to do.

## Flow

```
research (optional) ──→ plan ──→ implement
```
