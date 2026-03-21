# Issue 6: Context Delivery Command

**Type:** AFK
**Blocked by:** Issues 3, 4, 5

## What to build

Implement `chainflow context --step <name>`. This is the most complex command — it assembles everything the agent needs to complete a step without exploring the project itself.

- Implement `src/commands/context.ts` and any supporting assembly logic (may live in a `src/context/` module or inline):
  - Read the step's `instructions` file and inline its content.
  - Inline all files listed in `context.references`.
  - Inline the generated output of upstream `context.steps` (error clearly if a required step's generated file is missing; note when an optional step was skipped).
  - When the step is in `revision` state, inject the revision block: show the previously generated output and the reviewer's generated file (`revisedBy`).
  - When the step has `validates` set, assemble output in this exact order:
    1. Validated step files (inlined content to evaluate)
    2. `generates` instruction (what file to produce, which strategy: replace/update/version)
    3. Evaluation instruction: "Evaluate each step above, pass or fail. First run `chainflow complete`. Then for each failing step run `chainflow revise`."
    4. Completion command
  - For non-validates steps: instructions → references → upstream outputs → generates instruction → completion command.
  - The final line of context output is always the exact `chainflow complete --step <name>` command.
- Write an integration test: `context` assembles correct output for a step in `ready` state and a step in `revision` state, using a real temp filesystem.

Reference: `docs/prd.md` — Context Delivery (38–48), Implementation Decisions → `commands/context.ts`, Context Command — `validates` Block Ordering.

## Acceptance criteria

- [ ] `chainflow context --step <name>` outputs the instruction file content
- [ ] Reference files are inlined
- [ ] Upstream step outputs are inlined; missing required outputs produce a clear error; skipped optional steps are noted
- [ ] Revision state includes the previous output and reviewer file
- [ ] `validates` steps output in the correct order (validated files → generates → evaluate instruction → command)
- [ ] Every context output ends with the exact `chainflow complete` command
- [ ] Integration tests cover `ready` and `revision` states

## Blocked by

- Issue 3 (flow schema)
- Issue 4 (task state — needed to determine step status, `revisedBy`)
- Issue 5 (graph — needed to verify step is reachable and ready)

## User stories addressed

- User stories 38–48 (context delivery)
