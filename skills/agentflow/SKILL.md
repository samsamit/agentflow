---
name: agentflow
description: Agentflow is a workflow engine that manages step order, injects all context, and tracks state for AI agents. Always use this skill when agentflow is involved — it tells you exactly what to do and when. Never explore the project yourself when agentflow is running; the tool provides everything you need.
user-invocable: true
disable-model-invocation: true
---

# Agentflow

Agentflow is a CLI workflow engine for AI agents. It tells you what step to work on, injects all the context you need, and tracks state. **Never explore the project yourself when agentflow is running** — if something seems missing, it is a flow config issue, not something you should work around.

## Getting started

Before jumping into the loop, orient yourself:

1. **Check for an existing task** — run `agentflow list tasks` to see if there's already an active task the user wants to resume. If there is, go straight to the loop.
2. **Start a new task if needed** — run `agentflow start --task <name> [--flow <name>]`. Use a short slug for the task name derived from the user's request (e.g., `auth-module`, `payment-refactor`). If `--flow` is omitted, agentflow uses the project's default flow. Run `agentflow list flows` to see available flows if you're unsure which to use.
3. **Choose a mode** — see the section below.

If `agentFlow/` doesn't exist at all, the project hasn't been initialized yet. Run `agentflow init` and wait for it to complete before doing anything else.

## Modes

How you run the loop depends on what the user wants:

**Autonomous mode** (default): Loop continuously from start to finish without pausing between steps. Spawn subagents whenever the flow requires them. Keep going until `agentflow next` reports the task is complete. This is the right call when the user says "run it", "go", "run everything", "do the whole flow", or when the flow has many steps and named subagents — stopping after every step would just slow things down without adding value.

**Step-by-step mode**: Complete one step, then stop. After each `agentflow complete`, report what you just finished and what's coming next, then wait for the user to say "continue", "next", or "keep going". Use this when the user says "step by step", "one at a time", "walk me through it", or wants to review or approve each output before proceeding.

When the user's intent is ambiguous, default to autonomous. If they want to slow down at any point they can say so.

## The agent loop

The loop is the same in both modes — what changes is whether you pause after each step:

1. **`agentflow next`** — find out which step to work on next
2. **`agentflow context --step <name>`** — get full instructions, reference files, and upstream outputs for that step; read the entire output before starting
3. **Do the work** — follow the instructions exactly as given
4. **`agentflow complete --step <name>`** — mark the step done; agentflow automatically unblocks downstream steps
5. **Continue or pause**:
   - *Autonomous*: go back to step 1
   - *Step-by-step*: report what was completed and what's next, then stop and wait

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

When a step is in `revision` state, `agentflow context` automatically injects the previous output and reviewer feedback. Just follow the loop — revision steps work the same as normal steps.

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

**You are the orchestrator.** Spawn the subagent with the prompt below, then wait for it to return, then loop back to `agentflow next`. The subagent handles only that one step — it never calls `agentflow next` or advances the flow on its own.

### Subagent prompt

Give the subagent this exact prompt, filling in the step name, task name, and any extra context the user provided:

---

> You are handling a single agentflow step. This may be a regular step (you produce work) or a validator step (you evaluate another step's output and flag it for revision). Complete this step and stop — do not continue to any other step.
>
> **User context:** <any extra instructions or context the user gave before this step — omit this line if none>
>
> **Before starting:** if the `TaskCreate` tool is available, create these three tasks as your checklist:
> - "Run agentflow context"
> - "Do the work"
> - "Run agentflow complete"
>
> 1. Run: `agentflow context --step <step-name> --task <task-name>` — mark "Run agentflow context" done
> 2. Read the entire output in full — it contains your instructions, reference files, upstream outputs, and the exact commands to run when done. If the output lists any `agentflow revise` commands, create a task for each one now (e.g. "Run agentflow revise --step <name>") before continuing.
> 3. Do the work described, keeping the user context above in mind — mark "Do the work" done
> 4. Run the `agentflow complete` command — use the **exact command from the last line of the context output**; copy it verbatim, do not reconstruct it — mark "Run agentflow complete" done
> 5. Run every revise task you created in step 2, in order, marking each done as you go
>
> Clear every task before returning. Return a brief summary of what you produced. **Do not run `agentflow next`. Do not start any other step.**

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
- **Orient before looping.** Check for an existing task and choose a mode before running the first `agentflow next`.
- **Follow the loop.** `next` → `context` → work → `complete` → repeat (or pause in step-by-step).
- **Use exact commands.** The last line of `agentflow context` output is the exact completion command.
- **`--task` switches context.** Any command that accepts `--task <name>` sets that task active.
- **Subagents need `--task`.** A spawned subagent has no active task — always pass `--task <name>`.
