import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import type { TaskState } from "./schema.js";
import { taskStateSchema } from "./schema.js";

describe("taskStateSchema round-trip", () => {
  it("serializes and parses back to the same data (simple)", () => {
    const state: TaskState = {
      active: true,
      flow: "plan",
      steps: {
        research: { state: "ready" },
        plan: { state: "blocked" },
      },
    };
    const yaml = stringify(state);
    const parsed: unknown = parse(yaml);
    const result = taskStateSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(state);
    }
  });

  it("serializes and parses back with optional fields", () => {
    const state: TaskState = {
      active: false,
      flow: "plan",
      steps: {
        research: { state: "revision", revisionCount: 2, revisedBy: "review" },
        plan: { state: "done" },
        implement: { state: "blocked" },
      },
    };
    const yaml = stringify(state);
    const parsed: unknown = parse(yaml);
    const result = taskStateSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(state);
    }
  });

  it("rejects invalid state values", () => {
    const invalid = {
      active: true,
      flow: "plan",
      steps: { research: { state: "invalid-state" } },
    };
    const result = taskStateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
