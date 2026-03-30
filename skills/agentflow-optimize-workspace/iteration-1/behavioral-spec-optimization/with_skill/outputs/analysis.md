# Optimization Analysis: behavioral-spec step (navbar task)

**Step:** behavioral-spec
**Task:** navbar
**Flow:** vsdd
**Step state:** done
**Revision count:** 1

> NOTE: This step required 1 revision before it was accepted. That is a strong signal that the instructions left something ambiguous or underspecified, causing the agent to produce an artifact that needed correction before the downstream pipeline could proceed.

---

## Optimization Points

### 1. Missing context — no task description or task input is injected

**Category:** Missing context

**Relevant instruction line:**

> "Write a formal behavioral specification for this change."

The instruction opens with this directive but provides no mechanism for receiving the task request itself. The `behavioral-spec` step has `context.steps: []` — no prior step output is injected. The agent must therefore infer the feature scope entirely from the task name. For the "navbar" task, the agent produced a well-scoped artifact, but the revision likely happened because the agent had to guess at scope details (e.g. "removal of Edit menu", "sidebar placement below navbar") that were not explicitly stated anywhere in the injected context.

**Suggested addition:** Add an explicit section instructing the agent to begin by reading the task description from a dedicated task brief. Since no prior step output is available at this stage, the instructions should direct the agent to read a task input file (e.g. `agentFlow/tasks/<task-name>/task-brief.md` or equivalent) before writing the spec. If no such file exists in the current setup, the instructions should at minimum tell the agent to ask for clarification about scope before proceeding:

```markdown
## Before Writing

0. **Read the task brief** — Read `agentFlow/tasks/<task-name>/task-brief.md` for the scope of this change. If it does not exist, ask the user to provide a one-paragraph description of what is being built before proceeding. Do not infer scope from the task name alone.
```

---

### 2. Ambiguous instruction — label prefix convention not enforced, causing inconsistency

**Category:** Ambiguous instructions

**Relevant instruction lines:**

> "Behavioral contracts: `[BC-1]`, `[BC-2]`, ...
> Edge cases: `[EC-1]`, `[EC-2]`, ...
> Non-functional requirements: `[NFR-1]`, `[NFR-2]`, ..."

The instruction prescribes `[BC-N]`, `[EC-N]`, `[NFR-N]` as label formats. The artifact instead uses `[NBC-N]`, `[NEC-N]`, `[NNFR-N]`. The agent invented its own prefix convention (using "N" for "Navbar" as a component-scoping prefix), which is reasonable but diverges from the prescribed format. Downstream steps that cite `[BC-1]` expecting behavioral contracts will find no such labels in the artifact — they would need to use `[NBC-1]` instead. This naming mismatch is a likely cause of revision: whoever reviewed the spec needed the labels to match the spec's own documented convention, or needed to update downstream references.

**Suggested rewrite of the labeling section:**

```markdown
## VSDD Contract Chain

Label every spec item so downstream steps can reference it precisely. Use these exact prefixes — do not add component-specific characters or namespaces to the prefix:

- Behavioral contracts: `[BC-1]`, `[BC-2]`, ...
- Edge cases: `[EC-1]`, `[EC-2]`, ...
- Non-functional requirements: `[NFR-1]`, `[NFR-2]`, ...

Do not use `[NBC-N]`, `[NEC-N]`, `[NNFR-N]`, or any other variant. The labels must be exactly as shown.
```

---

### 3. Missing coverage — no instruction to account for existing tests and not breaking them

**Category:** Missing coverage

**Relevant instruction line:** (absent)

The instruction has no mention of existing test files. The artifact dedicates a prominent "Existing test coverage (do not break)" section (lines 27–31 of the artifact) listing four test files and noting their independence. This detail was clearly discovered by the agent during its codebase exploration (per the "Before Writing" / "Locate relevant code" step) but the instructions do not ask for it to be documented in the spec. Its inclusion suggests the agent found it important enough to add despite having no instruction to do so — and its absence in a revision scenario could have been the gap that triggered the revision.

**Suggested addition:** Add an explicit requirement to document existing test coverage as a named section in the spec output:

```markdown
### 5. Existing Test Coverage

List every existing test file that touches the modules or files this change modifies. For each:
- File path
- What it covers (one sentence)
- Whether this change is expected to modify it, break it, or leave it unchanged

This section protects downstream steps from accidentally invalidating passing tests.
```

---

### 4. Ambiguous instruction — "Stay proportional" guidance conflicts with the exhaustiveness requirement

**Category:** Ambiguous instructions

**Relevant instruction lines:**

> "Be exhaustive — every ambiguity left here becomes a bug downstream."
> "Stay proportional — a one-function fix needs a short spec; a cross-module feature needs thorough contracts"

These two directives are in tension. For a multi-file UI change like the navbar task (new component, App rewrite, menu change, layout restructuring), "proportional" could reasonably be interpreted as "moderately thorough," while the exhaustiveness directive demands full coverage. The artifact is very thorough (25 behavioral contracts, 16 edge cases, 14 NFRs, a full traceability index), which is appropriate — but an agent interpreting "proportional" conservatively could have produced a shallow spec, requiring revision to expand it.

**Suggested rewrite of the conflicting guidance:**

```markdown
- **Be exhaustive for behavioral contracts and edge cases** — every omitted contract becomes an untested behavior; every omitted edge case becomes a latent bug. Do not skip items because the change "seems small."
- **Be proportional for non-functional requirements** — include only the NFRs that are genuinely constraining for this specific change. Do not invent performance bounds or security requirements that do not apply.
```

---

### 5. Missing context — no instruction to document the two-toggle coexistence pattern

**Category:** Missing context

**Relevant instruction line:** (absent)

The artifact contains a prominent callout (lines 33–34) noting that the Sidebar already has a `sidebar-theme-toggle` and explaining that the Navbar's `navbar-theme-toggle` does not conflict with it. This is a critical non-obvious design constraint: without it, an implementer might try to consolidate the two toggles or wire them differently. The instructions have no guidance about documenting coexistence of multiple UI surfaces for the same action. The agent discovered this pattern during codebase exploration and correctly included it — but it was an ad-hoc addition, not a required output section. If the agent had missed it, the implementation step would have been underspecified.

**Suggested addition:** Add a coexistence/conflict analysis requirement to the "What to produce" section:

```markdown
### 5. Design Constraints and Coexistence Notes

For any new UI element or behavior being introduced, check whether a similar element already exists in the codebase. Document:
- Any existing components that perform the same or overlapping function
- How the new element and existing elements relate (e.g. two toggles calling the same callback — no conflict)
- Any invariants that must hold across both (e.g. both always call the same `onThemeToggle`)

This prevents implementers from unintentionally consolidating or conflicting parallel UI surfaces.
```

---

### 6. Missing coverage — no instruction to include a Traceability Index

**Category:** Missing coverage / Structural clarity

**Relevant instruction line:** (absent)

The artifact ends with a "Traceability Index" table (section 6) mapping every spec label to a concrete verification method. This table is genuinely valuable — it directly connects spec items to test assertions, making the test-generation step in Phase 2a straightforward. However, the instructions never ask for it. The agent added it without being told to. If a different agent run omitted it, the test-generation step would have to infer verification methods from prose rather than a structured table, increasing the chance of gaps.

**Suggested addition:** Add the traceability index as a required output section:

```markdown
### 6. Traceability Index

End the spec with a table mapping every labeled spec item to its verification method:

| Spec Item | Verification Method |
|---|---|
| [BC-1] | describe what test or check verifies this |
| [EC-1] | describe what test or check verifies this |
| [NFR-1] | describe what structural check or lint rule verifies this |

Every `[BC-N]`, `[EC-N]`, and `[NFR-N]` item must appear in this table. Items with no verification method are a spec gap — resolve them before finishing.
```

---

## Approval Question

Should I apply these changes to the instruction file? (yes to apply all, or list the numbers you want applied)
