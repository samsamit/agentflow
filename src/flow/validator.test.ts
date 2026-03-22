import { describe, expect, it } from "vitest";
import type { FlowConfig } from "./schema.js";
import { validateFlow } from "./validator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlow(overrides: Partial<FlowConfig> = {}): FlowConfig {
  return {
    name: "test-flow",
    steps: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid flow passes
// ---------------------------------------------------------------------------

describe("validateFlow — valid flow", () => {
  it("passes for a flow with no steps", () => {
    const result = validateFlow(makeFlow(), []);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for a flow with valid requires chain and instruction files present", () => {
    const flow = makeFlow({
      steps: [
        {
          name: "research",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          requires: ["research"],
          context: { instructions: "plan.md" },
        },
      ],
    });
    const instructionPaths = ["research.md", "plan.md"];
    const result = validateFlow(flow, instructionPaths);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes when context.steps references are valid step names", () => {
    const flow = makeFlow({
      steps: [
        { name: "research", context: { instructions: "research.md", steps: [] } },
        {
          name: "plan",
          requires: ["research"],
          context: { instructions: "plan.md", steps: ["research"] },
        },
      ],
    });
    const result = validateFlow(flow, ["research.md", "plan.md"]);
    expect(result.valid).toBe(true);
  });

  it("passes when validates references are valid step names", () => {
    const flow = makeFlow({
      steps: [
        { name: "implement", context: { instructions: "implement.md" } },
        {
          name: "review",
          validates: ["implement"],
          context: { instructions: "review.md" },
        },
      ],
    });
    const result = validateFlow(flow, ["implement.md", "review.md"]);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Circular dependency detection
// ---------------------------------------------------------------------------

describe("validateFlow — circular requires", () => {
  it("detects a direct self-reference", () => {
    const flow = makeFlow({
      steps: [{ name: "a", requires: ["a"], context: { instructions: "a.md" } }],
    });
    const result = validateFlow(flow, ["a.md"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("circular"))).toBe(true);
  });

  it("detects a two-step cycle: a→b→a", () => {
    const flow = makeFlow({
      steps: [
        { name: "a", requires: ["b"], context: { instructions: "a.md" } },
        { name: "b", requires: ["a"], context: { instructions: "b.md" } },
      ],
    });
    const result = validateFlow(flow, ["a.md", "b.md"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("circular"))).toBe(true);
  });

  it("detects a three-step cycle: a→b→c→a", () => {
    const flow = makeFlow({
      steps: [
        { name: "a", requires: ["b"], context: { instructions: "a.md" } },
        { name: "b", requires: ["c"], context: { instructions: "b.md" } },
        { name: "c", requires: ["a"], context: { instructions: "c.md" } },
      ],
    });
    const result = validateFlow(flow, ["a.md", "b.md", "c.md"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("circular"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unknown step references in requires
// ---------------------------------------------------------------------------

describe("validateFlow — unknown step in requires", () => {
  it("reports an unknown step name in requires", () => {
    const flow = makeFlow({
      steps: [{ name: "plan", requires: ["nonexistent"], context: { instructions: "plan.md" } }],
    });
    const result = validateFlow(flow, ["plan.md"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("nonexistent"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unknown step references in context.steps
// ---------------------------------------------------------------------------

describe("validateFlow — unknown step in context.steps", () => {
  it("reports an unknown step name in context.steps", () => {
    const flow = makeFlow({
      steps: [
        {
          name: "plan",
          context: { instructions: "plan.md", steps: ["ghost"] },
        },
      ],
    });
    const result = validateFlow(flow, ["plan.md"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("ghost"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unknown step references in validates
// ---------------------------------------------------------------------------

describe("validateFlow — unknown step in validates", () => {
  it("reports an unknown step name in validates", () => {
    const flow = makeFlow({
      steps: [
        {
          name: "review",
          validates: ["phantom"],
          context: { instructions: "review.md" },
        },
      ],
    });
    const result = validateFlow(flow, ["review.md"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("phantom"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Missing instruction files
// ---------------------------------------------------------------------------

describe("validateFlow — missing instruction files", () => {
  it("reports a missing instruction file", () => {
    const flow = makeFlow({
      steps: [
        {
          name: "research",
          context: { instructions: "research.md" },
        },
      ],
    });
    // Pass empty list — file is not present
    const result = validateFlow(flow, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("research.md"))).toBe(true);
  });

  it("passes when instruction file is in the provided list", () => {
    const flow = makeFlow({
      steps: [
        {
          name: "research",
          context: { instructions: "research.md" },
        },
      ],
    });
    const result = validateFlow(flow, ["research.md"]);
    expect(result.valid).toBe(true);
  });
});
