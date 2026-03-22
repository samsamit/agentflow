# Bundled Flows

Agentflow ships with two production-ready flows. Both are copied into your project during `agentflow init` and can be customized freely.

---

## `plan` — Standard Planning Workflow

A five-step linear flow for feature development. It enforces the natural order of research → planning → breakdown → implementation → review, ensuring each phase is grounded in the one before it.

```
research → plan → task-breakdown → implement → review
```

### Steps

| Step | Generates | Purpose |
|------|-----------|---------|
| `research` | `research.md` | Investigate the problem domain, gather relevant context, identify constraints and prior decisions |
| `plan` | `plan.md` | Create a high-level implementation plan informed by the research |
| `task-breakdown` | `tasks.md` | Break the plan into concrete, actionable implementation tasks |
| `implement` | _(none)_ | Execute the implementation tasks |
| `review` | _(none)_ | Review the implementation against the research, plan, and tasks |

### Review behaviour

The `review` step is a validator — it has a `validates` field covering `research`, `plan`, and `implement`. After reviewing, if any step needs rework, the agent calls `agentflow revise --step <step> --from review`. Agentflow cascades the revision forward automatically.

For example, revising `plan` resets `task-breakdown`, `implement`, and `review` back to `ready`.

### When to use it

Use `plan` for any feature, bug fix, or change that benefits from explicit planning before implementation. It is intentionally general — the quality of the output depends entirely on the instruction files you provide.

### Customizing

To adapt `plan` for your project, edit the instruction files in `agentFlow/flows/plan/instructions/`. Common customizations:

- Add project-specific constraints to `research.md` (e.g. "check the existing API contract")
- Add output format requirements to `plan.md` (e.g. "structure as: problem statement, proposed solution, alternatives rejected")
- Add coding standards to `implement.md`
- Add specific review criteria to `review.md`

---

## `vsdd` — Verified Spec-Driven Development

A ten-step, six-phase pipeline that fuses Spec-Driven Development, Test-Driven Development, and Verification-Driven Development into a single AI-orchestrated workflow with formal verification gates.

VSDD is designed for situations where correctness, security, and maintainability matter — not just "does it work". It uses two specialized subagents (`builder` and `adversary`) and includes multiple adversarial review gates.

### Pipeline overview

```
Phase 1: Spec Crystallization
  behavioral-spec → verification-architecture → spec-review (adversary)

Phase 2: Test-First Implementation
  test-generation → implementation → refactor

Phase 3: Adversarial Refinement
  adversarial-review (adversary)

Phase 4: Feedback Integration
  feedback-integration

Phase 5: Formal Hardening
  formal-hardening

Phase 6: Convergence
  convergence-check (adversary)
```

### Phases

#### Phase 1 — Spec Crystallization

Before any code is written, the spec is fully crystallized and adversarially reviewed.

- **`behavioral-spec`** — writes a formal behavioral contract: interface definitions, edge case catalog, non-functional requirements, and explicit out-of-scope declarations. Produced by the `builder` subagent.
- **`verification-architecture`** — identifies which properties of the spec are formally provable, defines the purity boundary map, and selects verification tooling. Produced by the `builder` subagent.
- **`spec-review`** — the `adversary` subagent (Sarcasmotron) tears into both documents with zero tolerance for ambiguity, lazy verification boundaries, or hidden coupling. Validates `behavioral-spec` and `verification-architecture`. If either needs rework, they are revised before Phase 2 begins.

#### Phase 2 — Test-First Implementation

TDD, strictly enforced.

- **`test-generation`** — writes the full test suite derived from the behavioral spec. All tests must fail before implementation begins (the Red Gate).
- **`implementation`** — minimal TDD implementation. One failing test made green at a time. Purity boundaries from the verification architecture are respected. Uses `generateStrategy: update` because implementation is iterative.
- **`refactor`** — refactor for clarity and NFRs, purity audit, human checkpoint.

#### Phase 3 — Adversarial Refinement

- **`adversarial-review`** — a fresh-context adversarial review across five dimensions: spec fidelity, test quality, code quality, security, and spec gaps. Validates all of Phase 1 and Phase 2 outputs. Any findings route back through the revision cascade.

#### Phase 4 — Feedback Integration

- **`feedback-integration`** — triages the adversarial critique. Each finding is routed to the correct upstream step. This is the coordination step: it decides what gets revised and in what order.

#### Phase 5 — Formal Hardening

- **`formal-hardening`** — executes the verification plan from Phase 1: proofs, fuzzing, security scanning, mutation testing, purity audit. The verification architecture defines exactly what this step must do.

#### Phase 6 — Convergence

- **`convergence-check`** — the final adversarial gate. Evaluates the entire pipeline output across four dimensions and either declares convergence ("Zero-Slop") or routes back with specific revision targets.

### Subagents

VSDD uses two named subagents:

| Name | Role |
|------|------|
| `builder` | Constructive work — spec authorship, test generation, implementation, refactoring |
| `adversary` | Adversarial review — tears into specs, tests, and implementations with fresh context and zero tolerance for ambiguity |

To wire these up in your AI tool, define agents named `builder` and `adversary` in your AI tool's agent config directory. During `agentflow init`, Agentflow can copy agent definition files into `.claude/agents/` (or equivalent) automatically.

### When to use it

Use `vsdd` when:
- Correctness is critical (security-sensitive code, public APIs, financial logic)
- You want formal verification baked in from the start, not bolted on at the end
- You are working with multiple specialized agents and want a structured handoff protocol
- You want adversarial review at the spec level before writing a single line of code

### Customizing

The instruction files in `agentFlow/flows/vsdd/instructions/` encode the full methodology. The agent definition files in `agentFlow/flows/vsdd/agents/` define the builder and adversary personas.

You can adjust:
- The adversary's review criteria in `adversarial-review.md` and `spec-review.md`
- The convergence criteria in `convergence-check.md`
- The formality level of the spec in `behavioral-spec.md`
- `maxRevisions` (default: 5) in the flow config

---

## Writing your own flow

Any flow you create under `agentFlow/flows/<name>/` is immediately available to `agentflow start`. The minimum required structure:

```
agentFlow/flows/my-flow/
├── .agentflow.yaml         ← flow definition (required)
└── instructions/
    └── <step-name>.md      ← one file per step (required by convention)
```

See the [flow schema reference](../README.md#flow-schema-reference) for the full YAML specification.

Run `agentflow validate --flow <name>` after writing a new flow to catch dependency errors, missing instruction files, and circular dependencies before running a task.
