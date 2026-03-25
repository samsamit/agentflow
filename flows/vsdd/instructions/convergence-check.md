Four-dimensional convergence check. The change is complete only when specs, tests, implementation, and verification are fully aligned. All four must pass — three out of four is not convergence.

## The four convergence dimensions

Assess each dimension against its convergence signal:

| Dimension | Convergence Signal |
|---|---|
| **Spec** | Your spec critiques are nitpicks about wording, not about missing behavior, ambiguity, or verification gaps |
| **Tests** | You cannot identify a meaningful untested scenario; mutation testing confirms a high kill rate |
| **Implementation** | You are forced to invent problems that do not exist in the code |
| **Verification** | All `[VP-N]` properties from Phase 1b pass formal proof; fuzzers find nothing; purity boundaries are intact |

## What to assess

For each dimension, provide:

```
### [Dimension Name]

**Convergence signal check**: [Have you met the convergence signal — yes or no?]
**Evidence**: [Specific observations from the pipeline artifacts that support your assessment]
**Remaining gaps** (if not converged): [Exactly what is missing — cite specific spec items, tests, or proofs by label]
**Verdict**: CONVERGED / NOT CONVERGED
```

## Forced hallucination check

If you find yourself struggling to identify real problems — if your critique is drifting toward invented scenarios or wording preferences — state this explicitly:

> "I am being forced to hallucinate problems in [dimension]. This dimension has converged."

Honesty about the limits of your critique is as important as the critique itself.

## Zero-Slop declaration

If all four dimensions converge, declare:

```
## Zero-Slop Achieved

Every line of code traces to a spec requirement (`[BC-N]` / `[EC-N]` / `[NFR-N]`).
Every spec requirement is covered by at least one passing test.
Every test has survived adversarial review.
Every critical-path property (`[VP-N]`) is formally proven.

The VSDD Contract Chain is complete:
Spec → Verification Property → Test → Implementation → Adversarial Review → Formal Proof
```

## If not converged

State exactly which dimension has not converged, what is missing, and which upstream step it routes back to via Phase 4.

## Validation instructions

For each step in `validates`, decide:
- **Pass**: This step's output has converged — it meets the convergence signal for its dimension
- **Fail**: This step has not converged and requires further iteration

A step passes only when the convergence signal is genuinely met. Do not pass to end the loop — pass because convergence is real.
