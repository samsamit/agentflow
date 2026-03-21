# Issue 4: Task Start Command

**Type:** AFK
**Blocked by:** Issues 1, 3

## What to build

Implement the `task/` domain module and the `chainflow start` command. This slice introduces task state — the per-task tracking file that all workflow navigation commands depend on.

- Define the task state Zod schema in `src/task/task.schema.ts` covering: task name, flow name, active flag, per-step state (status: `blocked`/`ready`/`done`/`revision`, revisionCount, revisedBy, generatedFile).
- Implement `src/task/reader.ts` and `src/task/writer.ts`: read/write `.taskState.yaml` using the `yaml` package. Throw on failure.
- Implement `src/task/active.ts`: resolve the active task (find task with `active: true`). Throw with a clear message when no active task exists.
- Implement `src/commands/start.ts`:
  - Accepts `--task <name>` (required) and optional `--flow <name>`.
  - Errors if a task with that name already exists.
  - Creates the task directory and initial `.taskState.yaml` with correct initial step states (steps with no `requires` are `ready`; others are `blocked`).
  - Sets the new task active, deactivates the previously active task.
  - Outputs which steps are active and the next command to run.
- Any command that accepts `--task <name>` sets that task active when provided.
- Write unit tests for task state read/write round-trip, active task resolution, and missing-active-task error.
- Write an integration test: `start` creates the correct directory and state file on a real temp filesystem.

Reference: `docs/prd.md` — Task Lifecycle (26–31), Implementation Decisions → `task/`.

## Acceptance criteria

- [ ] Task state Zod schema covers all fields
- [ ] `loadTaskState()` / `writeTaskState()` round-trip correctly
- [ ] `resolveActiveTask()` throws when no task is active
- [ ] `chainflow start --task <name>` creates the task directory and `.taskState.yaml`
- [ ] Steps with no `requires` initialise as `ready`; others as `blocked`
- [ ] Starting a duplicate task name exits 1 with a clear error
- [ ] The new task is set active; any previously active task is deactivated
- [ ] `chainflow start` output ends with the exact next command to run
- [ ] Unit + integration tests pass

## Blocked by

- Issue 1 (core infrastructure)
- Issue 3 (flow schema — needed to load the flow and derive initial step states)

## User stories addressed

- User stories 26–31 (task lifecycle)
