# Issue 8: Observability Commands

**Type:** AFK
**Blocked by:** Issue 4

## What to build

Implement `agentflow state` and `agentflow list`. These are read-only commands that give developers and agents visibility into the current state of workflows and tasks.

- Implement `src/commands/state.ts`:
  - Reads active task state and the corresponding flow config.
  - Outputs a tabular view of all steps: name, status, `generates` file path and whether it exists on disk, `requires` dependencies (shown for `blocked` steps).
  - Runnable at any point — safe for agents to call for self-diagnosis.
- Implement `src/commands/list.ts` with two subcommands:
  - `agentflow list flows` — reads all flow directories under `agentFlow/flows/`, outputs available flow names.
  - `agentflow list tasks` — reads all task directories under `agentFlow/tasks/`, outputs task names, completion status, and marks the active task.

Reference: `docs/prd.md` — Observability (57–63), Implementation Decisions → `commands/state.ts`, `commands/list.ts`.

## Acceptance criteria

- [x] `agentflow state` outputs each step's name, status, generates path, and file-exists indicator
- [x] `agentflow state` shows `requires` for blocked steps
- [x] `agentflow state` works on the active task without requiring `--task`
- [x] `agentflow list flows` lists all available flows
- [x] `agentflow list tasks` lists all tasks with completion status and marks the active one
- [x] Both commands exit cleanly when no tasks/flows exist yet

## Blocked by

- Issue 4 (task state — needed to read step statuses and active task)

## User stories addressed

- User stories 57–63 (observability)
