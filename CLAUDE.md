# agentflow — Agent Guidelines

`agentflow` is an agent-first CLI workflow engine. Users define multi-step workflows in YAML; an AI agent calls `agentflow` commands to navigate the workflow, receive injected context per step, and track progress. The tool enforces dependency order, cascades revisions downstream, and injects all context so the agent never needs to explore on its own.

**The codebase is the source of truth.** `docs/cli.md` is documentation that must be kept in sync with the code — when you change behavior, flags, or output format, update `docs/cli.md` to reflect the new reality. Read it for context, but trust the code over the docs if they conflict.

---

## Commands

```bash
npm run build        # tsdown bundle + generate JSON schema
npm run test         # vitest (watch mode)
npm run test:run     # vitest (single run)
npm run check        # biome lint + format (auto-fix)
npm run validate     # tsc --noEmit + check + test:run
```

---

## Module structure

```
src/
  commands/     ← thin CLI handlers only (parse args → call domain → print output)
  flow/         ← flow config loading, Zod schema, validation
  task/         ← task state read/write, active task resolution
  graph/        ← dependency graph, topological sort, cycle detection, cascade logic
  schema/       ← JSON Schema generation (zod-to-json-schema)
  ide/          ← IDE config writers: vscode.ts, jetbrains.ts, zed.ts
  utils/        ← shared low-level utilities (file I/O, YAML helpers)
  output.ts     ← ALL stdout/stderr — typed helper functions per output pattern
  constants.ts  ← ALL folder/file name constants — never hardcode these strings
  types.ts      ← shared TypeScript types
```

---

## Architecture rules

**Commands are thin.** A command does exactly three things: parse CLI args, call domain functions, print output via `output.ts`. No business logic in commands.

**Domain modules own all logic.** `flow/`, `task/`, `graph/` contain real logic and are independently testable. Logic functions accept parsed data and return data — no `fs` or `process.cwd()` inside logic functions. I/O lives at the edges (loaders, writers).

**Error handling: throw in domain, catch at command boundary.** Domain functions throw on failure. Commands catch, call `output.error()`, and `process.exit(1)`. Do not use `try/catch` inside domain functions unless re-throwing with added context.

**Output: ALWAYS via `output.ts`.** Never call `console.log` or `console.error` directly outside `output.ts`. Every successful command output ends with the exact next command to run — keep `docs/cli.md` updated to match.

**No classes.** Use plain exported functions everywhere. This is a stateless CLI tool.

---

## Conventions

- **Paths:** All paths resolve relative to `process.cwd()`. Never use `__dirname` or package-relative paths.
- **Constants:** Folder/file name strings (`"agentFlow"`, `".agentflow.yaml"`, etc.) live only in `src/constants.ts`.
- **YAML:** Use the `yaml` package (not `js-yaml`) — it preserves comments on round-trip.
- **TypeScript:** `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Use `import type` for type-only imports. Never use `// @ts-ignore` or `as any` — use `unknown` and narrow it.
- **Tests:** Live at `src/**/*.test.ts`. Test domain modules, not commands. Design functions to accept data so tests never need to mock `fs`.

---

## IDE schema support

`agentflow init` ALWAYS prompts interactively for IDE selection — never auto-detect and silently write. Supported: VS Code (`.vscode/settings.json`), JetBrains (`.idea/jsonSchemas.xml`), Zed (`.zed/settings.json`). Schema is shipped at `schema/agentflow-flow.schema.json` and generated at build time.
