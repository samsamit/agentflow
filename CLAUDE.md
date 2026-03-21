# ChainFlow — Agent Guidelines

## What this project is

`chainflow` is an agent-first CLI workflow engine. It lets users define multi-step workflows (flows) in YAML and run tasks through them. An AI agent calls `chainflow` commands to navigate the workflow, receive injected context for each step, and track progress. The tool enforces dependency order, cascades revisions downstream, and injects all necessary context so the agent never needs to explore on its own.

The full command specification and flow/task state schemas are in `docs/plan.md`. Read it before implementing any command.

---

## Stack

| Concern | Tool |
|---|---|
| Language | TypeScript (ESM, `"type": "module"`) |
| Bundler | `tsdown` (OXC/Rolldown-powered) |
| CLI parsing | `commander` |
| Schema validation | `zod` |
| YAML I/O | `yaml` |
| Interactive prompts | `@inquirer/prompts` |
| JSON Schema export | `zod-to-json-schema` |
| Testing | `vitest` |
| Linting + Formatting | `biome` |

---

## Module structure

```
src/
  commands/     ← thin CLI handlers only (parse args → call domain → print output)
  flow/         ← flow config loading, Zod schema, validation
  task/         ← task state read/write, active task resolution
  graph/        ← dependency graph, topological sort, cycle detection, cascade logic
  schema/       ← JSON Schema generation from Zod schemas (zod-to-json-schema)
  ide/          ← IDE config writers: vscode.ts, jetbrains.ts, zed.ts
  utils/        ← shared low-level utilities (file I/O, YAML helpers)
  output.ts     ← all stdout output — typed helper functions per output pattern
  constants.ts  ← project-wide constants (folder names, file names)
  types.ts      ← shared TypeScript types
```

**Commands are thin.** A command file does three things only: parse CLI arguments, call domain functions, print output via `output.ts`. No business logic in commands.

**Domain modules are where logic lives.** `flow/`, `task/`, `graph/` contain all real logic and are independently testable.

---

## Coding principles

### Functional — no classes
Use plain exported functions everywhere. No classes, no instantiation, no `this`. This is a CLI tool with no long-lived state between calls.

```ts
// correct
export function loadTaskState(taskName: string): TaskState { ... }

// wrong
class TaskStateManager {
  load(taskName: string): TaskState { ... }
}
```

### Error handling — throw, catch at the boundary
Domain functions throw on failure. Commands catch at the top level, print the error via `output.error()`, and exit with code 1.

```ts
// domain function — throws
export function loadFlow(name: string): FlowConfig {
  if (!fs.existsSync(flowPath)) {
    throw new Error(`Flow "${name}" not found.`)
  }
  ...
}

// command — catches at boundary
export async function startCommand(args: StartArgs) {
  try {
    const flow = loadFlow(args.flow)
    ...
    output.taskStarted(task, flow)
  } catch (err) {
    output.error(err)
    process.exit(1)
  }
}
```

Do not use `try/catch` inside domain functions unless you are re-throwing with more context. The `Try<T>` type is deleted — do not use it or recreate it.

### Output — always via `output.ts`
Never call `console.log` or `console.error` directly outside of `output.ts`. All stdout/stderr goes through typed helper functions defined there.

```ts
// output.ts — defines all output patterns
export function taskStarted(task: string, flow: string, activeSteps: string[]) { ... }
export function stepComplete(step: string, unblocked: string[]) { ... }
export function error(err: unknown) { ... }
export function nextCommand(cmd: string) { ... }
```

Output is structured plain text designed to be read by an AI agent. Every successful command output ends with the exact next command to run. Match the output format specified in `docs/plan.md` exactly.

### Plain functions accept data, return data
Domain functions should not reach for `fs` or `process.cwd()` directly unless they are explicitly I/O functions (loaders, writers). Logic functions take parsed data and return results — this makes them testable without mocking the filesystem.

```ts
// testable — pure logic
export function resolveReadySteps(steps: StepState[], completed: string[]): string[] { ... }

// I/O lives at the edge
export function loadTaskState(taskPath: string): TaskState { ... }
```

---

## TypeScript

`strict: true` is enabled along with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Also enabled:

- `noUnusedLocals`
- `noUnusedParameters`
- `noImplicitReturns`
- `noFallthroughCasesInSwitch`

Do not suppress TypeScript errors with `// @ts-ignore` or `as any`. If a type is genuinely unknown, use `unknown` and narrow it.

Use `import type` for type-only imports (`verbatimModuleSyntax` is enabled and enforces this).

---

## Testing

Tests live in `src/**/*.test.ts` alongside the module they test.

- Test domain modules (`flow/`, `task/`, `graph/`) — not commands
- Keep tests focused on logic: state transitions, dependency cascades, context assembly, error conditions
- Do not mock the filesystem in unit tests — instead design domain functions to accept parsed data so they don't need `fs` at all
- Use `vitest` — `describe`, `it`, `expect`

---

## IDE schema support

`chainflow init` always prompts the user interactively (via `@inquirer/prompts`) to select their IDE before writing any config. Never auto-detect and silently write.

Supported IDEs:
- **VS Code** → `.vscode/settings.json` (`yaml.schemas` entry)
- **JetBrains** → `.idea/jsonSchemas.xml`
- **Zed** → `.zed/settings.json` (`file_associations` entry)

The JSON Schema for flow config is:
- Shipped in the npm package at `schema/chainflow-flow.schema.json`
- Generated at build time from Zod schemas via `zod-to-json-schema`
- Submitted to SchemaStore so VS Code YAML extension picks it up automatically

---

## YAML

Use the `yaml` npm package for all YAML reading and writing. It preserves comments on round-trip, which matters because users hand-edit flow config files.

Do not use `js-yaml`.

---

## File and path conventions

- All paths are resolved relative to `process.cwd()` (the directory where `chainflow` is invoked), not relative to `__dirname` or the package location
- Folder and file name constants live in `src/constants.ts` — never hardcode strings like `"chainFlow"` or `".chainflow.yaml"` outside of that file

---

## What is already implemented

- `chainflow init` — creates the `chainFlow/` directory structure and root config

Everything else (validate, start, next, context, complete, revise, state, list) is not yet implemented. See `docs/plan.md` for full specifications.
