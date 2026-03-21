# Issue 5: Graph Module & Next Command

**Type:** AFK
**Blocked by:** Issues 3, 4

## What to build

Implement the `graph/` pure-function module and the `chainflow next` command. The graph module is the core dependency engine — it must be entirely pure (no filesystem access) and fully tested.

- Implement `src/graph/` with pure exported functions:
  - `buildDependencyGraph(steps)` — builds an adjacency structure from `requires` declarations
  - `topologicalSort(graph)` — returns valid execution order; throws on cycles
  - `detectCycle(graph)` — throws with the cycle path on circular `requires`
  - `resolveReadySteps(flowSteps, taskState)` — returns which blocked steps become `ready` given current state
  - `resolveNextStep(flowSteps, taskState)` — returns the single next step to work on (or all ready steps for `--parallel`)
- Implement `src/commands/next.ts`:
  - Reads active task state and flow config.
  - Returns the next step and the exact command to run.
  - `--parallel` returns all currently ready steps.
  - Tells the agent to spawn a subagent when `subagent` is set on the step.
  - Tells the agent the task is complete when all steps are done.
  - `--task <name>` switches the active task.
- Write unit tests for all graph functions:
  - Topological sort produces correct ordering
  - Cycle detection throws on circular `requires`
  - Correct steps become `ready` after a step completes
  - Cascade handles steps already in `ready`, `done`, and `revision` states

Reference: `docs/prd.md` — Workflow Navigation (32–37), Implementation Decisions → `graph/`.

## Acceptance criteria

- [ ] `graph/` module contains only pure functions — no `fs` or `process.cwd()`
- [ ] `topologicalSort` returns a valid ordering for a DAG
- [ ] `detectCycle` throws with the cycle path for a circular graph
- [ ] `resolveReadySteps` returns correct steps for representative task states
- [ ] `chainflow next` outputs the next step and exact command
- [ ] `chainflow next --parallel` returns all ready steps
- [ ] `chainflow next` includes subagent instruction when `subagent` is set
- [ ] `chainflow next` reports task complete when all steps are `done`
- [ ] Unit tests cover all graph logic cases

## Blocked by

- Issue 3 (flow schema — graph operates on parsed flow config)
- Issue 4 (task start — graph operates on task state)

## User stories addressed

- User stories 32–37 (workflow navigation)
