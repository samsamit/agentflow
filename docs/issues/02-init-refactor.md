# Issue 2: Init Command Refactor

**Type:** AFK
**Blocked by:** Issue 1 (core infrastructure)

## What to build

Refactor `agentflow init` into the full specified implementation. The current `init.ts` creates the directory structure but lacks IDE configuration, bundled flow selection, and descriptive output.

- Prompt the user to select their IDE (VS Code, JetBrains, Zed) using `@inquirer/prompts`. Never auto-detect.
- Write the appropriate IDE config file for the selected IDE:
  - VS Code → `.vscode/settings.json` (`yaml.schemas` entry)
  - JetBrains → `.idea/jsonSchemas.xml`
  - Zed → `.zed/settings.json` (`file_associations` entry)
- Prompt the user to select which bundled flows to copy into `agentFlow/flows/`. Bundled flows ship inside the npm package in a `flows/` directory at package root.
- Copy selected bundled flows into the project.
- Replace all `console.log` calls with `output.ts` functions. Each action taken during init should produce a line of descriptive output.
- Create `src/schema/` module that generates `schema/agentflow-flow.schema.json` from the flow Zod schema at build time using `zod-to-json-schema`. Check the generated schema into the repo.
- IDE config writers may live directly in `commands/init.ts` or in a dedicated `src/ide/` module — implementation choice.

Reference: `docs/prd.md` — User Stories: Init & Setup (1–10), Implementation Decisions → `ide/`, `commands/init.ts`.

## Acceptance criteria

- [x] `agentflow init` prompts for IDE selection before writing any config
- [x] Correct IDE config file is written for each of the three supported IDEs
- [x] `agentflow init` prompts for bundled flow selection and copies selected flows to `agentFlow/flows/`
- [x] All init output goes through `output.ts` — no bare `console.log`
- [x] `schema/agentflow-flow.schema.json` is generated at build time and checked into the repo
- [x] `agentflow init` still creates the correct directory structure

## Blocked by

- Issue 1 (core infrastructure — `output.ts` and strict TS required)

## User stories addressed

- User stories 1–10 (init & setup)
- User story 19 (defaultFlow in root config)
