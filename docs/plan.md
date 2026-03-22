# ChainFlow CLI — Implementation Plan

## Overview

`agentflow` is an agent-first CLI workflow engine. It lets users define multi-step workflows (flows) and run tasks through them. An AI agent calls `agentflow` commands to navigate the workflow, get injected context for each step, and track progress. The tool enforces dependency order, cascades revisions downstream, and injects all necessary context so the agent never needs to explore on its own.

---

## Directory Structure

```
agentFlow/
├── .agentflow.yaml              ← root config (defaultFlow name)
├── flows/
│   └── <flow-name>/
│       ├── .agentflow.yaml      ← flow definition with steps
│       └── instructions/
│           └── <step-name>.md   ← instruction file per step
└── tasks/
    └── <task-name>/
        └── .taskState.yaml      ← task state tracking
```

---

## Configuration Schemas

### Root config — `agentFlow/.agentflow.yaml`

```yaml
defaultFlow: plan
```

### Flow config — `agentFlow/flows/<name>/.agentflow.yaml`

```yaml
name: plan
description: Standard planning workflow
maxRevisions: 3                               # max times any step can be revised before revision is ignored

steps:
  - name: research
    description: Research the problem domain
    required: true
    requires: []                          # steps that must be done first
    generates: research.md                # resolved to agentFlow/tasks/<task-name>/research.md
    generateStrategy: replace             # update | replace | version
    subagent: false                       # false = no subagent | true = generic subagent | string = named subagent (label only, passed through to orchestrator)
    context:
      instructions: research.md          # resolved to agentFlow/flows/<flow-name>/instructions/research.md
      references:
        - docs/requirements.md
      steps: []                           # inject generated files from these steps
    validates: []                         # steps this step evaluates (pass/fail)

  - name: plan
    description: Create implementation plan
    required: true
    requires:
      - research
    generates: plan.md
    generateStrategy: replace
    context:
      instructions: plan.md
      steps:
        - research                        # injects research.md content into context
    validates: []

  - name: task-breakdown
    description: Break plan into actionable tasks
    required: true
    requires:
      - plan
    generates: tasks.md                   # checkbox task list; resolved to agentFlow/tasks/<task-name>/tasks.md
    generateStrategy: replace
    context:
      instructions: task-breakdown.md
      steps:
        - plan

  - name: implement
    description: Implement according to tasks
    requires:
      - task-breakdown
    context:
      instructions: implement.md
      steps:
        - task-breakdown                  # injects tasks.md so agent follows checkboxes

  - name: review
    description: Review implementation
    requires:
      - implement
    validates:
      - research
      - plan
      - implement
    context:
      instructions: review.md
      steps:
        - plan
        - implement
```

### Task state — `agentFlow/tasks/<name>/.taskState.yaml`

```yaml
active: true
flow: plan
steps:
  research:
    state: revision       # ready | done | blocked | revision
    revisionCount: 2      # omitted when 0
    revisedBy: review     # step that triggered the revision; omitted when not in revision state
  plan:
    state: ready
  task-breakdown:
    state: blocked
  implement:
    state: blocked
  review:
    state: blocked
```

---

## Step States

| State | Meaning |
|-------|---------|
| `ready` | All dependencies done, can be worked on now |
| `blocked` | Waiting for one or more `requires` steps to complete |
| `done` | Completed |
| `revision` | Marked for rework |

### State transition rules

- On `start`: steps with no `requires` → `ready`; all others → `blocked`
- On `complete --step <name>`: step → `done` (valid from both `ready` and `revision` states); check all blocked steps — if all their `requires` are now `done`, unblock them → `ready`
- On `revise --step <name>`: increment step `revisionCount`; if `revisionCount` exceeds flow's `maxRevisions`, ignore the revision entirely (no state change, output a warning); otherwise step → `revision`, cascade all transitively dependent steps → `ready` (they must be redone because their upstream changed)

---

## Commands

### `agentflow init`
Initializes the project structure.

**Already implemented.**

---

### `agentflow validate [--flow <name>]`

Developer utility. Not part of task workflow.

- Without `--flow`: validates entire project structure
  - Root `.agentflow.yaml` exists and is valid
  - `flows/` and `tasks/` folders exist
  - All flows are individually valid
- With `--flow <name>`: validates one flow
  - All step `requires` reference real step names in the same flow
  - No circular dependencies in `requires` chains
  - All `instructions` file paths exist
  - All `context.steps` reference real step names

---

### `agentflow start [--task <name>] [--flow <name>]`

Creates a new task and sets it as active.

- `--task`: task name (required — no default, must be named)
- `--flow`: optional, defaults to `defaultFlow` from root config
- If `agentFlow/tasks/<name>/` already exists: error out — `Error: Task "<name>" already exists.`
- Creates `agentFlow/tasks/<name>/` folder
- Writes `.taskState.yaml` with all steps initialized (`ready` or `blocked`)
- Sets this task as `active: true`; sets previously active task to `active: false`

**Output:**
```
Task started: my-feature
Flow: plan
Active steps: research
Run: agentflow next
```

---

### `agentflow next [--task <name>] [--parallel]`

Gets the next step(s) to work on.

- `--task`: optional, defaults to active task; if given, sets that task as active
- `--parallel`: return all currently `ready` steps instead of just the first

**Output (single):**
```
Step: research
Status: ready
Run: agentflow context --step research
```

**Output (with named subagent):**
```
Step: research
Status: ready
Subagent: spawn subagent "researcher"
Then run: agentflow context --step research --task my-feature
```

**Output (with generic subagent):**
```
Step: research
Status: ready
Subagent: spawn a subagent
Then run: agentflow context --step research --task my-feature
```

**Output (--parallel, no subagents):**
```
Steps ready for parallel execution:
- research: run agentflow context --step research
- setup: run agentflow context --step setup
```

**Output (--parallel, with subagents):**
```
Steps ready for parallel execution. Spawn a subagent for each step below:
- research: spawn subagent "researcher", then run agentflow context --step research --task my-feature
- setup: spawn subagent "setup", then run agentflow context --step setup --task my-feature
Run all subagents in parallel before proceeding.
```

**Output (all done):**
```
Task complete: my-feature
All steps are done.
```

---

### `agentflow context --step <name> [--task <name>]`

Outputs full context for a step, meant to be injected directly into an agent prompt.

- `--task`: optional, defaults to active task; if given, sets that task as active

**What gets injected:**

1. Step name and description
2. If step state is `revision`: outputs the following block:
   - "This step is being revised. It was marked for revision by step \"<revisedBy>\"."
   - "Previously generated output (<generates-file>):" + inlines the step's existing generated file
   - "Review feedback (<revisedBy-generates-file>):" + inlines the generated file of the `revisedBy` step
   - "Rework this step based on the review feedback above."
3. Contents of the step's `instructions` file
4. For each path in `references`: inlines the file content; paths are resolved relative to the working directory (project root) where `agentflow` is invoked
5. For each step in `context.steps`:
   - If step is `done` and file exists: inlines the content of that step's generated file
   - If step is optional (`required: false`) and not `done`: outputs "Note: Optional step \"<name>\" was not completed — skipping context injection."
   - If step is required and `done` but file is missing: error out — `Error: Generated file for step "<name>" not found: <path>`
6. If `validates` is set: inlines the generated file of each validated step, followed by: "Evaluate each of the above steps and decide pass or fail. First run: `agentflow complete --step <this-step> --task <task>`. Then, for each step that fails, run: `agentflow revise --step <name> --from <this-step> --task <task>`"
7. If `generates` is set: "This step must generate the file: <path>. Strategy: <strategy instruction>"
   - `update`: "An existing version exists. Update it in place."
   - `replace`: "An existing version exists. Replace it entirely."
   - `version`: "An existing version exists. Rename it to <file>.v<n>.<ext> before writing the new version." (`<n>` = current `revisionCount` from `.taskState.yaml`)
8. "When this step is complete, run: `agentflow complete --step <name> --task <task>`"

---

### `agentflow complete --step <name> [--task <name>]`

Marks a step as done and unblocks downstream steps.

- `--task`: optional, defaults to active task; if given, sets that task as active
- Marks step → `done`; clears `revisedBy` field if present
- Finds all `blocked` steps whose `requires` are now all `done` → marks them `ready`

**Output:**
```
Step complete: research
Unblocked: plan
Run: agentflow next
```

---

### `agentflow revise --step <name> --from <step> [--task <name>]`

Marks a step for revision and cascades downstream.

- `--step`: the step to mark for revision (required)
- `--from`: the step that is triggering the revision (required); stored as `revisedBy` in task state
- `--task`: optional, defaults to active task; if given, sets that task as active
- Increments step `revisionCount` in `.taskState.yaml` (field omitted when 0)
- If `revisionCount` now exceeds flow's `maxRevisions`: ignore the revision, output a warning, do not change any state
- Otherwise: marks step → `revision`; stores `revisedBy: <from-step>` in the step's state (cleared when step transitions out of `revision`); finds all steps that transitively depend on this step → marks them `ready` (regardless of their current state — `done`, `blocked`, or `revision`)

**Output:**
```
Step marked for revision: research (revision 2/3)
Cascaded to ready: plan, task-breakdown, implement, review
Run: agentflow next
```

**Output (max revisions reached):**
```
Warning: Step "research" has reached the maximum number of revisions (3/3). Revision ignored.
Run: agentflow next
```

---

### `agentflow state [--task <name>]`

Shows the current state of all steps in a task.

- `--task`: optional, defaults to active task; if given, sets that task as active

**Output:**
```
Task: my-feature
Flow: plan
Active: true

Steps:
research        done        generates: research.md → tasks/my-feature/research.md [exists]
plan            ready       generates: plan.md → tasks/my-feature/plan.md [missing]
task-breakdown  blocked     requires: plan
implement       blocked     requires: task-breakdown
review          blocked     requires: implement
```

---

### `agentflow list flows`

Lists all available flows in the project.

**Output:**
```
Flows:
plan        Standard planning workflow
research    Deep research workflow
```

---

### `agentflow list tasks`

Lists all tasks and their current status.

**Output:**
```
Tasks:
my-feature    (active)    flow: plan    steps: 2/5 done
other-task                flow: plan    steps: 5/5 done
```

---

## Behavior Conventions

### Optional flags
- `--task`: optional on all commands except `start`. Defaults to the active task. If provided, sets that task as active.
- `--flow`: optional on `start`. Defaults to `defaultFlow` in root config.

### Agent-first output
- All output is structured plain text, designed to be injected into agent prompts
- Every output ends with the exact next command to run
- Errors exit with non-zero code and include the exact fix command

**Error example:**
```
Error: No active task found.
Run: agentflow start --task <name>
```

---

## Implementation Order

### Phase 1 — Foundation
- Install `yaml` npm package for runtime YAML parsing (read/write `.agentflow.yaml` and `.taskState.yaml`)
- Flow schema (Zod) for `flows/<name>/.agentflow.yaml`
- Task state schema (Zod) for `.taskState.yaml`
- Flow loader (read + parse + validate flow config)
- Task state reader/writer utilities
- Active task resolution utility
- Dependency graph builder + circular dependency detection
- `validate` command

### Phase 2 — Task lifecycle
- `start` command

### Phase 3 — Core workflow loop
- `next` command
- `complete` command

### Phase 4 — Context delivery
- `context` command (instruction injection, reference injection, step output injection, generates instruction, validates instruction)

### Phase 5 — Observability & revision
- `state` command
- `revise` command (with transitive cascade)
- `list flows` command
- `list tasks` command

---

## Future
- Claude Code skill that teaches agents how to use `agentflow`
- Claude Code skill to scaffold a new flow interactively
