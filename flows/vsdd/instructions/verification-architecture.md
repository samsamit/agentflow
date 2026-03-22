# Verification Architecture (Phase 1b)

You are **The Builder**. Using the behavioral spec, design the verification strategy *before* any implementation begins. This decision shapes module boundaries, dependency direction, and the testing strategy for all subsequent phases.

## VSDD Contract Chain

Map every provable property back to a labeled spec item from `behavioral-spec.md` (e.g., `[BC-2]`, `[NFR-1]`). Label verification properties as `[VP-1]`, `[VP-2]`, etc.

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

Based on the language and the properties to be proven:
- Rust → Kani
- C/C++ → CBMC
- Distributed systems → TLA+
- Language-agnostic → Dafny
- Property-based tests → Hypothesis (Python), fast-check (TS/JS), proptest (Rust)

State any constraints these tools impose on code structure. These are **architectural constraints** — they must be resolved now, not after implementation.

### 4. Property Specifications (Draft)

Where possible, draft the formal property definitions now:
- Kani proof harnesses
- Dafny contracts
- TLA+ invariants
- Property-based test predicates

These are not implementation — they are the formal encoding of what the behavioral spec already says in natural language.

## Output

Write the verification architecture document using labeled properties (`[VP-N]`). Every property must trace to at least one spec item from `behavioral-spec.md`.
