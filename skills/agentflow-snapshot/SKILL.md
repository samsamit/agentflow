---
name: agentflow
description: Use this skill whenever you see a agentFlow/ directory in a project, when the user asks you to work on a task using agentflow, or when any agentflow command appears (agentflow start, agentflow next, agentflow context, agentflow complete, agentflow revise, agentflow state). Agentflow is a workflow engine that manages step order, injects all context, and tracks state for AI agents. Always use this skill when agentflow is involved — it tells you exactly what to do and when. Never explore the project yourself when agentflow is running; the tool provides everything you need.
---

# Agentflow

Agentflow is a CLI workflow engine for AI agents. It tells you what step to work on, injects all the context you need, and tracks state. **Never explore the project yourself when agentflow is running** — if something seems missing, it is a flow config issue, not something you should work around.

## The agent loop

This is the loop you follow for every task, every time:

1. **`agentflow next`** — find out which step to work on
2. **`agentflow context --step <name>`** — get full instructions, references, and upstream outputs for that step
3. **Do the work** — follow the instructions exactly as given
4. **`agentflow complete --step <name>`** — mark the step done; agentflow unblocks downstream steps automatically
5. **Repeat from 1** until agentflow reports the task is complete

The last line of every `agentflow context` output is the exact `agentflow complete` command to run — use it verbatim.

## Step states

```
blocked → ready → done
                    ↓          ↑
                 revision ──────
```

- **blocked** — dependencies not yet done; do not work on it
- **ready** — dependencies met; this is your next step
- **done** — completed
- **revision** — a validator step flagged it; rework required

When a step is in `revision` state, `agentflow context` automatically injects the previous output and reviewer feedback. Just follow the loop — revision steps are handled the same way as normal steps.

## Commands

### The core three (you use these every step)

```
agentflow next [--task <name>] [--parallel]
```
Returns the next ready step and the exact command to run next. `--parallel` returns all currently ready steps for parallel execution. `--task` switches the active task.

```
agentflow context --step <name> [--task <name>]
```
Returns everything needed to complete a step: instructions, reference files, upstream outputs, and the completion command. Read this output fully before starting work.

```
agentflow complete --step <name> [--task <name>]
```
Marks a step done. Automatically finds which blocked steps are now unblocked and sets them to ready.

### Revision

```
agentflow revise --step <name> --from <reviewing-step> [--task <name>]
```
Marks a step for revision and cascades resets to all transitively dependent steps. Used by validator steps after evaluating another step's output. Respects `maxRevisions` — warns and exits without state change if the cap is reached.

### Task lifecycle

```
agentflow start --task <name> [--flow <name>]
```
Creates a new task. If `--flow` is omitted, uses the project's `defaultFlow`. Sets the new task as active and deactivates any previously active task.

### Observability

```
agentflow state [--task <name>]
```
Shows all steps with status, generates file paths, and whether those files exist on disk. Call this any time for self-diagnosis — it is always safe.

```
agentflow list flows
agentflow list tasks
```
Lists available flows, or all tasks with completion status (active task is marked).

```
agentflow validate [--flow <name>]
```
Validates flow config(s) — checks for circular dependencies, missing instruction files, unknown step references. Run after editing a flow config.

### Setup

```
agentflow init
```
Initializes a new agentflow project: creates directory structure, generates JSON schema, copies bundled flows, configures IDE YAML support and AI tool skill file.

## Validator steps

Some steps have a `validates` field — they evaluate the outputs of other steps rather than producing new work. When `agentflow next` returns a validator step:

1. Run `agentflow context --step <name>` — it inlines the files to evaluate
2. Evaluate each listed step: pass or fail
3. Run `agentflow complete --step <name>` first
4. Then for each failing step: `agentflow revise --step <failing-step> --from <validator-step>`

The context output tells you exactly which commands to run and in what order.

## Subagents

When `agentflow next` returns a step with a subagent instruction, it looks like:

```
Step: implement-feature
Subagent: spawn subagent "code-writer"
Then run: agentflow context --step implement-feature --task <task-name>
```

**You are the orchestrator.** Spawn the subagent with the prompt below, then wait for it to return, then loop back to `agentflow next`. Do not continue yourself while the subagent is running.

### Subagent prompt

Give the subagent this exact prompt, filling in the step name, task name, and any extra context the user provided before the step:

---

> You are handling a single agentflow step. Complete this step and stop — do not continue to any other step.
>
> **User context:** <any extra instructions or context the user gave before this step — omit this line if none>
>
> 1. Run: `agentflow context --step <step-name> --task <task-name>`
> 2. Read the entire output — it contains your instructions, reference files, and any upstream outputs you need
> 3. Do the work described, keeping the user context above in mind
> 4. Run: `agentflow complete --step <step-name> --task <task-name>`
>
> After step 4 you are done. Return a brief summary of what you produced. **Do not run `agentflow next`. Do not start any other step.**

---

### Parallel subagents

When `agentflow next --parallel` returns multiple ready steps that each need a subagent, spawn all of them simultaneously using parallel Agent tool calls — one per step, each with the prompt above (including the same user context). Wait for all to return before looping back to `agentflow next`.

## When the task is complete

When all steps are done, `agentflow next` outputs:

```
Task complete: <task-name>
All steps are done.
```

Stop the loop. Do not call `agentflow next` again.

## Key principles

- **Agentflow tells you everything.** Do not read files or explore the project to fill gaps.
- **Follow the loop.** `next` → `context` → work → `complete` → repeat.
- **Use exact commands.** The last line of `agentflow context` output is the exact completion command.
- **`--task` switches context.** Any command that accepts `--task <name>` sets that task active.
- **Subagents need `--task`.** A spawned subagent has no active task — always pass `--task <name>`.
