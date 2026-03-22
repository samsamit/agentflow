import type { StepConfig } from "../flow/schema.js";
import type { StepState } from "./schema.js";

/**
 * Computes the initial step states for a new task.
 * Steps with no `requires` (or an empty array) are `ready`.
 * All others are `blocked`.
 * Pure function — no filesystem access.
 */
export function getInitialStepStates(steps: StepConfig[]): Record<string, StepState> {
  const result: Record<string, StepState> = {};
  for (const step of steps) {
    const hasRequires = Array.isArray(step.requires) && step.requires.length > 0;
    result[step.name] = { state: hasRequires ? "blocked" : "ready" };
  }
  return result;
}
