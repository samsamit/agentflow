Execute the verification plan against the implementation. Run every tool and layer specified in `verification-architecture.md` — formal verification, fuzzing, mutation testing, security scanning. This step only runs for high/critical criticality changes.

Report honestly. If a tool isn't available or a proof times out, say so — don't claim success for tools you didn't run.

## VSDD Contract Chain

Every proof, fuzz result, and mutation test result must reference the `[VP-N]` property it verifies and the `[BC-N]` or `[EC-N]` spec item it traces to.

## What to execute

**Static Analysis** — Run linters and type checkers with strict config on changed files.

**Property-Based Testing** — Run the property specifications drafted in `verification-architecture.md` For each proof:
- State the `[VP-N]` property being proven
- State whether it passed or failed
- If failed: is this an implementation bug or a spec property that needs refinement? Both feed back through Phase 4.

**Formal Verification** — Run proof harnesses if specified. Record: proved / failed / timeout. Trace failures to spec violations.

**Security Hardening** - Report vulnerabilities by severity
- **Cryptographic edge cases**: Run applicable cryptographic test vectors if the change touches cryptographic operations
- **Static analysis**: A language-appropriate static analysis tool (SAST)
- Document any findings

**Purity Boundary Audit** - Final check that the purity boundaries from Phase 1b have been respected:
- Confirm pure core modules have no I/O, network, database, or mutable global state
- Flag any side effects that crept into the pure core during Phases 2 or 4
- Refactor any violations out (and re-run the test suite)

## Output

Write the `formal-hardening.md` report:

```
# Formal Hardening

## Verdict: PASS | FAIL

## Proof Results
[VP-N]: [property description] — PASS / FAIL [root cause if fail]

## Static Analysis
Tool: <name> | Findings: <count>

## Security Analysis
[Findings or "No issues found"]

## Purity Boundary Audit
[CLEAN / violations found and resolved]

## Issues Requiring Phase 4 Feedback
[List of items to route back, or "None — proceed to Phase 6"]

## Summary
Overall assessment. Note tooling limitations.
```

## Rules

- **Be specific.** Cite exact sections and phrases. Propose fixes.
- **PASS means you tried and failed to find real issues.** Do not invent problems to appear thorough.
