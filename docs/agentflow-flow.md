# Creating and modifying flows with agentflow-flow

The `agentflow-flow` skill is a conversational tool for designing, creating, and modifying agentflow flows. Instead of hand-writing YAML and instruction files, you describe what you want and the skill interviews you, proposes a structure, and writes everything once you approve it.

It is installed by `agentflow init` alongside the main agentflow skill.

---

## When to use it

- You want to create a new flow from scratch
- You want to add, remove, or restructure steps in an existing flow
- A flow's instruction files aren't producing the results you expect
- You need to design a multi-step AI pipeline and want a guided process

---

## Invoking the skill

```
/agentflow-flow
```

You can describe what you want upfront or let the skill ask:

```
/agentflow-flow create a flow for code review
/agentflow-flow add a validation step to the plan flow
/agentflow-flow the research step in my flow isn't detailed enough
```

---

## What it does

### Creating a new flow

#### Phase 1: Structure

The skill starts by asking what the flow should **produce** and **why** you need it. It follows up with a targeted question or two, then immediately proposes a complete structure — concrete and specific enough to react to.

The proposed structure is presented in a readable format before any files are written:

```
Flow: code-review
Description: Automated code review pipeline
Max revisions: 2

Steps:
  1. research (optional)
     Does: Explore the diff and gather context
     Depends on: —
     Produces: research.md
     Context: gets nothing (first step)
     Pause after: no

  2. review (required)
     Does: Produce a detailed review with findings and suggestions
     Depends on: research
     Produces: review.md
     Context: gets research.md (full)
     Pause after: yes
```

You can request changes — add steps, rename them, change dependencies, toggle pause points. The skill iterates until you approve.

#### Phase 2: Instructions

Once the structure is approved, the skill works through each step in dependency order, drafting a substantive instruction file for each one. Each draft is shown inline for your review before anything is written to disk.

A good instruction file tells the agent:
- What it is trying to accomplish and why
- What to produce: format, structure, level of detail
- What context it is receiving and how to use it
- What counts as done and what to avoid

After you approve each draft (or ask for changes), the skill writes the file and moves to the next step.

#### Finishing up

After all files are written, the skill runs `agentflow validate --flow <name>` and fixes any issues. It then offers to set the new flow as the project default.

---

### Modifying an existing flow

The skill reads the current flow config and presents its structure before discussing any changes. It then makes targeted edits — only what you asked to change — and re-validates.

If a new step is added, its instruction file is drafted through the same phase 2 process. If a step's purpose changed significantly, the skill offers to re-draft its instruction file. Unchanged steps are left alone.

---

## Key principles

- **Draft first, refine after.** The skill proposes a concrete structure after two or three questions, not ten. A structure you can react to is more useful than exhaustive upfront planning.
- **Nothing is written until you approve.** The YAML and each instruction file are shown inline and only written once you confirm.
- **Targeted edits when modifying.** The skill never regenerates the whole flow — it edits only what changed and updates every reference that needs to follow.
- **Validates before finishing.** Every session ends with `agentflow validate` to catch structural problems before you run the flow.
