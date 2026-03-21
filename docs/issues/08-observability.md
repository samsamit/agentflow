# Issue 8: Observability Commands

**Type:** AFK
**Blocked by:** Issue 4

## What to build

Implement `chainflow state` and `chainflow list`. These are read-only commands that give developers and agents visibility into the current state of workflows and tasks.

- Implement `src/commands/state.ts`:
  - Reads active task state and the corresponding flow config.
  - Outputs a tabular view of all steps: name, status, `generates` file path and whether it exists on disk, `requires` dependencies (shown for `blocked` steps).
  - Runnable at any point — safe for agents to call for self-diagnosis.
- Implement `src/commands/list.ts` with two subcommands:
  - `chainflow list flows` — reads all flow directories under `chainFlow/flows/`, outputs available flow names.
  - `chainflow list tasks` — reads all task directories under `chainFlow/tasks/`, outputs task names, completion status, and marks the active task.

Reference: `docs/prd.md` — Observability (57–63), Implementation Decisions → `commands/state.ts`, `commands/list.ts`.

## Acceptance criteria

- [ ] `chainflow state` outputs each step's name, status, generates path, and file-exists indicator
- [ ] `chainflow state` shows `requires` for blocked steps
- [ ] `chainflow state` works on the active task without requiring `--task`
- [ ] `chainflow list flows` lists all available flows
- [ ] `chainflow list tasks` lists all tasks with completion status and marks the active one
- [ ] Both commands exit cleanly when no tasks/flows exist yet

## Blocked by

- Issue 4 (task state — needed to read step statuses and active task)

## User stories addressed

- User stories 57–63 (observability)
