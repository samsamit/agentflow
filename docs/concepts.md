# Agentflow Concepts

## Why agent tasks fail without orchestration

Complex multi-step tasks expose a consistent set of failure modes when an AI agent works without structure:

- **Skipping steps** — the agent jumps to implementation without researching first, or writes code before finishing the plan
- **Working out of order** — a dependent step gets worked before the thing it depends on is ready
- **Context loss** — earlier outputs are forgotten, so later steps ignore what was already decided
- **No recovery path** — when work needs to be revised, the agent doesn't know which downstream steps are now invalid
- **No completion signal** — the agent doesn't know when the task is done, or what to do next

Agentflow is a workflow orchestrator that sits between the agent and the task. It removes all of these failure modes by design.

---

## The dependency model

Every step in a flow declares its `requires` — the steps that must be complete before this one can begin. Agentflow enforces this automatically:

- Steps with no `requires` start as `ready` when a task is created
- All other steps start as `blocked`
- When a step is marked `done`, Agentflow evaluates which blocked steps now have all their requirements satisfied and sets them to `ready`

This means the agent never has to reason about ordering. It calls `agentflow next`, gets back exactly what is ready to work on, and proceeds. The graph handles everything else.

### Parallel execution

When multiple steps become unblocked at the same time, `agentflow next --parallel` returns all of them. The agent can spawn subagents to work on them concurrently, then continue when they are all complete.

---

## Context injection

Every step has a `context` block that declares what the agent needs to do the work:

```yaml
context:
  instructions: plan.md          # step-specific instruction file
  references:                    # static files from the project root
    - src/types.ts
  steps:                         # outputs from completed upstream steps
    - research
    - task-breakdown
```

When the agent calls `agentflow context --step <name>`, Agentflow assembles all of this into a single output:
- The full content of the instruction file
- The content of each reference file, labelled
- The content of each upstream step's generated output, labelled

The agent receives everything it needs in one call. It never has to explore the filesystem or read files itself.

---

## Generates, requires, and validates — three separate concerns

These three fields in a step definition serve distinct purposes:

**`requires`** — controls *when* a step can run. It's a dependency declaration. A step that `requires` another will not become `ready` until the dependency is `done`.

**`generates`** — declares *what a step produces*. It is a relative path to the output file the agent should write when completing this step. The path is resolved inside the task directory, e.g. `tasks/my-feature/plan.md`. Agentflow uses this to tell the agent where to write output, to show file status in `agentflow state`, and to inject outputs into downstream context.

**`validates`** — marks a step as a *reviewer*. A validator step does not produce new work — it evaluates the outputs of other steps and passes or fails them. After completing a validator step, the agent calls `agentflow revise` for each step that failed. This triggers the revision cascade.

Keeping these separate lets you compose flows where implementation and review are fully decoupled, and where different reviewers can validate different subsets of the work.

---

## The revision cascade

When a step is marked for revision, Agentflow:

1. Sets that step's state to `revision`, carrying the name of the reviewer and the revision count
2. Finds all steps that transitively depend on the revised step
3. Sets all of them back to `ready`

This means the agent automatically reworks from the revision point forward — it doesn't need to reason about which downstream steps are now stale.

`maxRevisions` caps how many times a step can be revised. Once the cap is reached, further revision requests are ignored with a warning. This prevents infinite loops on intractable disagreements.

---

## Instruction files

Each step's instructions live in a Markdown file inside the flow's `instructions/` directory. These are authored by you, not by Agentflow.

Good instruction files:
- State clearly what the step should produce
- Describe the format and structure of the output file
- List any constraints or decision criteria
- Reference upstream steps by name if the output depends on them

The instruction file is the place to encode your domain knowledge, your team's standards, and your quality bar. The better the instructions, the better the agent output.

---

## State persistence

Task state is stored in `agentFlow/tasks/<task-name>/.taskState.yaml`. This means:

- Progress survives agent restarts and session interruptions
- Multiple tasks can exist simultaneously (only one is active at a time)
- State can be inspected at any time with `agentflow state`

The state file tracks each step's current status (`ready`, `blocked`, `done`, `revision`), the revision count, and which step triggered the revision.

---

## Subagents

Some steps are better handled by a specialized agent. A step can declare `subagent: true` or `subagent: <agent-name>` to signal this. When `agentflow next` returns such a step, it outputs spawn instructions instead of the usual `context` command.

The spawned subagent is given the `agentflow context --step <name> --task <name>` command with an explicit `--task` flag, because subagents start without an active task. From that point, the subagent follows the normal loop independently.

This enables multi-agent architectures where different specialized agents handle different phases of a workflow — for example, a builder agent for implementation steps and an adversary agent for review steps.
