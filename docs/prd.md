# ChainFlow CLI — Product Requirements Document

## Problem Statement

AI agents performing multi-step tasks have no reliable way to track progress, enforce step ordering, or receive the right context at the right time. Without a structured workflow engine, agents must self-navigate: exploring the codebase, deciding what to do next, and manually tracking what has been done. This leads to missed steps, out-of-order execution, and context loss between steps. The developer running the agent has no visibility into where the task is or why a step was revisited.

---

## Solution

`chainflow` is an agent-first CLI workflow engine. Developers define multi-step workflows (flows) in YAML files. An AI agent invokes `chainflow` commands to navigate the workflow — receiving injected context for each step, marking steps complete, triggering revisions, and always being told exactly what to run next. The engine enforces dependency order, cascades revisions to downstream steps, and injects all necessary context so the agent never needs to explore on its own.

---

## User Stories

### Init & Setup

1. As a developer, I want to run `chainflow init` and have the project structure created, so that I can start defining flows immediately.
2. As a developer, I want `chainflow init` to describe what it is doing as it runs, so that I understand what was created.
3. As a developer, I want `chainflow init` to prompt me to select my IDE (VS Code, JetBrains, Zed), so that YAML schema validation is configured automatically for my editor.
4. As a developer, I want `chainflow init` to show me a list of bundled ready-made flows and let me select which ones to include, so that I can get started without writing flows from scratch.
5. As a developer, I want selected bundled flows to be copied into my `chainFlow/flows/` directory on init, so that they are immediately usable.
6. As a developer, I want a `.vscode/settings.json` `yaml.schemas` entry written when I choose VS Code, so that my flow config files have full autocomplete and validation.
7. As a developer, I want a `.idea/jsonSchemas.xml` entry written when I choose JetBrains, so that my flow config files have full autocomplete and validation.
8. As a developer, I want a `.zed/settings.json` `file_associations` entry written when I choose Zed, so that my flow config files have full autocomplete and validation.
9. As a developer, I want the flow config JSON Schema to be shipped inside the npm package, so that IDE integrations can resolve it locally without network access.
10. As a developer, I want the flow config JSON Schema to be submitted to SchemaStore, so that the VS Code YAML extension picks it up automatically without any local configuration.

### Flow Configuration

11. As a developer, I want to define a named flow in a YAML file with a list of steps, so that I can model any multi-step process.
12. As a developer, I want each step to declare which steps it `requires`, so that the engine can enforce ordering.
13. As a developer, I want each step to optionally declare a `generates` file and a `generateStrategy` (replace, update, version), so that the engine knows what output to expect.
14. As a developer, I want each step to declare a `context` section with an `instructions` file, `references`, and upstream `steps`, so that the agent receives all the context it needs.
15. As a developer, I want each step to optionally declare `validates: [...]`, so that a review step can evaluate specific prior steps and trigger revisions.
16. As a developer, I want each step to optionally declare `subagent: false | true | "<name>"`, so that the engine can instruct the orchestrating agent to spawn subagents for parallel execution.
17. As a developer, I want a flow to declare `maxRevisions`, so that runaway revision loops are automatically capped.
18. As a developer, I want to mark steps as `required: true/false`, so that optional steps can be skipped without blocking downstream work.
19. As a developer, I want the root config to declare a `defaultFlow`, so that commands default to the right flow without needing `--flow` every time.

### Validation

20. As a developer, I want to run `chainflow validate` to check the entire project structure, so that I catch configuration errors before starting a task.
21. As a developer, I want `chainflow validate --flow <name>` to validate a single flow, so that I can iterate on flow design quickly.
22. As a developer, I want validation to detect circular dependencies in `requires` chains, so that I can fix invalid flow graphs.
23. As a developer, I want validation to report missing `instructions` files, so that I know before running a task that all instruction files are in place.
24. As a developer, I want validation to verify that all `context.steps` and `validates` references point to real step names, so that typos are caught early.
25. As an AI agent, I want to run `chainflow validate` before starting a task to confirm the flow is healthy, so that I don't proceed with a broken configuration.

### Task Lifecycle

26. As a developer, I want to run `chainflow start --task <name>` to create a new task, so that the engine initialises state tracking for it.
27. As a developer, I want `start` to error if a task with that name already exists, so that I don't accidentally overwrite task state.
28. As a developer, I want `start` to accept `--flow <name>` to select a non-default flow, so that I can run different workflows for different task types.
29. As a developer, I want `start` to tell me which steps are active and what to run next, so that I can hand off to an agent immediately.
30. As an AI agent, I want `chainflow start` to set a task as active, so that I can omit `--task` on subsequent commands.
31. As an AI agent, I want any command that accepts `--task` to set that task as active when provided, so that I can switch context without extra commands.

### Workflow Navigation

32. As an AI agent, I want to run `chainflow next` to find out which step to work on, so that I never have to reason about dependencies myself.
33. As an AI agent, I want `chainflow next` to tell me the exact command to run next, so that I can proceed without ambiguity.
34. As an AI agent, I want `chainflow next --parallel` to return all currently ready steps at once, so that I can execute them concurrently.
35. As an AI agent, I want `chainflow next` to tell me to spawn a named or generic subagent when `subagent` is set on a step, so that I can delegate appropriately.
36. As an AI agent, I want `chainflow next` to tell me the task is complete when all steps are done, so that I know to stop.
37. As an AI agent, I want `chainflow next --task <name>` to switch the active task, so that I can manage multiple tasks in one session.

### Context Delivery

38. As an AI agent, I want to run `chainflow context --step <name>` to receive the full context for a step, so that I have everything I need to complete it without exploring the project myself.
39. As an AI agent, I want the context to include the step's instruction file content, so that I know exactly what to do.
40. As an AI agent, I want the context to inline reference files from the `references` list, so that I have relevant background material.
41. As an AI agent, I want the context to inline the generated output of upstream `context.steps`, so that I can build on prior work.
42. As an AI agent, I want the context to tell me when an optional step was skipped, so that I know not to expect its output.
43. As an AI agent, I want the context to error clearly when a required step's generated file is missing, so that I know something went wrong upstream.
44. As an AI agent, I want the context to include a revision block when the step is in revision state, so that I understand what needs to change and why.
45. As an AI agent, I want the revision block to show me the previously generated output and the reviewer's generated file, so that I can rework the step with full context.
46. As an AI agent, I want the context to show me validated step files first, then the generates instruction, then the evaluate+command sequence, so that I evaluate → produce → act in the right order.
47. As an AI agent, I want the context to tell me what file to generate and which strategy to use (replace/update/version), so that I handle existing files correctly.
48. As an AI agent, I want the context to end with the exact `chainflow complete` command to run, so that I always know how to close out the step.

### Step Completion & Revision

49. As an AI agent, I want to run `chainflow complete --step <name>` to mark a step done, so that downstream steps are unblocked.
50. As an AI agent, I want `chainflow complete` to tell me which steps were unblocked, so that I understand the downstream impact.
51. As an AI agent, I want `chainflow complete` to tell me the next command to run, so that I can continue the workflow immediately.
52. As an AI agent, I want to run `chainflow revise --step <name> --from <step>` to mark a step for revision, so that prior work can be corrected based on a reviewer's output.
53. As an AI agent, I want `revise` to cascade the revision to all transitively dependent steps (setting them to `ready`), so that downstream steps are re-executed with updated upstream content.
54. As an AI agent, I want `revise` to warn and do nothing when a step has reached `maxRevisions`, so that the workflow doesn't loop indefinitely.
55. As an AI agent, I want the revision count to be visible in the revise output, so that I know how many revisions remain.
56. As a developer, I want `revisedBy` stored in task state, so that the context command can inject the right review file during revision.

### Observability

57. As a developer, I want to run `chainflow state` to see all step states for the active task, so that I can understand where the workflow is at a glance.
58. As a developer, I want `chainflow state` to show each step's `generates` file path and whether it exists, so that I can diagnose missing outputs.
59. As a developer, I want `chainflow state` to show `requires` dependencies for blocked steps, so that I understand what is blocking progress.
60. As a developer, I want to run `chainflow list flows` to see all available flows, so that I can choose the right one for a task.
61. As a developer, I want to run `chainflow list tasks` to see all tasks and their completion status, so that I can track work across multiple tasks.
62. As a developer, I want `list tasks` to indicate which task is active, so that I know the current session context.
63. As an AI agent, I want `chainflow state` to be runnable at any point to verify current state, so that I can self-diagnose before taking action.

---

## Implementation Decisions

### Module Breakdown

**`output.ts`** — Centralized stdout/stderr. Every output pattern is a named function. No `console.log` or `console.error` anywhere else in the codebase. Output is structured plain text, agent-readable, and every successful command ends with the exact next command to run.

**`flow/`** — Flow config Zod schema, flow loader (reads and validates a flow YAML), flow validator (dependency graph checks, missing file checks). Returns parsed, typed data. Throws on invalid config.

**`task/`** — Task state Zod schema, task state reader/writer (reads/writes `.taskState.yaml`), active task resolver (finds the task with `active: true`). All I/O functions live here. State transition logic lives in `graph/`.

**`graph/`** — Dependency graph builder, topological sort, circular dependency detection, step unblocking logic (which blocked steps become ready after a completion), transitive cascade logic (which steps become ready after a revision). Pure functions that accept parsed data and return results — no filesystem access.

**`schema/`** — Generates `schema/chainflow-flow.schema.json` from the flow Zod schema at build time using `zod-to-json-schema`. Output is checked into the repo and shipped in the npm package.

**`ide/`** — Three writers: VS Code (`yaml.schemas` in `.vscode/settings.json`), JetBrains (`.idea/jsonSchemas.xml`), Zed (`file_associations` in `.zed/settings.json`). Each writer receives the resolved schema path and writes the appropriate config. Since IDE writing is only triggered from `init`, this logic may live directly in the init command file rather than as a standalone module — the decision is left to implementation.

**`commands/init.ts` (refactor)** — Refactored to: use `output.ts`, prompt for IDE selection via `@inquirer/prompts`, prompt for bundled flow selection, copy selected flows into the project, write IDE config, and produce descriptive output for each action taken.

**`commands/validate.ts`** — Delegates entirely to `flow/` for validation logic. Prints structured pass/fail output. Usable by both developers and AI agents.

**`commands/start.ts`** — Creates task directory and initial `.taskState.yaml`. Sets task active. Deactivates previously active task.

**`commands/next.ts`** — Reads active task state, finds ready steps via graph logic, formats output with subagent instructions if applicable.

**`commands/context.ts`** — Assembles the full context string for a step: reads instruction file, inlines references, inlines upstream step outputs, handles revision state, assembles the validates block in the correct order (validated files → generates instruction → evaluate+command instructions).

**`commands/complete.ts`** — Updates step state to `done`, finds newly unblocked steps, writes updated task state.

**`commands/revise.ts`** — Increments revision count, checks against `maxRevisions`, updates step state to `revision`, runs transitive cascade, writes updated task state.

**`commands/state.ts`** — Reads task state and flow config, formats tabular output.

**`commands/list.ts`** — Two subcommands: `flows` (reads all flow dirs) and `tasks` (reads all task dirs).

### Key Architectural Decisions

- **Functional, no classes.** All domain logic is plain exported functions.
- **Domain functions throw; commands catch at the boundary.** `output.error()` + `process.exit(1)` at the command level only.
- **Graph module is pure.** No filesystem access — accepts parsed flow config and task state, returns results. This makes cascade and unblocking logic fully testable without mocking.
- **All paths resolved from `process.cwd()`.** Not `__dirname`. Constants live in `constants.ts`.
- **Active task switching.** Any command that accepts `--task <name>` sets that task `active: true` and sets the previously active task to `active: false` before proceeding.
- **`Try<T>` type deleted.** `fileIo.ts` refactored to throw on failure instead.
- **Bundled flows** are shipped inside the npm package (in a `flows/` directory at package root) and copied to the user's project on init based on their selection.
- **SchemaStore submission** is a one-time PR to the SchemaStore GitHub repository adding a `catalog-v1` entry pointing to `chainflow-flow.schema.json`. The submission follows SchemaStore's standard contribution guide.

### Context Command — `validates` Block Ordering

When a step has `validates` set, the context output order is:

1. Validated step files (inlined content to evaluate)
2. `generates` instruction (what file to produce, which strategy)
3. Evaluation instruction: "Evaluate each step above, pass or fail. First run `chainflow complete`. Then for each failing step run `chainflow revise`."
4. Completion command

This ordering ensures the agent reads input → knows its output → receives its action sequence, in a natural linear flow.

### TypeScript Strictness

The following flags are currently commented out in `tsconfig.json` and must be enabled as part of this implementation:

- `noUnusedLocals`
- `noUnusedParameters`
- `noImplicitReturns`
- `noFallthroughCasesInSwitch`

---

## Testing Decisions

### What makes a good test

Tests verify observable external behavior, not implementation details. A good test calls a domain function with specific inputs and asserts on the return value or thrown error. Tests must remain valid when the implementation is refactored. Do not assert on internal state or mock internal calls within the same module.

### TDD approach

All implementation follows red-green-refactor: write a failing test first, implement the minimum to make it pass, then refactor.

### Modules to test

**`graph/`** — Highest priority. Test:
- Topological sort produces correct ordering
- Cycle detection throws on circular `requires`
- Unblocking logic: correct steps become `ready` after a `complete`
- Transitive cascade: correct steps become `ready` after a `revise`
- Cascade correctly handles steps already in `ready`, `done`, and `revision` states

**`flow/`** — Test:
- Valid flow config parses without error
- Invalid configs (missing fields, wrong types) throw with clear messages
- `validate` detects unknown step references in `requires`, `context.steps`, `validates`
- `validate` detects missing instruction files

**`task/`** — Test:
- Task state reads and writes round-trip correctly
- Active task resolution finds the correct task
- Active task resolution throws when no active task exists
- Revision count increment and `maxRevisions` enforcement

**Integration tests** — Commands wired against a real temporary filesystem (vitest temp directory utilities). Test:
- `start` creates the correct directory and state file
- `complete` writes updated state and unblocks correct steps
- `revise` writes updated state and cascades correctly
- `context` assembles correct output for a step in each state (ready, revision)
- `validate` passes on a valid project and fails on an invalid one

---

## Out of Scope

- Specific bundled flow content (the flows themselves are a separate authoring effort)
- The actual SchemaStore PR content (it is a one-time manual submission)
- Remote task sharing or multi-user collaboration
- A web UI or dashboard
- Any LLM integration within `chainflow` itself — it is purely a CLI tool that structures prompts for external agents
- Claude Code skills mentioned in `docs/plan.md` ("skill that teaches agents how to use chainflow", "skill to scaffold a new flow interactively") — future work

---

## Further Notes

- The `validate` command serves both developers (pre-flight check) and AI agents (self-diagnosis). Its output should be readable by both audiences.
- The `yaml` npm package must be used for all YAML I/O — not `js-yaml` — because it preserves comments on round-trip, which matters for hand-edited flow configs.
- `verbatimModuleSyntax` is enabled in `tsconfig.json` — use `import type` for all type-only imports.
- The existing `fileIo.ts` utilities use the `Try<T>` type and call `console.log` directly; both must be corrected as part of the `init` refactor.
