Write a failing test suite derived from `behavioral-spec.md` and `verification-architecture.md`. Every test must trace to a specific contract, edge case, or property. Tests must FAIL against the current codebase — you are writing tests before implementation. The red-gate step will verify this.

## VSDD Contract Chain

Every test must reference the spec item it covers. Use the labels from `behavioral-spec.md` (e.g., `[BC-2]`, `[EC-5]`, `[NFR-1]`). This is non-negotiable — an unlabeled test is an untraceable test.

## Before Writing

1. **Read `spec.md`** — catalog every behavioral contract, edge case, and non-functional requirement
2. **Read `verification-plan.md`** — note which properties need property-based tests vs. targeted unit tests
3. **Check existing test patterns** — find how tests are structured in the codebase (framework, conventions, file locations)

## TDD constraint

Write tests FIRST. Do NOT write implementation code. Every test you write must be runnable and must FAIL against a non-existent or stub implementation. If any test passes without implementation, flag it immediately — it is testing the wrong thing.

## What to produce

### 1. Unit Tests

One or more tests per behavioral contract item (`[BC-N]`):
- Every postcondition becomes an assertion
- Every precondition violation becomes a test expecting a specific error

### 2. Edge Case Tests

Every item in the Edge Case Catalog (`[EC-N]`) becomes a test:
- These catch the bugs that "never happen in production until they do"
- Do not omit any edge case — if it is in the spec, it has a test

### 3. Integration Tests

Tests that verify the module works correctly within the larger system context defined in the spec.

### 4. Property-Based Tests

Where the verification architecture calls for property-based testing:
- Hypothesis (Python), fast-check (TypeScript/JS), proptest (Rust)
- Each property-based test references a `[VP-N]` label from `verification-architecture.md`
- Assert invariants hold across randomized inputs

## Implementation steps

### Step 1: Create the Tasklist

After analysis, create `test-generation-tasks.md`. This file is the single source of truth for progress. Use the exact format below — one `- [ ]` item per spec item or tightly related group.

### Step 2: Work Through Tasks

For each unchecked task in `test-generation-tasks.md`:

1. **Pick the next `- [ ]` task**
2. **Write the test** in the appropriate test file
3. **Verify it compiles** — run the test to confirm it fails with an assertion, not a syntax/import error
4. **Mark it done** — change `- [ ]` to `- [x]` in `test-generation-tasks.md`
5. **Repeat** until no `- [ ]` items remain

### Step 3: Final Review - Red Gate verification
1. Scan `tests-tasks.md` — confirm no `- [ ]` items remain
2. Cross-check against `spec.md` — verify no contracts, edge cases, or properties were missed
3. Run the full test suite — all tests should fail (red) but compile cleanly
4. If anything is missing, add new `- [ ]` items and work through them via Step 2
5. List every test and confirm it fails against the current (non-existent) implementation. Format:

```
| Test name | Spec item | Type | Red Gate status |
|---|---|---|---|
| test_null_input_rejects | [EC-1] | Edge case | FAILS (confirmed) |
```

If any test passes without implementation: flag it with `SUSPECT — passes without implementation` and explain why the test may be incorrect.

## Guidance

- **These are spec-verification tests** — they exist to exhaustively validate the spec during the development flow. A later `distill-tests` step will curate them into lean codebase-quality tests. Prioritize completeness and spec traceability here; do not self-censor for test suite size.
- **Test behavior, not implementation** — assert on observable outcomes, not internal details
- **Name tests by what they prove** — `test_returns_error_when_input_is_null` not `test1`
- **Keep `test-generation-tasks.md` current** — update it after every completed test, not in bulk at the end
- **Completeness over speed** — a missed spec item means an untested contract
