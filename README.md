# agentflow

[![npm version](https://img.shields.io/npm/v/agentflow)](https://www.npmjs.com/package/agentflow)
[![CI](https://github.com/samsamit/agentflow/actions/workflows/ci.yml/badge.svg)](https://github.com/samsamit/agentflow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A workflow engine for AI agents. Define tasks as dependency graphs, let the agent follow the steps.**

Agentflow keeps agents on track through complex multi-step tasks by enforcing dependency order, injecting all necessary context per step, and tracking state persistently across sessions. Every command output ends with the exact next command to run — the agent never needs to explore the filesystem.

---

## Why Agentflow?

Complex agent tasks fail in predictable ways: the agent skips a step, works out of order, loses context between calls, or doesn't know what to do after completing a step.

Agentflow solves this by acting as a **workflow orchestrator** between the agent and the task:

- **Enforces dependency order** — steps only unlock when their prerequisites are complete
- **Injects context automatically** — instructions, referenced files, and upstream outputs are assembled and delivered per step
- **Tracks state persistently** — progress survives across sessions and agent restarts
- **Cascades revisions** — revisiting an upstream step automatically requeues all downstream dependents
- **Coordinates parallel work** — multiple steps can run concurrently when dependencies allow

→ [How it works in depth](docs/concepts.md)

---

## Installation

```bash
npm install -g agentflow
```

---

## Quick Start

```bash
# 1. Initialize in your project
agentflow init

# 2. Validate the setup
agentflow validate

# 3. Start a task
agentflow start --task my-feature --flow plan

# 4. Let the agent drive
agentflow next
agentflow context --step research
agentflow complete --step research
# ... repeat until done
```

---

## How It Works

### 1. Define a flow

Flows live in `agentFlow/flows/<flow-name>/.agentflow.yaml`. Each flow defines steps with dependencies, instructions, and context sources.

```yaml
name: plan
description: Standard planning and implementation workflow
maxRevisions: 3

steps:
  - name: research
    description: Investigate the problem domain
    requires: []
    generates: research.md
    context:
      instructions: research.md

  - name: plan
    description: Create an implementation plan
    requires:
      - research
    generates: plan.md
    context:
      instructions: plan.md
      steps:
        - research        # injects research.md output into context

  - name: implement
    description: Build it
    requires:
      - plan
    context:
      instructions: implement.md
      steps:
        - plan

  - name: review
    description: Review and validate the work
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

### 2. Start a task

```bash
agentflow start --task my-feature --flow plan
```

Agentflow initializes state for each step, sets the task as active, and tells you which steps are immediately ready.

### 3. Work through steps

```
$ agentflow next

Step: research
Status: ready
Run: agentflow context --step research
```

```
$ agentflow context --step research

<context step="research" task="my-feature" description="Investigate the problem domain">

<instructions>
[full content of agentFlow/flows/plan/instructions/research.md]
</instructions>

<generates file="agentFlow/tasks/my-feature/research.md" strategy="replace">
Create this file.
</generates>

<next-command>agentflow complete --step research --task my-feature</next-command>

</context>
```

```
$ agentflow complete --step research

Step complete: research
Unblocked: plan
Run: agentflow next
```

### 4. Handle revisions

If a review step finds problems with earlier work:

```bash
agentflow revise --step plan --from review
```

Agentflow marks `plan` for revision and requeues all steps that depend on it (`implement`, `review`) back to `ready`. The agent reworks from that point forward.

---

## Bundled Flows

Agentflow ships with two production-ready flows copied into your project during `agentflow init`.

| Flow | Steps | Use case |
|------|-------|----------|
| `plan` | 5 | General feature development: research → plan → task breakdown → implement → review |
| `vsdd` | 10 | Verified Spec-Driven Development: formal spec, TDD, adversarial review gates, formal hardening |

→ [Full flow documentation](docs/flows.md)

---

## Commands

### `agentflow init`

Initializes the project workspace interactively.

- Creates `agentFlow/flows/` and `agentFlow/tasks/` directories
- Generates `schema/agentflow-flow.schema.json` for YAML validation
- Optionally copies a bundled example flow
- Prompts to configure IDE support (VS Code, JetBrains, Zed)
- Prompts to inject the Agentflow skill into your AI tool (`.claude`, `.cursor`, `.windsurf`)

---

### `agentflow validate [--flow <name>]`

Validates the project configuration.

| Flag | Description |
|------|-------------|
| _(none)_ | Validates all flows, step references, and dependency graphs |
| `--flow <name>` | Validates a single named flow |

Checks: root config exists, all flow YAMLs are valid, no circular dependencies, all referenced instruction files exist, all `context.steps` references resolve.

---

### `agentflow start --task <name> [--flow <name>]`

Creates a new task and initializes its step states.

| Flag | Description |
|------|-------------|
| `--task <name>` | (required) Unique task identifier |
| `--flow <name>` | Flow to use; defaults to `defaultFlow` from root config |

Sets the task as the active task. Steps with no `requires` start as `ready`; others start as `blocked`.

---

### `agentflow next [--task <name>] [--parallel]`

Returns the next step(s) ready to work on.

| Flag | Description |
|------|-------------|
| `--task <name>` | Sets that task as active before resolving |
| `--parallel` | Returns all ready steps for parallel execution |

If a step requires a subagent, outputs spawn instructions. If all steps are done, reports task completion.

---

### `agentflow context --step <name> [--task <name>]`

Assembles and outputs the full context for a step.

| Flag | Description |
|------|-------------|
| `--step <name>` | (required) Step name |
| `--task <name>` | Defaults to active task |
| `--debug` | Lists each source file with line and token counts instead of printing content |

Context is emitted as structured XML tags so the agent can unambiguously identify each section. Includes: instructions, referenced files, upstream step outputs, revision feedback if the step is being reworked, and the file the step must generate.

`:ref` entries in `context.steps` and `validates` emit a file pointer tag instead of inlining the content — useful for large outputs where inlining would bloat the context window.

---

### `agentflow complete --step <name> [--task <name>]`

Marks a step as done and unblocks downstream steps.

| Flag | Description |
|------|-------------|
| `--step <name>` | (required) Step name |
| `--task <name>` | Defaults to active task |

---

### `agentflow revise --step <name> --from <step> [--task <name>]`

Marks a step for revision and cascades changes downstream.

| Flag | Description |
|------|-------------|
| `--step <name>` | (required) Step to revise |
| `--from <step>` | (required) Step that triggered the revision |
| `--task <name>` | Defaults to active task |

All steps that transitively depend on `<name>` are set back to `ready`. If `revisionCount` exceeds the flow's `maxRevisions`, the revision is ignored and a warning is emitted.

---

### `agentflow state [--task <name>]`

Shows the current state of all steps in a task.

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

Lists all available flows.

### `agentflow list tasks`

Lists all tasks and their progress.

```
Tasks:
my-feature    (active)    flow: plan    steps: 2/5 done
other-task                flow: plan    steps: 5/5 done
```

---

## Flow Schema Reference

```yaml
name: string                    # Flow identifier
description: string             # Optional description
maxRevisions: number            # Max revisions before ignoring further requests

steps:
  - name: string                # Step identifier (unique within flow)
    description: string         # Optional description
    required: boolean           # Whether step must complete (default: true)
    requires: string[]          # Step names that must be done first
    generates: string           # Relative path to output file
    generateStrategy: enum      # replace | update | version (default: replace)
    subagent: boolean | string  # Spawn a subagent for this step
    validates: string[]         # Steps this step reviews (pass/fail).
                                # Append ":ref" to inject a file reference instead of inlining
                                # (e.g. "implement:ref"). Agent is instructed to read the file
                                # before making a pass/fail decision.
    context:
      instructions: string      # Path to instruction file (relative to flow dir)
      references: string[]      # Files to inline into context (relative to project root)
      steps: string[]           # Upstream step names whose outputs to inject.
                                # Append ":ref" to inject a file reference instead of inlining
                                # the full content (e.g. "research:ref"). Useful for large outputs.
```

### `generateStrategy`

| Value | Behavior |
|-------|----------|
| `replace` | Overwrite the output file entirely (default) |
| `update` | Update the file in place |
| `version` | Rename old file to `<name>.v<n>.<ext>`, write new version |

---

## Step States

| State | Meaning |
|-------|---------|
| `ready` | All dependencies done; can be worked on now |
| `blocked` | Waiting for one or more `requires` steps to complete |
| `done` | Complete |
| `revision` | Marked for rework; carries reviewer feedback |

---

## Project Structure

After `agentflow init`, your project will contain:

```
<project-root>/
├── agentFlow/
│   ├── .agentflow.yaml          ← root config (defaultFlow)
│   ├── flows/
│   │   └── plan/
│   │       ├── .agentflow.yaml  ← flow definition
│   │       └── instructions/
│   │           ├── research.md
│   │           ├── plan.md
│   │           ├── task-breakdown.md
│   │           ├── implement.md
│   │           └── review.md
│   └── tasks/
│       └── my-feature/
│           ├── .taskState.yaml  ← persisted step states
│           ├── research.md      ← generated outputs
│           └── plan.md
└── schema/
    └── agentflow-flow.schema.json
```

---

## IDE Support

`agentflow init` can configure YAML schema validation for your IDE so you get autocomplete and inline errors when editing flow files.

| IDE | Config written |
|-----|---------------|
| VS Code | `.vscode/settings.json` (`yaml.schemas`) |
| JetBrains | `.idea/jsonSchemas.xml` |
| Zed | `.zed/settings.json` (`file_associations`) |

The schema is also submitted to [SchemaStore](https://www.schemastore.org), so VS Code picks it up automatically via the YAML extension without manual setup.

---

## AI Tool Integration

During `agentflow init`, you can inject the Agentflow skill files into your AI tool's config directory. This teaches the agent exactly how and when to use Agentflow commands, so it never has to guess.

Supported tools: Claude (`.claude`), Cursor (`.cursor`), Windsurf (`.windsurf`).

Two skills are injected:

**`agentflow`** — the core workflow skill. Teaches the agent the command loop, step states, revision handling, subagent orchestration, and validator patterns.

**`agentflow-optimize`** — an instruction optimization skill. After a step completes, invoke this skill to compare the step's instruction file against what it actually produced. It identifies gaps (missing coverage, ambiguous instructions, missing context, redundant sections), presents a numbered list of specific improvements with exact rewrites, and applies approved changes directly to the instruction file.

```
# Example usage after a step completes
"Optimize the research step instructions based on what it produced"
"The plan step needed 2 revisions — can you tighten up its instructions?"
"Tune the spec-review instructions based on the output it generated"
```

---

## Documentation

- [Concepts](docs/concepts.md) — dependency model, context injection, revision cascade, subagents
- [Bundled Flows](docs/flows.md) — `plan` and `vsdd` in depth, customization guide

---

## Contributing

Issues and pull requests are welcome. Please open an issue before submitting large changes.

---

## License

MIT — [Samu Tiainen](https://github.com/samsamit)
