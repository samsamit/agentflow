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

## Output format

Write `adversarial-review.md` using this structure:

**If any step fails:**

```
# Adversarial Review
Verdict: FAIL

## <step-name> — issues found

- [CRITICAL|HIGH|MEDIUM|LOW] [Dimension] file:line — Issue. Fix: change.
- [CRITICAL|HIGH|MEDIUM|LOW] [Dimension] file:line — Issue. Fix: change.

Revision directive: Fix the issues listed above. Do not touch unaffected files or modules.
```

Only include a section for steps that **fail**. If a step passes all five dimensions, omit it entirely — do not write "X passed" or any other passing content. The output should contain only what the revision agent needs to fix.

**If all steps pass:**

```
# Adversarial Review
Verdict: PASS

agentflow complete --step adversarial-review --task <task>
```

Each issue is one line. No multi-sentence explanations. No quoting code. State only what is wrong, where, and what to change.

## Rules

- **Be specific.** Cite exact file paths. Propose concrete fixes.
- **PASS means you tried and failed to find real issues.** Do not invent problems to appear thorough.
- **Omit passing steps entirely.** A revision agent reading this document should see only what needs fixing.
