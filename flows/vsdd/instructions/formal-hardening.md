# Formal Hardening (Phase 5)

You are **The Builder**. Execute the verification plan designed in `verification-architecture.md` against the battle-tested implementation. Because the codebase was architected from Phase 1b with a pure core and clear purity boundaries, formal verification tools should engage cleanly without heroic refactoring.

## VSDD Contract Chain

Every proof, fuzz result, and mutation test result must reference the `[VP-N]` property it verifies and the `[BC-N]` or `[EC-N]` spec item it traces to.

## What to execute

### 1. Proof Execution

Run the property specifications drafted in `verification-architecture.md`:
- **Rust**: Kani harnesses
- **C/C++**: CBMC
- **Language-agnostic**: Dafny contracts
- **Distributed systems**: TLA+ invariants

For each proof:
- State the `[VP-N]` property being proven
- State whether it passed or failed
- If failed: is this an implementation bug or a spec property that needs refinement? Both feed back through Phase 4.

### 2. Fuzz Testing

Run structured fuzzing against the deterministic pure core (ideal fuzz target — no environmental dependencies to mock):
- **Rust**: cargo-fuzz or AFL++
- **C/C++**: libFuzzer or AFL++
- **Other**: language-appropriate equivalents

Document any crashes or unexpected behaviors found.

### 3. Security Hardening

- **Cryptographic edge cases**: Wycheproof test vectors (if applicable)
- **Static analysis**: Semgrep rules or language-appropriate equivalent
- Document any findings

### 4. Mutation Testing

Verify the test suite actually catches real bugs:
- **Python**: mutmut
- **TypeScript/JS**: Stryker
- **Rust**: cargo-mutants
- **Java**: PIT

Report:
- Total mutations generated
- Mutations killed (%)
- Surviving mutants — for each survivor: which test gap allowed it to survive?

A surviving mutant means the test suite has a gap. Document the gap and, if critical, add it to the Phase 4 backlog.

### 5. Purity Boundary Audit

Final check that the purity boundaries from Phase 1b have been respected:
- Confirm pure core modules have no I/O, network, database, or mutable global state
- Flag any side effects that crept into the pure core during Phases 2 or 4
- Refactor any violations out (and re-run the test suite)

## Output

Write the formal hardening report:

```
## Proof Results
[VP-N]: [property description] — PASS / FAIL [root cause if fail]

## Fuzz Testing Results
[Summary of runs, any crashes found]

## Security Analysis
[Findings or "No issues found"]

## Mutation Testing
- Total mutations: N
- Kill rate: X%
- Surviving mutants: [list with gap analysis, or "None"]

## Purity Boundary Audit
[CLEAN / violations found and resolved]

## Issues Requiring Phase 4 Feedback
[List of items to route back, or "None — proceed to Phase 6"]
```
