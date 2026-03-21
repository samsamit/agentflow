# Issue 7: Complete & Revision Commands

**Type:** AFK
**Blocked by:** Issues 4, 5

## What to build

Implement `chainflow complete` and `chainflow revise`. These two commands drive the forward and backward movement of the workflow. The cascade logic that revise triggers belongs in `graph/` as pure functions.

- Implement `src/commands/complete.ts`:
  - Accepts `--step <name>`.
  - Updates the step's state to `done` in `.taskState.yaml`.
  - Uses graph logic to find which blocked steps are now `ready` and updates their state.
  - Outputs which steps were unblocked and the next command to run.
- Implement `src/commands/revise.ts`:
  - Accepts `--step <name>` and `--from <step>` (the reviewing step whose output triggered the revision).
  - Checks `revisionCount` against `maxRevisions`; warns and exits without changing state if the cap is reached.
  - Increments `revisionCount`, sets step state to `revision`, stores `revisedBy`.
  - Runs transitive cascade: all transitively dependent steps that are `done` are reset to `ready`.
  - Outputs the revision count, remaining revisions, cascaded steps, and next command.
- Add to `graph/`:
  - `resolveUnblockedSteps(flowSteps, taskState, completedStep)` — returns steps that become `ready` after a completion
  - `resolveTransitiveCascade(flowSteps, taskState, revisedStep)` — returns all transitively dependent steps that should be reset to `ready`
- Write unit tests for both new graph functions covering all step state combinations (`ready`, `done`, `revision`, `blocked`).
- Write integration tests: `complete` writes correct state and unblocks correct steps; `revise` writes correct state and cascades correctly, on a real temp filesystem.

Reference: `docs/prd.md` — Step Completion & Revision (49–56), Implementation Decisions → `commands/complete.ts`, `commands/revise.ts`, `graph/`.

## Acceptance criteria

- [ ] `chainflow complete --step <name>` sets step to `done` and unblocks correct downstream steps
- [ ] `chainflow complete` outputs unblocked steps and next command
- [ ] `chainflow revise --step <name> --from <step>` sets step to `revision` and stores `revisedBy`
- [ ] `revise` increments `revisionCount` and cascades reset to all transitive dependents
- [ ] `revise` warns and makes no state changes when `maxRevisions` is reached
- [ ] Revision count and remaining revisions are visible in revise output
- [ ] Graph cascade functions are pure — no filesystem access
- [ ] Unit tests cover all step state combinations for unblocking and cascade
- [ ] Integration tests pass for complete and revise

## Blocked by

- Issue 4 (task state — read/write)
- Issue 5 (graph module — cascade and unblocking logic lives here)

## User stories addressed

- User stories 49–56 (step completion & revision)
