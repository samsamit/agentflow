# Clean-Pass Optimization Analysis: spec-review Step

## Context

The `spec-review` step in the `vsdd` flow ran on task `navbar` and completed on the first try — meaning the adversary agent (using `spec-review.md` instructions) produced a well-structured, substantive review without needing revisions. The gate decision was FAIL (correct — real flaws were found), and the output correctly identified both blocking and non-blocking issues.

The question is: given that the step completed cleanly, are there ways to tighten the instructions so future runs produce even higher-signal output?

---

## What the spec-review Step Produced

The output (`spec-review.md`) contained:

- 8 behavioral spec findings with specific locations, flaw descriptions, and concrete fixes
- 5 verification architecture findings with the same structure
- An Architect Summary with blocking issues, recommended attention items, and a gate decision

The quality is high. Every finding has a location label, a specific flaw, and a proposed fix. No fabricated issues were included. The Architect Summary correctly separated blocking from non-blocking concerns and gave a clean FAIL verdict with a rationale.

---

## What the Downstream Steps Revealed

Examining the outputs of later steps (`adversarial-review.md`, which reviewed the implementation after `test-generation` and `implementation`) surfaces something important: several issues that the `adversarial-review` step caught were either seeded by ambiguities in the `spec-review` output or could have been addressed earlier in the spec-review gate.

Specifically:

### 1. The NBC-14 / NEC-5 contradiction was correctly flagged — but the fix prescription was incomplete

The `spec-review` output correctly identified the contradiction between NBC-14 ("exact mechanism is an implementation detail") and NEC-5 (mandating a specific `applyThemeClasses` call pattern). It proposed a fix.

However, the adversarial-review found that the implementation contorted its `useEffect` to satisfy the `[NEC-14]` test's spy mechanism — calling `classList.remove/add` before overwriting with `className` assignment. This is a downstream consequence of NEC-5 being underspecified about what "observable" means for the dependency-array test. The `spec-review` instruction does not ask the reviewer to consider testability implications of the fixes they propose. A tighter instruction would prompt: "For each fix you propose, state how the corrected spec item is verifiable without coupling tests to implementation internals."

### 2. The NBC-9 indicator class ambiguity was correctly flagged — but the fix left the door open for a broken test

The `spec-review` output proposed that NBC-9 either commit to specific class names or explicitly say "the test value will be established post-implementation." The adversarial-review later found that the `[NBC-8]` test doesn't verify icon identity (only counts SVGs) and the indicator positioning is visually wrong even though it passes the class-presence test. Both issues trace back to NBC-8 and NBC-9 being underspecified about visual correctness vs. class-presence verification. The spec-review output only addressed class name determinism (NBC-9), not the broader question of whether class-presence tests are a sufficient proxy for visual correctness. The instruction could prompt for this.

### 3. The NBC-4 "no border on any child" flaw was found — but the spec-review instruction does not ask about testability scope creep

The spec-review output correctly narrowed NBC-4 to container-only. The adversarial-review later confirmed the test only checked the container, not children — consistent with the proposed fix. This one worked correctly end to end.

### 4. VP-1 trace correction was found — but the wrong trace went unnoticed in VP-4 as well

The `spec-review` output caught that VP-1 was traced to NBC-9 and NBC-11 (wrong) and should trace to NBC-13, NBC-16, NBC-17. It did not note that the VP-4 description incorrectly traces NBC-11 as the sole source for the StrictMode safety guarantee, when the purity constraint is a structural consequence of multiple spec items working together. The instruction asks the reviewer to check "incorrect spec references" in properties — but only in the context of verification correctness, not completeness of the trace map.

### 5. The lucide-react availability assumption (NNFR-3) was flagged — but only as a rationale issue

The spec-review output noted that Sidebar.tsx is a stub that may not prove lucide-react is a runtime dependency. This is correct. The downstream steps did not encounter this as a real problem (the implementation used lucide-react successfully), so the flag was a valid precaution. However, the instruction could be clearer that "implicit assumptions" about package availability should be resolved by checking package.json directly, not just noted as concerns.

---

## Proposed Instruction Improvements

These are improvements to `spec-review.md`. None are structural overhauls — the existing format is effective. These are targeted tightenings.

### Improvement 1: Add a "fix testability" check to each proposed fix

Current instruction says: propose a fix.

Suggested addition to the "Output format" section or "Rules":

> For each fix you propose, also state how the corrected spec item is testable without coupling the test to an implementation detail. A fix that resolves an ambiguity in the spec but creates an untestable or implementation-coupled assertion is not a complete fix.

**Rationale:** The NEC-14 / NEC-5 case shows that a well-intentioned fix ("mandate the applyThemeClasses call pattern") caused the implementation to contort itself to satisfy a test's spy. If the spec-review instruction asked the reviewer to consider test mechanism implications of proposed fixes, this coupling could have been avoided upstream.

### Improvement 2: Add "visual vs. structural correctness" to the Behavioral Spec Attack Surface

Current attack surface items are:
- Ambiguous language
- Missing edge cases
- Implicit assumptions
- Contradictions
- Incomplete contracts
- Vague types
- Missing error types

Suggested addition:

> - **Test-proxy validity** — places where the spec's stated verification method (e.g., class-name presence) is not a valid proxy for the actual constraint (e.g., rendered pixel position or visual layout)

**Rationale:** The NBC-9 indicator issue and NBC-3 height range vs. enumeration issue both fall into this category. The current instruction has "Incomplete contracts" which partially covers this, but a named category would make it more likely the reviewer catches class-theater assertions.

### Improvement 3: Tighten the "Verification Plan Attack Surface" item about unrealistic generators

Current item: "Unrealistic testing strategy — generators that won't cover the actual input space"

Suggested expansion:

> - **Unrealistic testing strategy** — generators that won't cover the actual input space; also harnesses that call side-effectful functions (e.g., render) inside a property callback without cleanup guarantees (try/finally)

**Rationale:** The VP-5 cleanup issue (no try/finally, so cleanup is skipped on counterexample failure) is exactly the kind of harness robustness problem this item is meant to catch. The current wording focuses only on input space coverage, not on harness correctness under failure conditions.

### Improvement 4: Add an explicit "trace correctness" check to the Verification Plan Attack Surface

Current attack surface covers "incorrect spec references" implicitly under "Missing properties." It should be explicit:

> - **Incorrect or incomplete trace labels** — properties whose `Traces to:` labels reference spec items that do not actually motivate the property, or omit the spec items that do

**Rationale:** VP-1 had wrong trace labels (NBC-9, NBC-11 instead of NBC-13, NBC-16, NBC-17). The spec-review output caught this, but it was found somewhat incidentally under "incorrect spec references." Making trace correctness an explicit named attack surface item would ensure it is checked systematically.

### Improvement 5: Clarify the "implicit assumptions" category to include dependency/package assumptions

Current item: "Implicit assumptions — unstated preconditions or environmental dependencies"

Suggested expansion:

> - **Implicit assumptions** — unstated preconditions, environmental dependencies, or package availability assumptions that have not been verified against `package.json` or actual project configuration

**Rationale:** The NNFR-3 lucide-react finding is a good example. The reviewer found it but the fix recommendation was to "change the rationale" rather than "verify against package.json before the implementation step." An explicit nudge to resolve such assumptions against project artifacts (not just note them) would make the finding more actionable.

---

## What Did Not Need to Change

The following aspects of the instruction are working well and should not be changed:

- The output format (`[LOCATION: ...]` / `Fix:` / `Question:`) is clear and consistently followed
- The Architect Summary structure (blocking / recommended / gate decision) is exactly the right shape
- The "PASS means you tried and failed" rule prevents fabricated issues
- The separation of Behavioral Spec Attack Surface from Verification Plan Attack Surface keeps reviews focused
- The `validates:` step integration is working — the review correctly covers both input documents

---

## Summary of Proposed Changes

| # | Target | Change | Priority |
|---|---|---|---|
| 1 | Output format / Rules section | Add: proposed fixes must address testability without coupling to implementation internals | High |
| 2 | Behavioral Spec Attack Surface | Add: "Test-proxy validity" as a named attack surface category | Medium |
| 3 | Verification Plan Attack Surface | Expand "Unrealistic testing strategy" to include harness robustness (try/finally, cleanup) | Medium |
| 4 | Verification Plan Attack Surface | Add: "Incorrect or incomplete trace labels" as explicit named category | Medium |
| 5 | Behavioral Spec Attack Surface | Expand "Implicit assumptions" to explicitly include package/dependency assumptions, resolved against project artifacts | Low |

None of these require structural changes to the instruction. They are additive clarifications to existing categories and the output format rules.
