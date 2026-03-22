import { describe, it, expect } from "vitest";
import { getInitialStepStates } from "./state.js";
import type { StepConfig } from "../flow/schema.js";

describe("getInitialStepStates", () => {
  it("marks steps with no requires as ready", () => {
    const steps: StepConfig[] = [
      { name: "research", requires: [] },
      { name: "plan", requires: ["research"] },
    ];
    const result = getInitialStepStates(steps);
    expect(result["research"]).toEqual({ state: "ready" });
  });

  it("marks steps with requires as blocked", () => {
    const steps: StepConfig[] = [
      { name: "research", requires: [] },
      { name: "plan", requires: ["research"] },
    ];
    const result = getInitialStepStates(steps);
    expect(result["plan"]).toEqual({ state: "blocked" });
  });

  it("marks step with undefined requires as ready", () => {
    const steps: StepConfig[] = [{ name: "research" }];
    const result = getInitialStepStates(steps);
    expect(result["research"]).toEqual({ state: "ready" });
  });

  it("returns all steps in the result", () => {
    const steps: StepConfig[] = [
      { name: "a" },
      { name: "b", requires: ["a"] },
      { name: "c", requires: ["a", "b"] },
    ];
    const result = getInitialStepStates(steps);
    expect(Object.keys(result)).toEqual(["a", "b", "c"]);
  });
});
