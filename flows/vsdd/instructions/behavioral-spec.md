Write a formal behavioral specification for this change. The spec is the source of truth — tests, implementation, and verification all trace back to it. Omitted contracts won't be tested. Vague contracts can't be tested.

## VSDD Contract Chain

Label every spec item so downstream steps can reference it precisely:
- Behavioral contracts: `[BC-1]`, `[BC-2]`, ...
- Edge cases: `[EC-1]`, `[EC-2]`, ...
- Non-functional requirements: `[NFR-1]`, `[NFR-2]`, ...

## Before Writing

1. **Understand the request** — identify every ambiguity and unstated assumption
2. **Locate relevant code** — find the files, modules, types, and patterns involved; read them
3. **Check for prior art** — look for similar patterns already in the codebase
4. **Map the interface boundary** — identify every input type, output type, and error type the change touches
5. **Enumerate failure modes** — what inputs break it? What concurrent scenarios cause trouble? What happens at boundaries?

Do not guess at code structure. Base the spec on what you actually find.

## What to produce

### 1. Behavioral Contract

What the module/function/endpoint *must* do, expressed as:
- **Preconditions** (`[BC-N]`): What must be true before it is called
- **Postconditions** (`[BC-N]`): What must be true after it returns
- **Invariants** (`[BC-N]`): Properties that must hold at all times

### 2. Interface Definition

No ambiguity permitted:
- Input types and their constraints
- Output types and their shape
- All error types and when they are raised
- If this is an API: the full OpenAPI/GraphQL schema
- If this is a module: the type signatures and doc contract

### 3. Edge Case Catalog (`[EC-N]`)

Be exhaustive. Every item here becomes a test in Phase 2a:
- Null, undefined, and empty inputs
- Maximum and minimum boundary values
- Negative and zero values
- Unicode and special characters
- Concurrent access scenarios
- Network or I/O failure modes
- Anything that "never happens in production until it does"

### 4. Non-Functional Requirements (`[NFR-N]`)

- Performance bounds (latency, throughput, memory)
- Security requirements
- Compatibility constraints
- Observability requirements

## Output

Write the behavioral specification as a structured document using the labeled format above. Be exhaustive — every ambiguity left here becomes a bug downstream.

## Guidance

- **Be specific** — "update the handler" is useless; "add a `retryCount` parameter to `fetchWithRetry` in `packages/utils/src/http.ts`" is actionable
- **Stay proportional** — a one-function fix needs a short spec; a cross-module feature needs thorough contracts
- **Don't design the implementation** — focus on *what* and *what properties*, not *how*