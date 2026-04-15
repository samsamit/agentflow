---
name: agentflow-flow
description: Conversational tool for creating and modifying agentflow flows. Use this skill when the user wants to create a new flow, design a workflow, add steps to an existing flow, restructure a flow, or fix problems with a flow's structure or instructions. Invoke it when the user describes a workflow they want to automate, says something like "I need a flow for X", "create a flow", "modify the X flow", "add a step", "my flow isn't working the way I want", or uses /agentflow-flow.
user-invocable: true
disable-model-invocation: true
---

# Agentflow Flow

Use this skill to author agentflow flows through conversation. You'll first design the flow structure together with the user, then write each step's instruction file one at a time. The result is a ready-to-run flow.

## Before you start

Check that `agentFlow/` exists in the project root. If it doesn't, the project hasn't been initialized — tell the user to run `agentflow init` first and stop.

Then determine the mode: are you **creating** a new flow or **modifying** an existing one? The user's phrasing usually makes this clear. If uncertain, check `agentFlow/flows/` for a flow matching any name the user mentioned.

---

## Creating a new flow

### Phase 1: Structure

**1. Interview the user before drafting.**
Before proposing any structure, spend a few turns understanding what the user actually needs. The point isn't to gather every detail upfront — it's to avoid building obviously the wrong thing. Once you have a plausible picture, draft. A concrete structure to react to is more useful than more questions.

Start with **what** and **why**:
- **What** does the flow produce — the end result or deliverable?
- **Why** do they need it — what problem does it solve? This is the most valuable question: the motivation behind the request often reveals constraints or required steps the user didn't think to mention.

If the answers to those leave secondary questions open, follow up with:
- **What already exists** — are there files, tools, or artifacts the flow should consume or produce?
- **Who reviews it** — does the user want to pause and check output between steps, or should it run hands-off?

Don't ask all of these at once. Ask one or two, follow up based on the answers. Two or three exchanges is enough — stop when you have a plausible picture.

If the user has already described the goal, named or implied the key steps, and given a reason or context for the flow, skip the interview and go straight to step 2.

**2. Draft a full structure without waiting for permission.**
From what you've learned, produce a proposed flow with all fields filled in. Present it as a human-readable structure, not raw YAML:

```
Flow: <name>
Description: <what it does>
Max revisions: 2

Steps:
  1. research (optional)
     Does: Explore the codebase and gather context
     Depends on: —
     Produces: research.md
     Context: gets nothing (first step)
     Pause after: no

  2. plan (required)
     Does: Produce a concrete implementation plan
     Depends on: research
     Produces: plan.md
     Context: gets research.md (full)
     Pause after: no

  3. implement (required)
     Does: Execute the plan
     Depends on: plan
     Produces: implementation notes in changes.md
     Context: gets plan.md (full), research.md (summary only)
     Pause after: no
```

Apply sensible defaults:
- `generateStrategy: replace` is the default — it overwrites the output file each time the step runs. Use `update` if the step is appending progress to a running log (e.g. an implementation log that accumulates entries). Use `version` if the user needs to compare outputs across revisions — it creates timestamped copies rather than overwriting.
- If step B requires step A, inject A's output into B's context. Use `:ref` for steps more than one hop back — this injects a short summary rather than the full content. The agent doesn't need the raw text of an early step when a later step has already synthesized it.
- Mark terminal steps `required: true`; optional steps (like research) can be skipped without blocking completion.
- `pauseAfter: true` only if the user mentions wanting to review before continuing.

**3. Iterate until the user approves the structure.**
Ask: "Does this look right? Anything to add, remove, or restructure?" Make changes and re-present as needed. Don't move on until the user says the structure is good.

**4. Write the YAML.**
Once approved, write `agentFlow/flows/<name>/.agentflow.yaml`. The flow name must match the directory name.

```yaml
name: <name>
description: <description>
maxRevisions: 2

steps:
  - name: research
    description: Explore the codebase and gather context
    required: false
    requires: []
    generates: research.md
    generateStrategy: replace
    context:
      instructions: research.md
      steps: []
    validates: []

  - name: plan
    description: Produce a concrete implementation plan
    required: true
    requires:
      - research
    generates: plan.md
    generateStrategy: replace
    context:
      instructions: plan.md
      steps:
        - research
    validates: []
```

Omit optional fields that aren't needed (e.g., `subagent`, `pauseAfter`, `references`) rather than writing them as `false` or `[]` — it keeps the file readable.

---

### Phase 2: Instructions

Work through each step in dependency order. For each step:

**1. Ask any genuinely missing questions — but only if needed.**
You already know the step name, description, what it generates, and what context it receives. That's usually enough. Only ask upfront if something critical is unclear — for example, the expected output format isn't obvious, or you're unsure whether the step is producing a document vs. running code.

**2. Draft the instruction file.**
Write a substantive draft — not a placeholder. A good instruction file includes:
- What the agent is trying to accomplish and why it matters in this flow
- What it should produce: format, structure, level of detail
- What context it's receiving and how to use it
- Any constraints: what to avoid, what counts as done, when to stop

Show the draft inline in the conversation.

**Example of a good instruction file** (for a `plan` step that receives `research.md`):

```markdown
# Plan

Your goal is to turn the research into a concrete, actionable implementation plan.

## Context you have
- `research.md` — a summary of the codebase, existing patterns, and constraints
  found during exploration. Use it to ground your plan in what's actually there,
  not what you assume.

## What to produce
A `plan.md` file containing:
1. A one-paragraph problem statement
2. A numbered list of implementation steps, each with:
   - What to do
   - Which files to touch
   - Any gotchas or ordering constraints
3. A short "out of scope" section — what this plan explicitly does not do

## Definition of done
The plan is specific enough that an agent could execute it without asking
clarifying questions. If a step says "update the auth module", that's too vague.
"Add a `refreshToken` field to `src/auth/session.ts` and update the
`createSession` function to populate it" is concrete enough.
```

**3. Ask for feedback.**
"Does this capture the intent? What should I change?"

**4. Iterate, then write.**
Once the user approves (or accepts with no changes), write the file to `agentFlow/flows/<name>/instructions/<filename>`. The filename must match what's in `context.instructions` for that step.

**5. Move to the next step.**

---

### Finishing up

After all instruction files are written:

1. **Validate:** Run `agentflow validate --flow <name>`. If it fails, fix the issues — circular dependencies, missing instruction files, unknown step references — without asking the user unless the fix requires a design decision.

2. **Default flow:** Read `agentFlow/.agentflow.yaml`. If `defaultFlow` doesn't already point to this flow, ask: "Set this as the default flow?" — yes or no, nothing more.

---

## Modifying an existing flow

The user might describe a problem ("the review step is too slow"), a structural change ("add a parallelism step"), or a targeted fix ("the research instructions aren't detailed enough").

**1. Read and show the current structure.**
Read `agentFlow/flows/<name>/.agentflow.yaml` and present the current structure in the same human-readable format used in phase 1. This gives the user a clear picture of what exists before discussing changes.

**2. Understand the change.**
Ask what the user wants to change if it isn't already clear. Don't re-interview the whole flow — focus on the specific problem or addition.

**3. Make targeted edits.**
Edit only what needs to change. If a step is renamed, update every reference to it across the YAML (`requires`, `validates`, `context.steps`). Don't regenerate the whole file.

**4. Update instruction files only where needed.**
If a new step was added, write its instruction file (follow the phase 2 process). If a step's purpose changed significantly, offer to re-draft its instruction file. Leave everything else alone.

**5. Validate.** Run `agentflow validate --flow <name>` and fix any issues.

---

## Flow YAML reference

```yaml
name: string                         # slug, must match directory name
description: string                  # optional but recommended
maxRevisions: number                 # max revision cycles per step, default 2

steps:
  - name: string                     # unique within this flow
    description: string              # what this step does
    required: boolean                # must complete for task to finish
    requires: [step-name, ...]       # steps that must be done first
    generates: filename.md           # output file written to the task directory
    generateStrategy: replace | update | version
    subagent: true | "agent-name"    # spawn a subagent for this step
    pauseAfter: boolean              # pause and wait for user before continuing
    context:
      instructions: filename.md      # instruction file — required on every step
      references: [path/to/file, ...]  # static files to inject verbatim
      steps: [step-name, step-name:ref, ...]  # prior step outputs to inject
                                              # plain step-name = full content
                                              # step-name:ref   = summary only
    validates: [step-name:ref, ...]  # steps this step reviews (validator pattern — see below)
```

### `:ref` — summary injection

Appending `:ref` to a step name in `context.steps` injects a short summary of that step's output instead of the full content. Use this for steps that are more than one hop back in the dependency chain — the full text of an early step is rarely needed once a later step has synthesized it.

### `validates` — validator steps

A step with a non-empty `validates` list is a **validator**: its job is to review the listed steps' outputs and decide whether they need revision. The validator receives summaries (`:ref`) of the named steps as its context. If it finds problems, it calls `agentflow revise --step <name> --from <this-step>` to send a step back for rework. Validator steps have no `context.steps` entry — they use `validates` instead.

When designing a validator step, don't give it `context.steps` — it only needs what's in `validates`. Every entry in `validates` must use `:ref`.
