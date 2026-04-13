# Optimizing flows

The `agentflow-optimize` skill analyzes a completed step's instruction file against the artifact it generated, identifies gaps, and proposes targeted improvements. Use it after a flow run to make a step perform better on future runs.

It is installed by `agentflow init` alongside the main agentflow skill.

---

## When to use it

- A step required multiple revisions before the agent got it right
- The artifact the agent produced doesn't fully match what the step description promised
- Instructions feel vague or were interpreted inconsistently
- You want to reduce revision counts on future runs of the same flow

---

## Invoking the skill

```
/agentflow-optimize
```

The skill will ask which step and flow to target if you haven't specified them. You can provide either or both upfront:

```
/agentflow-optimize optimize the research step
/agentflow-optimize optimize the research step in the plan flow
```

If no flow is given, the skill falls back to your project's `defaultFlow` (from `agentFlow/.agentflow.yaml`) and confirms which flow it is targeting before proceeding.

---

## What it does

### 1. Identifies the step and flow

Resolves both from what you provided. If either is missing, it asks. If no flow is given, it reads `agentFlow/.agentflow.yaml` and uses `defaultFlow`, then confirms the target before continuing.

### 2. Locates the files

Reads `agentFlow/flows/<flow>/.agentflow.yaml` to find:
- The step's **instruction file** (`agentFlow/flows/<flow>/instructions/<file>`)
- The step's **generated artifact** (`agentFlow/tasks/<task>/<generates>`)

The active task is determined by scanning `agentFlow/tasks/` for the entry with `active: true`.

**Stop conditions** — the skill will stop and explain if:
- The step's state is not `done` (there is no artifact to compare against yet)
- The step has no `generates` field (nothing was produced)
- The artifact file does not exist on disk

### 3. Analyzes and presents findings

Compares the artifact against the instruction file and the step's description, looking for:

| Category | What it flags |
|---|---|
| Missing coverage | Things the instructions required that the artifact didn't address |
| Ambiguous instructions | Sections that could be read multiple ways, evidenced by unexpected agent choices |
| Missing context | Information the agent clearly needed that wasn't provided |
| Redundant instructions | Sections the agent ignored or that produced no corresponding artifact content |
| Structural clarity | Ordering, examples, constraints, or output format guidance that would help |

If `revisionCount` is greater than 0, the skill highlights this at the top — it is a strong signal that something in the instructions caused repeated confusion.

Findings are presented as a **numbered list**. Each item includes:
- The issue category
- A direct quote from the instruction file (or a note that something is absent)
- A concrete proposed rewrite or addition — not "clarify this" but the exact change

### 4. Asks for approval

```
Should I apply these changes to the instruction file?
(yes to apply all, or list the numbers you want applied)
```

No edits are made until you confirm.

### 5. Applies approved changes

Makes focused, surgical edits to the instruction file. Only the approved points are applied unless you ask for a full rewrite.

---

## Key principles

- **Only completed steps can be optimized.** Optimization compares instructions against what was actually produced.
- **The artifact is ground truth.** Analysis is based on what the agent produced, not assumptions.
- **Specific suggestions only.** Every finding includes an exact proposed change — no vague advice.
- **Intent is preserved.** The goal is clarity and completeness, not changing what the step is supposed to do.
- **One step per invocation.** Run the skill once for each step you want to improve.
