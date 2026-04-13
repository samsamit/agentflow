# VSDD flow

The `vsdd` flow is an implementation of [Verified Spec-Driven Development](https://gist.github.com/dollspace-gay/d8d3bc3ecf4188df049d7a4726bb2a00) — a methodology that fuses Spec-Driven Development (SDD), Test-Driven Development (TDD), and Verification-Driven Development (VDD) into a single AI-orchestrated pipeline.

The core claim: code should not just work, it should prove why it exists, demonstrate that it works, and survive adversaries trying to kill it.

## Why it exists

Most AI-generated code is slop. It passes a quick manual test, looks reasonable, and silently breaks under edge cases no one thought to enumerate. The first "correct" version is always assumed to contain hidden debt.

VSDD imposes structured ceremony to prevent this. It forces the agent to commit to a behavioral contract before writing a single line of code, write failing tests before implementation begins, and face adversarial review from a fresh context with zero diplomatic filter. Each phase is a gate — not a suggestion.

The flow is appropriate when correctness matters: features that touch money, auth, data integrity, or anything long-lived that will accumulate entropy. It is overkill for throwaway scripts.

## Roles

| Role | Subagent | Responsibility |
|---|---|---|
| Builder | `builder` | Produces specs, tests, code, and hardening artifacts under strict TDD constraints |
| Adversary | `adversary` | Reviews with fresh context and zero tolerance for ambiguity, lazy boundaries, or hidden coupling |

The two agents are intentionally different to avoid shared blind spots. The Adversary (Sarcasmotron) receives no context from previous agent conversations — only the artifacts themselves.

## Phases and steps

### Phase 1 — Spec Crystallization

Specification is the highest authority below human judgment. Nothing gets built until the contract is unambiguous.

#### `behavioral-spec`

The Builder produces the full behavioral contract: preconditions, postconditions, invariants, interfaces, error types, NFRs, and an exhaustive edge case catalog (null, empty, maximum, negative, Unicode, concurrent). This is the specification the entire pipeline traces back to.

#### `verification-architecture`

The Builder maps the purity boundary — what is deterministic core, what is effectful shell — and designs the verification strategy: which properties must be formally proven, which are covered by tests, and which formal tools apply (Kani, Dafny, TLA+, property-based testing). This decision shapes implementation. If the design is verification-hostile, no amount of Phase 4 effort recovers it.

#### `spec-review`

The Adversary (fresh context) tears into the behavioral contract and verification strategy. The spec is not done until the Adversary cannot identify genuine ambiguities or missing behaviors — only wording nitpicks. Flaws found here are cheap; flaws found in Phase 3 are expensive.

### Phase 2 — Test-First Implementation

No implementation exists without a failing test that demanded it.

#### `test-generation`

The Builder derives the full test suite directly from the spec: unit tests, edge case tests, integration tests, property-based tests. All tests must fail before implementation begins — the Red Gate. A test that passes before implementation is written is not a test.

#### `implementation`

The Builder implements the minimum code to make one failing test pass at a time — Red → Green → Refactor, strictly. Purity boundaries defined in Phase 1b are respected throughout. Implementation scope is bounded by the spec; nothing extra is added.

### Phase 3 — Adversarial Refinement

#### `adversarial-review`

The Adversary receives the full artifact set (spec, tests, implementation) in a fresh context and scrutinizes five dimensions:

1. **Spec fidelity** — Does the implementation match the specification intent or just its letter?
2. **Test quality** — Are tests verifying behavior or testing implementation details?
3. **Code quality** — Placeholder comments, error handling gaps, coupling, inefficient patterns
4. **Security surface** — Input validation, injection vectors, trust boundary violations
5. **Spec gaps** — Behaviors the implementation reveals that were never specified

Criticisms route back: spec flaws return to Phase 1, test flaws to Phase 2a, implementation flaws to Phase 2b. `maxRevisions: 5` governs how many times any step can cycle.

### Phase 4 — Formal Hardening

#### `formal-hardening`

The Builder executes the verification plan designed in Phase 1b:

- **Proof execution** — formal property specs run against implementation
- **Fuzz testing** — structured fuzzing on the deterministic core
- **Security hardening** — static analysis, known-vulnerability test vectors
- **Mutation testing** — verify the test suite actually kills real bugs
- **Purity boundary audit** — confirm side effects haven't crept into pure functions

Issues from hardening feed back into Phase 3 (adversarial review) before cycling forward again.

### Phase 5 — Convergence

#### `convergence-check`

The Adversary evaluates four-dimensional convergence across all prior artifacts. "Zero-Slop" is declared only when all four hold simultaneously:

| Dimension | Signal |
|---|---|
| Spec | Adversary's critiques are wording nitpicks, not missing behavior |
| Tests | Adversary cannot name an untested scenario; mutation testing shows high kill rate |
| Implementation | Adversary is forced to invent problems that don't exist |
| Verification | All proofs pass; fuzzers find nothing; purity boundaries intact |

If any dimension fails, the Adversary routes back to the appropriate phase. The flow does not exit until all four pass.

## Flow

```
behavioral-spec
      │
      ▼
verification-architecture
      │
      ▼
  spec-review          ← adversary, fresh context
      │
      ▼
test-generation        ← all tests must fail first (Red Gate)
      │
      ▼
  implementation       ← minimum code per failing test
      │
      ▼
adversarial-review     ← adversary, fresh context, five dimensions
      │
      ▼
formal-hardening       ← proofs, fuzzing, mutation testing, purity audit
      │
      ▼
convergence-check      ← adversary, fresh context, four-dimensional gate
```

## When to use it

Use `vsdd` when:

- Correctness is non-negotiable — financial logic, auth, data integrity, cryptography
- The code will be maintained long-term and entropy resistance matters
- You want a formal spec and proof trail, not just passing tests
- Security is a primary concern

Skip it (or use `plan` + manual TDD) when:

- You are prototyping or exploring
- The feature is short-lived
- The overhead of full ceremony exceeds the risk of hidden defects
