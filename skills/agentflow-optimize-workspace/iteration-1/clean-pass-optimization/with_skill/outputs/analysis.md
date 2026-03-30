# Optimization Analysis: spec-review step (vsdd flow, navbar task)

**Step**: spec-review
**Flow**: vsdd
**Task**: navbar
**Step state**: done
**Revision count**: 0 (clean pass — no revision signal to guide analysis)

Note: Because this step passed on the first try, there is no revision history to use as a strong signal. Analysis is based purely on comparing the instruction file against what the artifact actually produced.

---

## Optimization Points

### 1. Missing coverage: no instructions on severity or prioritization of findings

**Category**: Missing coverage

**Relevant instruction text**: The output format section only specifies the per-flaw block format and the "Spec passes the gate" phrase. There is no guidance on how to categorize or prioritize findings.

> (absence — no prioritization or severity guidance in the instruction file)

**What the artifact did**: The artifact independently introduced a two-tier severity structure in the Architect Summary — "Blocking issues (must be resolved before Phase 2)" and "Recommended attention (non-blocking but worth reviewing)." This tiered structure is exactly what a downstream agent (test-generation) needs to know what must be fixed vs. what can be deferred.

**Suggestion**: Add an explicit instruction requiring the reviewer to classify each finding as either blocking or non-blocking, and carry that classification forward into the Architect Summary. Example addition to the Output format section:

> For each flaw, classify as **Blocking** (must be resolved before Phase 2 begins) or **Recommended** (non-blocking, worth reviewing). Carry this classification into the Architect Summary.

---

### 2. Ambiguous instruction: "Spec passes the gate" phrase placement is underspecified

**Category**: Ambiguous instruction

**Relevant instruction text**:
> "If after exhaustive review you find no substantive flaws — only nitpicks about wording — state that explicitly with the phrase: 'Spec passes the gate.'"

**What the artifact did**: The artifact never needed this phrase (the gate decision was FAIL), but the instruction does not clarify where this phrase should appear — in the body, in the Architect Summary, or replacing the Architect Summary entirely. A future run that results in a PASS would have ambiguity about whether to still produce an Architect Summary and where to place the gate phrase.

**Suggestion**: Clarify the PASS path explicitly:

> If no substantive flaws are found, write "Spec passes the gate." in the findings body (in place of any flaw blocks), then produce the Architect Summary with "None" for both blocking and recommended items and **Gate decision**: PASS.

---

### 3. Redundant instruction: "Validation instructions" section adds no constraint beyond what the gate decision already captures

**Category**: Redundant instructions

**Relevant instruction text**:
> "## Validation instructions
> For each step in `validates`:
> - **Pass**: The spec is complete, internally consistent, and has survived adversarial review
> - **Fail**: The spec has substantive flaws that must be addressed before tests can be written"

**What the artifact did**: The artifact did not produce a separate "Validation instructions" section. It produced a gate decision of FAIL inside the Architect Summary, which captures the same information more concisely. The Validation instructions section in the instructions describes what Pass/Fail means but does not direct the agent to produce any specific output — it is descriptive scaffolding that went unused.

**Suggestion**: Either remove this section entirely (since the Architect Summary's **Gate decision** line already serves the purpose), or convert it into a direct output instruction:

> At the end of the Architect Summary, record: `**Gate decision**: PASS` if the documents are ready for Phase 2, or `**Gate decision**: FAIL` if blocking issues exist. This is the authoritative signal that agentflow uses to decide whether Phase 2 may begin.

---

### 4. Missing context: no instruction to cross-check the two documents against each other for internal consistency

**Category**: Missing context

**Relevant instruction text**: The attack surface sections treat `behavioral-spec.md` and `verification-architecture.md` as independent targets. The instruction lists categories of issues to look for within each document but does not instruct the reviewer to check consistency between them.

> (absence — no cross-document consistency check is mentioned)

**What the artifact did**: The artifact independently identified a cross-document contradiction (NBC-14 vs NEC-5) where `behavioral-spec.md` said the mechanism was a free implementation detail while `verification-architecture.md` mandated a specific call pattern. This was the most critical blocking issue found. The agent found it by reasoning across both documents simultaneously — but the instructions did not ask for this.

**Suggestion**: Add a third attack surface section explicitly covering cross-document consistency:

> ## Cross-Document Consistency
> - **Spec-to-architecture contradictions** — places where `behavioral-spec.md` and `verification-architecture.md` make incompatible statements about the same behavior
> - **Orphaned spec items** — behavioral contracts in `behavioral-spec.md` that have no corresponding property or test strategy in `verification-architecture.md`
> - **Orphaned verification properties** — properties in `verification-architecture.md` that trace to non-existent or mis-cited spec items

---

### 5. Structural clarity: attack surface lists use inconsistent framing (some are risks, some are instructions)

**Category**: Structural clarity

**Relevant instruction text**: The Behavioral Spec Attack Surface uses noun phrases describing flaw types:
> "- **Ambiguous language** — statements that could be interpreted multiple ways"

The Verification Plan Attack Surface mixes in prescriptive framing:
> "- **Properties marked 'test-only' that should be provable** — security invariants..."
> "- **Unrealistic testing strategy** — generators that won't cover the actual input space"

**What the artifact did**: The artifact applied the attack surface categories correctly, but one finding (VP-2 generator too narrow) maps precisely to "Unrealistic testing strategy" while another (VP-5 cleanup issue) maps to a category not listed at all. The artifact invented its own framing for that finding.

**Suggestion**: Normalize all attack surface bullet points to the same noun-phrase + description pattern, and add a catch-all category to both sections:

> - **Implementation leakage** — places where the spec or plan inadvertently mandates a specific implementation rather than specifying observable behavior

This makes the list exhaustive enough to cover findings the agent generates that don't fit the named categories.

---

## Approval Question

Should I apply these changes to the instruction file? (yes to apply all, or list the numbers you want applied)
