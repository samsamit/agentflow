# Behavioral Spec Optimization Analysis — Navbar Task

## What Happened

The `behavioral-spec` step ran for the navbar task (flow: `vsdd`) and produced `behavioral-spec.md`. The downstream `spec-review` step (adversarial gate) issued a **FAIL** gate decision. This forced a revision (`revisionCount: 1` in `.taskState.yaml`). After revision, the spec passed and the flow continued through `verification-architecture` (also revised once) and `test-generation` / `implementation` (both currently in `revision` state).

The adversarial gate found three **blocking** issues in the original behavioral spec and several non-blocking issues. These are the direct cause of the revision cycle.

---

## Root Cause: What Made the First Run Fail

### Blocking Issue 1 — NBC-14 contradicts NEC-5 (mechanism contradiction)

**What was wrong:** NBC-14 stated the `useEffect` update mechanism was "an implementation detail" (implementation-free). NEC-5 then specifically mandated that `applyThemeClasses` must be called with `Array.from(document.documentElement.classList)` as its first argument. These two statements directly contradict each other. Test writers can't write correct assertions when the spec says "free choice" in one place and "specific call required" in another.

**Why the instruction file allowed this:** The `behavioral-spec.md` instruction says "Don't design the implementation — focus on what and what properties, not how." This principle, applied too broadly, led the agent to write "exact mechanism is an implementation detail" — but the task already has an existing `applyThemeClasses` function with a defined contract. When existing pure functions form part of the correctness model, the spec must commit to using them, not leave the mechanism open.

### Blocking Issue 2 — NBC-9 leaves CSS class names unspecified (untestable contract)

**What was wrong:** NBC-9 required a "deterministic" pill indicator positional class but only offered examples (`translate-x-*` or `dark-active`) without committing to either. The adversarial reviewer correctly identified this as a tautology — any prop-derived class is deterministic by definition. Test writers cannot write a passing assertion against "some class you'll figure out later."

**Why the instruction file allowed this:** The instruction says to write "Interface Definition — No ambiguity permitted" but does not explicitly say what to do when the exact implementation values (class names) are not knowable until implementation time. The agent hedged by giving examples instead of committing, producing a spec that sounds precise but isn't testable.

### Blocking Issue 3 — VP-1 trace references wrong spec items

**What was wrong:** The verification architecture's VP-1 (`toggleTheme` bijection) was traced to `[NBC-9]` and `[NBC-11]`. NBC-9 is about the pill indicator's CSS class; NBC-11 prohibits React hooks in Navbar. Neither is the motivating reason `toggleTheme` must be a bijection. The correct traces are NBC-13 (App uses `toggleTheme` to derive new state), NBC-16 (one toggle produces light), and NBC-17 (two toggles return to dark).

**Why the instruction file allowed this:** This is a cross-step defect — it appeared in `verification-architecture.md` not `behavioral-spec.md` directly — but it traces back to NBC-9 being vaguely worded. When NBC-9 talked about "deterministic" toggle positioning, the verification architecture author latched onto it as justifying `toggleTheme` bijection, rather than finding the actual state-management contracts (NBC-13/16/17). A clearer NBC-9 would have prevented the incorrect trace.

---

## Non-Blocking Issues That Signal Spec Weaknesses

These didn't block the gate but indicate areas where the instruction produces predictable drift:

1. **NBC-4 scope creep** — "no border-b on the container or any child" is unverifiable because any styled child (focus ring, separator) could use a border. The intent was to prohibit a bottom dividing line on the navbar container only.

2. **NEC-11 legacy key codes** — The spec included deprecated numeric key code references (13, 32) alongside modern `event.key` strings. The instruction gives no guidance on which API era to target.

3. **NBC-8 DOM order not contractual** — The instruction says to write a "behavioral contract" but the DOM order of SunIcon/indicator/MoonIcon was only described in the illustrative Section 3.2 interface definition, not promoted to a contract item.

4. **NBC-3 class-theater** — The spec claims to verify a pixel height constraint (40–48px) by asserting a CSS class name. The instruction does not prompt the agent to distinguish between "verifying a property" and "verifying the proxy signal for a property."

5. **Section 3.2 aria-checked string vs boolean ambiguity** — The intent was to use a string expression in JSX, but the instruction doesn't address React's HTML attribute serialization behavior, so the spec stated a requirement that is undetectable in the rendered DOM.

---

## Proposed Changes to the Instruction File

The following changes to `agentFlow/flows/vsdd/instructions/behavioral-spec.md` would make future runs more likely to produce a passing spec on the first attempt.

### Change 1 — Add a "Consistency check" step to the "Before Writing" list

**Current text (line 10–18):**
```
## Before Writing

1. Understand the request ...
2. Locate relevant code ...
3. Check for prior art ...
4. Map the interface boundary ...
5. Enumerate failure modes ...
```

**Proposed addition** (new item 6):
```
6. **Identify existing pure functions** — if the codebase already contains pure
   functions that the new code must call (e.g. `applyThemeClasses`, `toggleTheme`),
   name them explicitly in the behavioral contract rather than leaving the call
   mechanism as an "implementation detail." A spec that says "exact mechanism is
   free" while NEC says "must call X" is a contradiction. Commit to one.
```

**Rationale:** Prevents the NBC-14/NEC-5 contradiction pattern. When existing pure functions are load-bearing for correctness, the spec must call them out by name.

### Change 2 — Add guidance on implementation-time unknowns in the "Guidance" section

**Current text (line 60–64):**
```
## Guidance

- **Be specific** — "update the handler" is useless; ...
- **Stay proportional** — ...
- **Don't design the implementation** — focus on *what* and *what properties*, not *how*
```

**Proposed addition** (new bullet after "Don't design the implementation"):
```
- **Distinguish unknowable from vague** — if a contract depends on a value that
  cannot be known until implementation (e.g. a specific CSS class name), say so
  explicitly: "The exact class names are established during implementation; the
  test must assert each value by name as determined then." Do NOT write examples
  as if they are specifications. A spec that says "e.g. translate-x-0 or
  dark-active" is not a spec — it is a guess with extra words around it.
```

**Rationale:** Directly addresses the NBC-9 failure mode. Teaches the agent to either commit to concrete values or explicitly mark the spec as "to be completed post-implementation," rather than giving illustrative examples that downstream test writers cannot use.

### Change 3 — Add a "Self-review checklist" section before the Output section

After the Non-Functional Requirements section and before the Output section, add:

```
## Before Submitting — Self-Review Checklist

Before writing the final spec, verify:

- [ ] Every behavioral contract item is testable without ambiguity. If a contract
      says "must be deterministic," ask: deterministic to what specific values?
      A test writer must be able to write a passing assertion from this contract
      alone, without reading your implementation.
- [ ] No two spec items contradict each other. Specifically: if one item says
      "mechanism is free" and another item prescribes a specific mechanism, one
      of them is wrong. Resolve the contradiction before submitting.
- [ ] Every "no X on the container or any child" prohibition is intentional. If
      you mean to prohibit something only on the root element, say "on the
      data-testid='...' element itself." Do not accidentally prohibit things on
      all descendants.
- [ ] Every traceability row in the index maps to the correct motivating spec
      item. If a property says "toggleTheme must be a bijection," the trace must
      point to the spec items that require the bijection behavior (state
      round-trips), not to unrelated items about CSS classes or hook prohibition.
- [ ] Any key event handling uses only modern API names (event.key string values).
      Remove all numeric keyCode references.
- [ ] DOM order that is load-bearing (e.g. icon order in an accessible control)
      is stated as a contract item, not left as an illustrative example in the
      interface definition section.
```

**Rationale:** Addresses NBC-4 scope creep, NEC-11 legacy key codes, NBC-8 DOM order gap, and the VP-1 incorrect trace — all in a single self-check step that catches these before the adversarial gate does.

### Change 4 — Clarify "No ambiguity permitted" in the Interface Definition section

**Current text (line 29–36):**
```
### 2. Interface Definition

No ambiguity permitted:
- Input types and their constraints
- Output types and their shape
- All error types and when they are raised
```

**Proposed addition** (new bullet):
```
- For React/JSX props that serialize to HTML attributes: specify whether the
  prop value is a string or boolean and why, especially for ARIA attributes
  where `aria-checked={true}` (boolean) and `aria-checked={"true"}` (string)
  produce the same DOM output but have different JSX intent.
```

**Rationale:** Directly addresses the aria-checked string/boolean ambiguity finding. This is a common React footgun that the spec identified but could not make testable — the instruction should proactively flag this class of problem.

---

## Summary

The first-run failure was caused by two directly actionable instruction gaps:

1. **No guidance on how to handle existing pure functions** — the instruction's "don't design the implementation" principle caused the agent to write "mechanism is free" while a parallel edge case mandated a specific function call. Adding explicit guidance to identify and commit to load-bearing existing functions prevents this.

2. **No guidance on implementation-time unknowns** — the instruction encourages specificity but does not tell the agent what to do when specific values (CSS class names) cannot be known at spec-writing time. The agent filled the gap with illustrative examples that looked specific but were not contractual. Adding guidance on how to handle this case (either commit or explicitly defer) prevents this.

The self-review checklist (Change 3) provides a catch-all for the remaining non-blocking issues that are predictable failure modes: scope-crept prohibitions, legacy API references, DOM order left in illustrative sections, and incorrect traceability mappings.
