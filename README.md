```
                          _    __ _               
  __ _  __ _  ___ _ __  | |_ / _| | _____      __
 / _` |/ _` |/ _ \ '_ \ | __| |_| |/ _ \ \ /\ / /
| (_| | (_| |  __/ | | || |_|  _| | (_) \ V  V / 
 \__,_|\__, |\___|_| |_| \__|_| |_|\___/ \_/\_/  
        |___/                                     
```

<div align="center">

**An agent-first CLI workflow engine for multi-step AI pipelines.**

[![npm version](https://img.shields.io/npm/v/@samsamit/agentflow)](https://www.npmjs.com/package/@samsamit/agentflow)
[![npm downloads](https://img.shields.io/npm/dm/@samsamit/agentflow)](https://www.npmjs.com/package/@samsamit/agentflow)
[![license](https://img.shields.io/npm/l/@samsamit/agentflow)](./LICENSE)
[![node](https://img.shields.io/node/v/@samsamit/agentflow)](https://nodejs.org)

</div>


## Table of contents

- [Install](#install)
- [Using with an AI agent](#using-with-an-ai-agent)
- [Quick start](#quick-start)
- [IDE schema support](#ide-schema-support)
- **Docs**
  - [Creating flows](docs/flows.md) — flow config, context injection, validators, subagents
  - [CLI reference](docs/cli.md) — all commands and flags
  - **Bundled flows**
    - [plan](docs/flows/plan.md) — lightweight planning: explore, interview, produce a plan
    - [vsdd](docs/flows/vsdd.md) — Verified Spec-Driven Development: spec → TDD → adversarial review → formal hardening



## What?

`agentflow` lets you define multi-step workflows in YAML and run AI agents through them. The engine enforces dependency order, cascades revisions downstream, and injects all necessary context into each step — so your agent never needs to explore the codebase on its own.

## Install

```sh
npm install -g @samsamit/agentflow
```

## Using with an AI agent

`agentflow` is designed to be driven by an AI agent, not a human. The agent calls `agentflow` commands to navigate the workflow — The tool provides everything the agent needs at each step.

### The agentflow skill

`agentflow init` installs a **skill file** into your project that teaches your AI agent how to use agentflow correctly. The skill is invoked with the `/agentflow` slash command:

```
/agentflow run the plan flow on this task
```

The agent will:

1. Check for an existing active task (`agentflow list tasks`)
2. Start a new task if needed (`agentflow start --task <name> --flow plan`)
3. Loop through steps automatically:
   - `agentflow next` — find the next ready step
   - `agentflow context --step <name>` — receive full instructions + upstream outputs
   - Do the work described in the context
   - `agentflow complete --step <name>` — mark done, unblock dependents
4. Stop when `agentflow next` reports the task is complete

### Modes

**Autonomous** (default) — the agent loops from start to finish without pausing. Use this when you say "run it", "go", or "do the whole flow".

**Step-by-step** — the agent completes one step, reports what it did and what's next, then waits for you to say "continue". Use this when you want to review each output before proceeding.

### Subagents

Steps can declare a `subagent` — a specialized agent role for that step (e.g. a code writer, an adversarial reviewer). When the orchestrator agent encounters a subagent step, it spawns a new agent with the full step context and waits for it to return before continuing the flow. Parallel-ready steps can be executed by parallel subagents simultaneously.

### Revisions

When a validator step finds issues in a prior step's output, it calls `agentflow revise`. The engine marks the failing step for rework and automatically resets all downstream steps that depended on it. The agent then loops back and reworks only what changed.

---

## Quick start

### 1. Initialize agentflow in your project

```sh
agentflow init
```

This creates the `agentFlow/` directory, installs the skill file for your AI agent, copies the bundled flows, and prompts you to select your IDE for YAML schema support (VS Code, JetBrains, or Zed).

### 2. Choose or create a flow

Two bundled flows are included:

- **`plan`** — Lightweight planning: explore the problem, produce an actionable plan.
- **`vsdd`** — Verified Spec-Driven Development: a full AI-orchestrated pipeline combining spec writing, TDD, adversarial review, and formal verification.

You can define your own flow by creating a directory under `agentFlow/flows/` with an `.agentflow.yaml` file.

### 3. Run a flow

Invoke the skill with the `/agentflow` slash command and tell it which flow to run:

```
/agentflow run the plan flow on my-feature
```

The agent drives the workflow from start to finish. You can also start a task manually from the CLI:

```sh
agentflow start --task my-feature --flow plan
```

---

## IDE schema support

`agentflow init` configures YAML schema validation for your editor so you get autocomplete and validation when editing `.agentflow.yaml` files.

Supported editors: **VS Code**, **JetBrains**, **Zed**.

---