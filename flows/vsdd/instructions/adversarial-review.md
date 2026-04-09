Zero-tolerance adversarial review of the implementation. Every piece of feedback is a concrete flaw with a specific file, line, and proposed fix. Do not fabricate issues — PASS honestly if the code is solid.

## What you are reviewing

You have the full VSDD pipeline output so far:
- `behavioral-spec.md` — the contract
- `verification-architecture.md` — the verification strategy and purity boundary map
- `test-generation-tasks.md` — the test suite
- `implementation-tasks.md` — the TDD implementation cycles

## Five review dimensions

### 1. Spec Fidelity
Does the implementation actually satisfy the spec, or did the tests inadvertently encode a misunderstanding of the contract?
- Find implementations that satisfy the tests but violate a `[BC-N]` item
- Find spec items with no corresponding test coverage
- Find tests that encode the wrong behavior

### 2. Test Quality
Are the tests actually testing what they claim?
- Tautological tests that pass regardless of implementation
- Tests that mock too aggressively and test the mock, not the behavior
- Tests that assert on implementation details rather than observable behavior
- Tests that would pass even if the implementation were subtly wrong

### 3. Code Quality
No mercy:
- Placeholder comments ("TODO", "FIXME", "temporary")
- Generic error handling (`catch (e) { throw e }` style)
- Inefficient patterns that will cause problems at scale
- Hidden coupling between modules that should be independent
- Missing resource cleanup (file handles, connections, timers)
- Race conditions in any concurrent paths
- Dead code left over from TDD cycles

### 4. Security Surface
- Input validation gaps
- Injection vectors (SQL, command, template, path traversal)
- Authentication/authorization assumptions that are not validated
- Data exposure in error messages
- Side channels in timing-sensitive operations

### 5. Spec Gaps Revealed by Implementation
Sometimes writing the code reveals the spec was incomplete. Look for:
- Implemented behavior that has no corresponding spec item
- Behavior that the spec implies but does not state
- Purity boundary violations that crept through refactoring

## Revision Targets
For each validates target, state whether it needs revision:
- **spec**: REVISE | OK — <reason>
- **verification-plan**: REVISE | OK — <reason>
- **tests**: REVISE | OK — <reason>
- **implement**: REVISE | OK — <reason>
Only recommend REVISE for targets where you found legitimate issues at that level.

## Output Format

Be maximally terse. Write `adversarial-review.md`:

```
# Adversarial Review

## Verdict: PASS | FAIL

## Issues
(Only if FAIL — in severity order. Each issue is ONE line.)

- [CRITICAL|HIGH|MEDIUM|LOW] [Dimension] file:line — Issue. Fix: change.

## Summary
Counts by severity. If PASS: no legitimate issues found.
```

No multi-sentence explanations. No quoting code. State only what is wrong, where, and what to change.

## Validation instructions

The `validates` list in the flow config names the upstream steps whose output you are gatekeeping. For each named step, decide:
- **Pass**: The step's output is complete, correct, and has survived adversarial review
- **Fail**: The step has concrete, specific flaws that must be addressed

## Rules

- **Be specific.** Cite exact sections and phrases. Propose fixes.
- **PASS means you tried and failed to find real issues.** Do not invent problems to appear thorough.
