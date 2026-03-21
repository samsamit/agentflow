# Issue 3: Flow Schema & Validation Command

**Type:** AFK
**Blocked by:** Issue 1 (core infrastructure)

## What to build

Implement the `flow/` domain module and the `chainflow validate` command. This slice makes flow configs parseable and validates them before any task runs.

- Define the flow config Zod schema in `src/flow/flow.schema.ts` covering: flow name, steps, `requires`, `generates`, `generateStrategy`, `context` (instructions, references, upstream steps), `validates`, `subagent`, `maxRevisions`, `required`.
- Implement `src/flow/loader.ts`: reads a flow YAML file, parses it with the `yaml` package, validates with Zod, and returns a typed `FlowConfig`. Throws on invalid config.
- Implement `src/flow/validator.ts`: validates a parsed flow for semantic correctness — circular dependency detection in `requires` chains, missing `instructions` files, unknown step references in `requires`/`context.steps`/`validates`.
- Implement `src/commands/validate.ts`: thin handler that delegates to `flow/` loader and validator. Accepts optional `--flow <name>`. Prints structured pass/fail output readable by both developers and AI agents.
- Write unit tests for `flow/` — valid configs parse cleanly, invalid configs throw with clear messages, validator catches all error classes listed above.

Reference: `docs/prd.md` — Flow Configuration (11–19), Validation (20–25), Implementation Decisions → `flow/`.

## Acceptance criteria

- [ ] Flow Zod schema covers all fields specified in the PRD
- [ ] `loadFlow()` parses valid YAML and returns typed `FlowConfig`
- [ ] `loadFlow()` throws with a clear message on invalid/missing config
- [ ] `validateFlow()` throws on circular `requires` chains
- [ ] `validateFlow()` throws on missing `instructions` files
- [ ] `validateFlow()` throws on unknown step references in `requires`, `context.steps`, `validates`
- [ ] `chainflow validate` exits 0 on a valid project, exits 1 on failure with a clear error
- [ ] `chainflow validate --flow <name>` validates only the named flow
- [ ] Unit tests cover all validator error cases

## Blocked by

- Issue 1 (core infrastructure — strict TS, `output.ts`)

## User stories addressed

- User stories 11–19 (flow configuration)
- User stories 20–25 (validation)
