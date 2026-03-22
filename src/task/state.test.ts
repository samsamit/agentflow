import { describe, expect, it } from "vitest";
import type { StepConfig } from "../flow/schema.js";
import { getInitialStepStates } from "./state.js";

const ctx = { instructions: "instructions.md" };

describe("getInitialStepStates", () => {
  it("marks steps with no requires as ready", () => {
    const steps: StepConfig[] = [
      { name: "research", requires: [], context: ctx },
      { name: "plan", requires: ["research"], context: ctx },
    ];
    const result = getInitialStepStates(steps);
    expect(result.research).toEqual({ state: "ready" });
  });

  it("marks steps with requires as blocked", () => {
    const steps: StepConfig[] = [
      { name: "research", requires: [], context: ctx },
      { name: "plan", requires: ["research"], context: ctx },
    ];
    const result = getInitialStepStates(steps);
    expect(result.plan).toEqual({ state: "blocked" });
  });

  it("marks step with undefined requires as ready", () => {
    const steps: StepConfig[] = [{ name: "research", context: ctx }];
    const result = getInitialStepStates(steps);
    expect(result.research).toEqual({ state: "ready" });
  });

  it("returns all steps in the result", () => {
    const steps: StepConfig[] = [
      { name: "a", context: ctx },
      { name: "b", requires: ["a"], context: ctx },
      { name: "c", requires: ["a", "b"], context: ctx },
    ];
    const result = getInitialStepStates(steps);
    expect(Object.keys(result)).toEqual(["a", "b", "c"]);
  });
});
