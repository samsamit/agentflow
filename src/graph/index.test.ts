import { describe, expect, it } from "vitest";
import type { StepConfig } from "../flow/schema.js";
import type { StepState } from "../task/schema.js";
import {
  detectCycle,
  isTaskComplete,
  resolveActionableSteps,
  resolveReadySteps,
  resolveTransitiveCascade,
  resolveUnblockedSteps,
  topologicalSort,
} from "./index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ctx = { instructions: "instructions.md" };

/** Simple linear DAG: research → plan → task-breakdown → implement → review */
const linearSteps: StepConfig[] = [
  { name: "research", requires: [], context: ctx },
  { name: "plan", requires: ["research"], context: ctx },
  { name: "task-breakdown", requires: ["plan"], context: ctx },
  { name: "implement", requires: ["task-breakdown"], context: ctx },
  { name: "review", requires: ["implement"], context: ctx },
];

/** Diamond DAG: research, design → both feed into plan */
const diamondSteps: StepConfig[] = [
  { name: "research", requires: [], context: ctx },
  { name: "design", requires: [], context: ctx },
  { name: "plan", requires: ["research", "design"], context: ctx },
  { name: "implement", requires: ["plan"], context: ctx },
];

/** Cyclic graph: a → b → c → a */
const cyclicSteps: StepConfig[] = [
  { name: "a", requires: ["c"], context: ctx },
  { name: "b", requires: ["a"], context: ctx },
  { name: "c", requires: ["b"], context: ctx },
];

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

describe("topologicalSort", () => {
  it("returns all step names in valid execution order for a linear DAG", () => {
    const order = topologicalSort(linearSteps);
    expect(order).toHaveLength(linearSteps.length);
    // Each step must appear after all its requires
    for (const step of linearSteps) {
      const stepIdx = order.indexOf(step.name);
      for (const req of step.requires ?? []) {
        const reqIdx = order.indexOf(req);
        expect(reqIdx).toBeLessThan(stepIdx);
      }
    }
  });

  it("returns valid ordering for a diamond DAG", () => {
    const order = topologicalSort(diamondSteps);
    expect(order).toHaveLength(diamondSteps.length);
    for (const step of diamondSteps) {
      const stepIdx = order.indexOf(step.name);
      for (const req of step.requires ?? []) {
        const reqIdx = order.indexOf(req);
        expect(reqIdx).toBeLessThan(stepIdx);
      }
    }
  });

  it("returns single step for a single-step flow", () => {
    const order = topologicalSort([{ name: "solo", requires: [], context: ctx }]);
    expect(order).toEqual(["solo"]);
  });
});

// ---------------------------------------------------------------------------
// detectCycle
// ---------------------------------------------------------------------------

describe("detectCycle", () => {
  it("returns null for a linear DAG", () => {
    expect(detectCycle(linearSteps)).toBeNull();
  });

  it("returns null for a diamond DAG", () => {
    expect(detectCycle(diamondSteps)).toBeNull();
  });

  it("returns a non-null cycle path for a cyclic graph", () => {
    const cycle = detectCycle(cyclicSteps);
    expect(cycle).not.toBeNull();
    expect(Array.isArray(cycle)).toBe(true);
    expect((cycle as string[]).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// resolveReadySteps
// ---------------------------------------------------------------------------

describe("resolveReadySteps", () => {
  it("returns only steps in ready state", () => {
    const states: Record<string, StepState> = {
      research: { state: "ready" },
      plan: { state: "blocked" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    expect(resolveReadySteps(linearSteps, states)).toEqual(["research"]);
  });

  it("returns multiple ready steps when present", () => {
    const states: Record<string, StepState> = {
      research: { state: "ready" },
      design: { state: "ready" },
      plan: { state: "blocked" },
      implement: { state: "blocked" },
    };
    const ready = resolveReadySteps(diamondSteps, states);
    expect(ready).toContain("research");
    expect(ready).toContain("design");
    expect(ready).toHaveLength(2);
  });

  it("returns empty array when no steps are ready", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "done" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "done" },
    };
    expect(resolveReadySteps(linearSteps, states)).toEqual([]);
  });

  it("treats revision state steps as not ready", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "blocked" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    expect(resolveReadySteps(linearSteps, states)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveActionableSteps
// ---------------------------------------------------------------------------

describe("resolveActionableSteps", () => {
  it("returns ready steps", () => {
    const states: Record<string, StepState> = {
      research: { state: "ready" },
      plan: { state: "blocked" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    expect(resolveActionableSteps(linearSteps, states)).toEqual(["research"]);
  });

  it("returns revision steps", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision", revisedBy: "review" },
      plan: { state: "blocked" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    expect(resolveActionableSteps(linearSteps, states)).toEqual(["research"]);
  });

  it("returns both ready and revision steps", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision", revisedBy: "review" },
      plan: { state: "ready" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    const actionable = resolveActionableSteps(linearSteps, states);
    expect(actionable).toContain("research");
    expect(actionable).toContain("plan");
    expect(actionable).toHaveLength(2);
  });

  it("returns empty array when no actionable steps exist", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "blocked" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    expect(resolveActionableSteps(linearSteps, states)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveUnblockedSteps
// ---------------------------------------------------------------------------

describe("resolveUnblockedSteps", () => {
  it("returns steps that become unblocked after a step is completed", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "blocked" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    // When research is completed, plan should be unblocked (all its requires are now done)
    const unblocked = resolveUnblockedSteps(linearSteps, states, "research");
    expect(unblocked).toEqual(["plan"]);
  });

  it("does not unblock steps that still have blocked dependencies", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      design: { state: "blocked" },
      plan: { state: "blocked" },
      implement: { state: "blocked" },
    };
    // completing research doesn't unblock plan (design is still blocked)
    const unblocked = resolveUnblockedSteps(diamondSteps, states, "research");
    expect(unblocked).not.toContain("plan");
  });

  it("unblocks steps when the last required dependency is completed", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      design: { state: "done" },
      plan: { state: "blocked" },
      implement: { state: "blocked" },
    };
    // completing design (when research is already done) should unblock plan
    const unblocked = resolveUnblockedSteps(diamondSteps, states, "design");
    expect(unblocked).toContain("plan");
  });

  it("returns empty array when completing a leaf step", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "done" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "done" },
    };
    const unblocked = resolveUnblockedSteps(linearSteps, states, "review");
    expect(unblocked).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveTransitiveCascade
// ---------------------------------------------------------------------------

describe("resolveTransitiveCascade", () => {
  it("returns direct dependents when a step is revised", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "done" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    const cascade = resolveTransitiveCascade(linearSteps, states, "research");
    expect(cascade).toContain("plan");
  });

  it("returns all transitive dependents", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "done" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "done" },
    };
    const cascade = resolveTransitiveCascade(linearSteps, states, "research");
    // All downstream from research should cascade
    expect(cascade).toContain("plan");
    expect(cascade).toContain("task-breakdown");
    expect(cascade).toContain("implement");
    expect(cascade).toContain("review");
    expect(cascade).not.toContain("research");
  });

  it("handles cascade of steps in blocked state", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "done" },
      "task-breakdown": { state: "blocked" },
      implement: { state: "blocked" },
      review: { state: "blocked" },
    };
    const cascade = resolveTransitiveCascade(linearSteps, states, "research");
    expect(cascade).toContain("plan");
    expect(cascade).toContain("task-breakdown");
    expect(cascade).toContain("implement");
    expect(cascade).toContain("review");
  });

  it("handles cascade of steps in revision state", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "revision" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "done" },
    };
    const cascade = resolveTransitiveCascade(linearSteps, states, "research");
    expect(cascade).toContain("plan");
  });

  it("returns empty array for a step with no dependents", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "done" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "revision" },
    };
    const cascade = resolveTransitiveCascade(linearSteps, states, "review");
    expect(cascade).toEqual([]);
  });

  it("does not include the revised step itself", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "done" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "done" },
    };
    const cascade = resolveTransitiveCascade(linearSteps, states, "research");
    expect(cascade).not.toContain("research");
  });
});

// ---------------------------------------------------------------------------
// isTaskComplete
// ---------------------------------------------------------------------------

describe("isTaskComplete", () => {
  it("returns true when all steps are done", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "done" },
      "task-breakdown": { state: "done" },
      implement: { state: "done" },
      review: { state: "done" },
    };
    expect(isTaskComplete(states)).toBe(true);
  });

  it("returns false when any step is ready", () => {
    const states: Record<string, StepState> = {
      research: { state: "ready" },
      plan: { state: "blocked" },
    };
    expect(isTaskComplete(states)).toBe(false);
  });

  it("returns false when any step is blocked", () => {
    const states: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "blocked" },
    };
    expect(isTaskComplete(states)).toBe(false);
  });

  it("returns false when any step is in revision", () => {
    const states: Record<string, StepState> = {
      research: { state: "revision" },
      plan: { state: "done" },
    };
    expect(isTaskComplete(states)).toBe(false);
  });

  it("returns true for a single done step", () => {
    expect(isTaskComplete({ solo: { state: "done" } })).toBe(true);
  });
});
