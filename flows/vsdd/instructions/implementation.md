Break the implementation into an ordered list of minimal, incremental tasks. Each task targets one or more failing tests — pick the next failing test, write the minimum code to make it pass, run the suite, move on.

## VSDD Contract Chain

Every implementation choice must trace to a test, which traces to a spec item. Do not write code for which no test exists. If you find yourself wanting to write "just a bit more," stop — that code belongs in a future test cycle.

## Before Writing

1. **Read the spec and verification plan** from context
2. **Read `test-generation-tasks.md`** — confirm which tests are failing and their order of priority
3. **Check the codebase** for the files and functions that need to change
4. **Identify natural boundaries** — each task should make one or a few related tests pass without breaking others

## Output Format

Write `implementation-tasks.md`:

```
# Tasks

- [ ] Task title
  Target test(s): <test names this task should make pass>
  Brief description of the minimum code change needed. Reference specific files.

- [ ] Task title
  Target test(s): <test names>
  Brief description.
```

## TDD cycle (enforced)

For each test in the test suite:

1. **Pick the next unchecked task** from `implementation-tasks.md`
2. Write the **smallest implementation** that makes it pass — nothing more
3. Run the full suite — confirm nothing else broke
4. Move to the next failing test

Do NOT write ahead. Do NOT implement functionality the current test does not demand.

## Purity boundary constraint (enforced)

Refer to `verification-architecture.md` for the Purity Boundary Map. At every implementation decision:
- **Pure core functions**: No I/O, no network, no database, no mutable global state
- **Effectful shell**: All side effects live here

If you are tempted to add a side effect to the pure core, flag it explicitly:
```
⚠️ PURITY VIOLATION TEMPTATION: [describe what you were tempted to do and why you did not]
```

This flag is not a failure — it is the discipline working.

## Guidance

- **Order by TDD progression** — simplest tests first, then edge cases, then complex interactions
- **One concern per task** — "implement X and also handle Y" should be two tasks
- **Include a refactor task** — after all tests are green, add a final cleanup task
- **Cover all tests** — cross-check against `test-generation-tasks.md`; every test must be targeted by at least one task
- **Respect purity boundaries** — reference the verification plan's purity boundary map