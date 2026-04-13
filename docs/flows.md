# Creating flows

A flow is a directory containing an `.agentflow.yaml` config file and an `instructions/` folder. Flows live under `agentFlow/flows/` in your project.

```
agentFlow/
  flows/
    my-flow/
      .agentflow.yaml
      instructions/
        step-one.md
        step-two.md
```

---

## Flow config

```yaml
name: plan
description: Lightweight planning workflow
maxRevisions: 2

steps:
  - name: research
    description: Explore the codebase and understand the problem
    required: false
    requires: []
    generates: research.md
    generateStrategy: replace
    subagent: false
    pauseAfter: false
    context:
      instructions: research.md
      references:
        - docs/architecture.md
      steps: []
    validates: []

  - name: plan
    description: Create a clear, actionable implementation plan
    required: true
    requires:
      - research
    generates: plan.md
    generateStrategy: replace
    context:
      instructions: plan.md
      steps:
        - research      # inlines the full output
        - research:ref  # inlines only a reference/summary
    validates:
      - research
```

### Flow fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique flow identifier |
| `description` | string | Human-readable description of the flow |
| `maxRevisions` | number | Maximum number of revisions allowed per step |

### Step fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Unique step identifier within the flow |
| `description` | string | no | What this step does |
| `required` | boolean | no | Whether the step must complete before the task finishes |
| `requires` | string[] | no | Steps that must complete before this one can start |
| `generates` | string | no | Output file name written to the task directory |
| `generateStrategy` | `replace` \| `update` \| `version` | no | How the output file is written: overwrite, append, or version |
| `subagent` | boolean \| string | no | Subagent to assign this step to; `true` uses the default, a string names a specific agent |
| `pauseAfter` | boolean | no | Pause the workflow after this step completes and wait for user input |
| `context.instructions` | string | yes | Instruction file injected into the agent's context for this step |
| `context.references` | string[] | no | Arbitrary file paths to include in context (relative to the flow directory) |
| `context.steps` | string[] | no | Prior step outputs to include as context; append `:ref` for a reference-only summary |
| `validates` | string[] | no | Steps whose output this step is expected to validate; supports `:ref` suffix |

---

## Step dependencies

Steps form a directed acyclic graph via `requires`. A step stays `blocked` until all its dependencies are `done`. When a step completes, agentflow automatically unblocks any downstream steps whose dependencies are now satisfied.

```
research ──→ plan
```

Circular dependencies are rejected by `agentflow validate`.

---

## Context injection

Each step receives context assembled from three sources:

- **`context.instructions`** — the primary instruction file for the step, read from `instructions/<filename>` inside the flow directory
- **`context.references`** — arbitrary files included verbatim (useful for architecture docs, schemas, etc.)
- **`context.steps`** — outputs from prior steps; two injection modes:
  - `stepName` — inlines the full generated file
  - `stepName:ref` — inlines only a brief reference/summary

---

## Validator steps

A step with a `validates` list is a validator — it evaluates the outputs of other steps rather than producing new work. When the agent runs a validator step:

1. It receives the outputs of every listed step in its context
2. It evaluates each one: pass or fail
3. It calls `agentflow complete` on itself
4. For each failing step it calls `agentflow revise --step <name> --from <validator>`

The engine then resets the failing step and all its dependents back to `blocked`, respecting `maxRevisions`.

---

## Subagents

Setting `subagent: true` on a step tells the orchestrator to spawn a dedicated agent for that step. A string value (e.g. `subagent: code-writer`) names a specific agent role defined in the flow's `agents/` directory.

The orchestrator spawns the subagent with the step's full context and waits for it to return before continuing the flow. Multiple parallel-ready subagent steps can be spawned simultaneously.

---

## Validating a flow

After editing a flow config, run:

```sh
agentflow validate --flow <name>
```

This checks for circular dependencies, missing instruction files, and unknown step references.
