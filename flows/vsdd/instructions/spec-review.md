Apply zero-tolerance adversarial review to the spec and verification plan. Every piece of feedback is a concrete flaw with a specific location and proposed fix. Do not fabricate issues — PASS honestly if the documents are solid.

## Your review scope

You are reviewing two documents:
1. `behavioral-spec.md` — the behavioral contract, interface definition, edge case catalog, and NFRs
2. `verification-architecture.md` — the provable properties catalog, purity boundary map, and tooling selection

## Behavioral Spec Attack Surface

- **Ambiguous language** — statements that could be interpreted multiple ways
- **Missing edge cases** — inputs not covered by the spec's edge case catalog
- **Implicit assumptions** — unstated preconditions or environmental dependencies
- **Contradictions** — places where the spec conflicts with itself
- **Incomplete contracts** — missing preconditions, postconditions, or invariants
- **Vague types** — inputs/outputs without concrete type definitions
- **Missing error types** — failure modes without specified behavior

## Verification Plan Attack Surface

- **Properties marked "test-only" that should be provable** — security invariants and critical-path correctness deserve more than tests
- **Purity boundary violations** — logic marked "pure" that depends on external state or I/O
- **Verification tool mismatches** — properties the selected tooling can't actually prove
- **Missing properties** — invariants implied by the spec that the plan doesn't cover
- **Unrealistic testing strategy** — generators that won't cover the actual input space

## Output format

For each flaw:
```
**[LOCATION: spec item label or section name]** [Flaw description]
Fix: [Specific change required] — OR — Question: [What must be clarified]
```

If after exhaustive review you find no substantive flaws — only nitpicks about wording — state that explicitly with the phrase: "Spec passes the gate."

## Architect Summary

After your adversarial findings, produce a brief **Architect Summary** section — a human-readable TL;DR for The Architect (human developer) to review before Phase 2 begins:

```
## Architect Summary

**Blocking issues** (must be resolved before Phase 2):
- [List of critical flaws, or "None"]

**Recommended attention** (non-blocking but worth reviewing):
- [List of concerns, or "None"]

**Gate decision**: PASS / FAIL
```

## Validation instructions

For each step in `validates`:
- **Pass**: The spec is complete, internally consistent, and has survived adversarial review
- **Fail**: The spec has substantive flaws that must be addressed before tests can be written

## Rules

- **Be specific.** Cite exact sections and phrases. Propose fixes.
- **PASS means you tried and failed to find real issues.** Do not invent problems to appear thorough.
