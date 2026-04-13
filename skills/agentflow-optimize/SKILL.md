---
name: agentflow-optimize
description: Analyzes a completed agentflow step's instruction file against its generated artifact to identify gaps and suggest improvements. Use this skill whenever the user wants to improve, refine, or tune a step's instructions — especially after a step required multiple revisions, when the artifact doesn't fully match what the step's description promised, or when the user wants to make a flow perform better on future runs. If the user mentions improving instructions, tightening up a step, or reducing the number of revisions a flow requires, this is the skill to use.
user-invocable: true
disable-model-invocation: true
---

# Agentflow Optimize

Use this skill to improve a step's instruction file by comparing it against what the step actually produced. The goal is to close the gap between what the instructions intended and what the agent generated.

## Workflow

### 1. Identify the step and flow

Determine the step name and flow name from what the user provided:

- If the user specified both a step name and a flow name, use them.
- If the user specified only a step name, ask: "Which flow does that step belong to? (leave blank to use the default flow)"
- If the user specified neither, ask: "Which step do you want to optimize, and which flow does it belong to? (flow is optional — leave blank to use the default flow)"

If no flow name is given, read `agentFlow/.agentflow.yaml` and use the `defaultFlow` value. Confirm to the user which flow you are targeting before continuing.

### 2. Locate the files

Read `agentFlow/flows/<flow-name>/.agentflow.yaml` to find the step's config entry. You need:
- `description` — the intended goal of the step (may be absent; that's fine)
- `context.instructions` — the instruction filename (e.g. `research.md`)
- `generates` — the artifact filename (e.g. `research.md`)

Resolve paths:
- Instruction file: `agentFlow/flows/<flow-name>/instructions/<context.instructions>`
- Artifact file: `agentFlow/tasks/<task-name>/<generates>`

To find the active task, scan `agentFlow/tasks/` — read each `.taskState.yaml` and find the one with `active: true`. Note the task name and the step's `state` and `revisionCount`.

**Stop conditions:**
- If the step's state is not `done` → inform the user and stop. Only completed steps can be optimized.
- If `generates` is absent on the step → inform the user and stop. Optimization requires a generated artifact to compare against.
- If the artifact file does not exist on disk → inform the user and stop.

### 3. Read the instruction file and artifact

Read the instruction file at the resolved path.

Read the artifact file at the resolved path.

### 4. Analyze and present optimization points

Compare the artifact against two baselines:
1. **Step description** — what the step was supposed to produce
2. **Instruction file** — how the agent was told to produce it

Look for these categories of issues:

- **Missing coverage**: things the description or instructions required that the artifact doesn't address
- **Ambiguous instructions**: sections that could be interpreted multiple ways, evidenced by the artifact making unexpected or inconsistent choices
- **Missing context**: information the agent clearly needed (visible from what ended up in the artifact) that wasn't in the instructions
- **Redundant instructions**: sections the agent ignored or that produced no corresponding artifact content
- **Structural clarity**: ordering, examples, constraints, or output format guidance that would make the instructions easier to follow

If `revisionCount` is greater than 0, call it out at the top — it is a strong signal that something in the instructions caused repeated confusion.

Present your findings as a **numbered list**. Each item must include:
- A label for the category (e.g. "Missing coverage", "Ambiguous instruction")
- A direct quote of the relevant line or section from the instruction file (or note its absence)
- A concrete, specific suggestion — not "clarify this" but the actual rewrite or addition

### 5. Ask for approval

After presenting the optimization points, ask:

> Should I apply these changes to the instruction file? (yes to apply all, or list the numbers you want applied)

Wait for the user's response before making any edits.

### 6. Apply approved changes

Edit the instruction file directly at `agentFlow/flows/<flow-name>/instructions/<context.instructions>`.

Make focused, surgical edits — do not rewrite the entire file unless the user explicitly asks for a full rewrite. Apply only the points the user approved.

After editing, briefly summarize what was changed.

## Key principles

- **Only optimize done steps.** If the step hasn't completed, there is no artifact to compare against.
- **The artifact is ground truth.** Base analysis on what was actually produced, not assumptions about what should have been.
- **Be specific.** Quote exact lines. Propose exact rewrites. Vague suggestions add no value.
- **Preserve intent.** Optimize for clarity and completeness, not to change what the step is supposed to do.
- **One step at a time.** Each invocation targets a single step.
