# CLI Reference

All commands are invoked as `agentflow <command> [options]`.

---

## Setup

### `agentflow init`

Initializes agentflow in the current project.

- Creates the `agentFlow/` directory structure
- Copies bundled flows (`plan`, `vsdd`)
- Installs the AI agent skill file
- Generates the JSON schema for `.agentflow.yaml`
- Prompts you to select your IDE and configures YAML schema validation

**Options**

| Flag | Description |
|---|---|
| `--default` | Non-interactive mode. Skips bundled flow selection, IDE config, and AI tool integration. |

#### Paths written by `agentflow init`

All paths are resolved relative to `process.cwd()` — the directory where you run the command.

**Project structure** (always created)

| Path | Description |
|---|---|
| `agentFlow/` | Root folder for all agentflow state |
| `agentFlow/.agentflow.yaml` | Root config file (created from template if absent) |
| `agentFlow/tasks/` | Task state directory — one subfolder per task |
| `agentFlow/flows/` | Flow config directory — one subfolder per flow |
| `agentFlow/flows/<flow-name>/` | Copied from bundled flow templates (if selected) |

**IDE schema validation** (one of the following, based on your selection)

| IDE | Path written |
|---|---|
| VS Code | `.vscode/settings.json` — adds a `yaml.schemas` entry pointing to the CDN schema |
| JetBrains | `.idea/jsonSchemas.xml` — adds a `JsonSchemaMappingsProjectConfiguration` block |
| Zed | `.zed/settings.json` — adds a `file_associations` entry pointing to the CDN schema |

All three map the schema to `agentFlow/flows/*/.agentflow.yaml`.

> **VS Code** requires the [Red Hat YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) (`redhat.vscode-yaml`) for `yaml.schemas` to take effect — the setting is ignored without it. JetBrains and Zed support schema mapping natively with no extension required.

**AI tool integration** (one of the following, based on your selection)

| AI tool | Root | Paths written |
|---|---|---|
| Claude Code | `.claude/` | `.claude/skills/agentflow/SKILL.md`, `.claude/skills/agentflow-optimize/SKILL.md`, `.claude/skills/agentflow-flow/SKILL.md`, `.claude/agents/<flow-agent-files>` |
| Cursor | `.cursor/` | `.cursor/skills/agentflow/SKILL.md`, `.cursor/skills/agentflow-optimize/SKILL.md`, `.cursor/skills/agentflow-flow/SKILL.md`, `.cursor/agents/<flow-agent-files>` |
| Windsurf | `.windsurf/` | `.windsurf/skills/agentflow/SKILL.md`, `.windsurf/skills/agentflow-optimize/SKILL.md`, `.windsurf/skills/agentflow-flow/SKILL.md`, `.windsurf/agents/<flow-agent-files>` |

**Claude Code only** — two additional files are written:

| Path | Description |
|---|---|
| `~/.claude/settings.json` | Global Claude Code settings — adds `Bash(agentflow:*)` and `Bash(npx agentflow:*)` to `permissions.allow` |
| `.claude/settings.local.json` | Project-local settings — sets `permissions.defaultMode`, `env.BASH_DEFAULT_TIMEOUT_MS`, and `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` |

`init` never overwrites existing content silently — if a file already exists with different content, you are prompted to confirm before any change is made.

---

## Task lifecycle

### `agentflow start --task <name> [--flow <name>]`

Creates a new task and sets it as active.

| Flag | Description |
|---|---|
| `--task <name>` | Short slug for the task (e.g. `auth-module`, `payment-refactor`) |
| `--flow <name>` | Flow to run the task against. Defaults to the project's `defaultFlow` |

### `agentflow list tasks`

Lists all tasks with their completion status. The currently active task is marked.

### `agentflow state [--task <name>]`

Shows all steps for the active (or named) task: status, generated file paths, and whether those files exist on disk. Safe to call at any time for self-diagnosis.

| Flag | Description |
|---|---|
| `--task <name>` | Target task. Defaults to the active task |

---

## Agent loop

### `agentflow next [--task <name>] [--parallel]`

Returns the next open step and the exact command to run next.

| Flag | Description |
|---|---|
| `--task <name>` | Switch the active task |
| `--parallel` | Return all currently open steps for parallel execution |

When all steps are done, outputs:
```
Task complete: <task-name>
All steps are done.
```

### `agentflow context --step <name> [--task <name>]`

Returns everything needed to complete a step: instructions, reference files, upstream outputs, and the exact completion command. The agent must read this in full before starting work.

| Flag | Description |
|---|---|
| `--step <name>` | Step to get context for |
| `--task <name>` | Target task. Defaults to the active task |

The last line of the output is always the exact `agentflow complete` command to run — use it verbatim.

### `agentflow complete --step <name> [--task <name>]`

Marks a step as done. Automatically unblocks downstream steps whose dependencies are now satisfied.

| Flag | Description |
|---|---|
| `--step <name>` | Step to mark complete |
| `--task <name>` | Target task. Defaults to the active task |

### `agentflow revise --step <name> --from <reviewing-step> [--task <name>]`

Marks a step for revision and resets all transitively dependent steps. Used by validator steps after evaluating another step's output. Respects `maxRevisions` — warns and exits without state change if the cap is reached.

| Flag | Description |
|---|---|
| `--step <name>` | Step to revise |
| `--from <name>` | The validator step that flagged the revision |
| `--task <name>` | Target task. Defaults to the active task |

---

## Flows

### `agentflow list flows`

Lists all available flows in the project.

### `agentflow validate [--flow <name>]`

Validates one or all flow config files. Checks for:
- Circular dependencies
- Missing instruction files
- Unknown step references

| Flag | Description |
|---|---|
| `--flow <name>` | Validate a specific flow. Validates all flows if omitted |

---

## Step states

```
blocked → open → done
                    ↓          ↑
                 revision ──────
```

| State | Meaning |
|---|---|
| `blocked` | Dependencies not yet complete — do not work on this step |
| `open` | All dependencies met — this is the next step to work on |
| `done` | Completed |
| `revision` | A validator step flagged it — rework required |
