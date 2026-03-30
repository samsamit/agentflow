Design the verification architecture for this change. This determines which properties must be formally provable and what architectural constraints that imposes. Verification requirements shape module boundaries, dependency direction, and state flow — this must be decided before implementation.

## VSDD Contract Chain

Map every provable property back to a labeled spec item from `behavioral-spec.md` (e.g., `[BC-2]`, `[NFR-1]`). Label verification properties as `[VP-1]`, `[VP-2]`, etc.

## Before Writing

1. **Read `behavioral-spec.md`** — identify every behavioral contract, invariant, and edge case
2. **Classify properties** — for each contract item, decide: must it be formally proven (critical path, security, financial), or is test coverage sufficient?
3. **Identify side effects** — map which parts involve I/O, database access, network calls, or mutable shared state
4. **Survey verification tools** — based on the language and runtime, identify available formal verification, fuzzing, or property-testing tools

## What to produce

### 1. Provable Properties Catalog (`[VP-N]`)

Which invariants, safety properties, and correctness guarantees must be **formally proven** — not just tested?

For each property, state:
- The property in natural language
- The spec item(s) it traces to (e.g., `→ [BC-3]`)
- Why it must be proven (vs. tested): critical path, security boundary, financial calculation, etc.

Examples of properties that *should* be proven:
- "This state machine can never reach an invalid state"
- "This arithmetic can never overflow"
- "This parser always terminates"
- "This authorization check is never bypassed"

Explicitly distinguish: properties that must be proven vs. properties where test coverage is sufficient.

### 2. Purity Boundary Map

This is the most consequential design decision in VSDD. It dictates module boundaries, dependency direction, and how state flows through the system.

Define clearly:
- **Pure core**: The deterministic, side-effect-free modules where formal verification operates
- **Effectful shell**: I/O, network, database, user interaction — kept at the boundary

For each module, state: pure or effectful, and what data flows in/out.

State explicitly: if the system is designed with side effects woven through the core logic, no amount of Phase 5 heroics will make it verifiable. This boundary must be drawn now.

### 3. Verification Tooling Selection

Based on the language, runtime, and the properties to be proven, select the most appropriate tools available for:
- **Formal verification** — model checkers, theorem provers, or proof assistants suitable for the language
- **Property-based testing** — a library that generates randomized inputs and checks invariants
- **Fuzzing** — if applicable to the domain
- **Static analysis** — linters and type checkers with strict configuration

State any constraints these tools impose on code structure. These are **architectural constraints** — they must be resolved now, not after implementation.

### 4. Property Specifications (Draft)

Where possible, draft the formal property definitions now using the tooling selected above:
- Formal proof harnesses or contracts
- Invariant definitions
- Property-based test predicates

These are not implementation — they are the formal encoding of what the behavioral spec already says in natural language.

## Output

Write the verification architecture document using labeled properties (`[VP-N]`). Every property must trace to at least one spec item from `behavioral-spec.md`.

## Guidance

- **Verification-first architecture** — provability shapes the design. If you can't verify it, the architecture is wrong.
- **Be honest about proof vs. tests** — not everything needs formal verification. Justify the boundary.
- **Tool constraints are architectural constraints** — if your verification tool can't handle async code, that shapes async boundaries
