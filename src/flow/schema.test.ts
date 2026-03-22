import { describe, expect, it } from "vitest";
import { FlowConfigSchema } from "./schema.js";

describe("FlowConfigSchema", () => {
  it("accepts a minimal valid flow config", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
      steps: [
        {
          name: "research",
          requires: [],
          context: { instructions: "research.md" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full flow config with all optional fields", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
      description: "Standard planning workflow",
      maxRevisions: 3,
      steps: [
        {
          name: "research",
          description: "Research the problem domain",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          subagent: false,
          context: {
            instructions: "research.md",
            references: ["docs/requirements.md"],
            steps: [],
          },
          validates: [],
        },
        {
          name: "plan",
          description: "Create implementation plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: {
            instructions: "plan.md",
            steps: ["research"],
          },
          validates: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a config missing required name field", () => {
    const result = FlowConfigSchema.safeParse({
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a config missing required steps field", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a step missing required name field", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
      steps: [
        {
          requires: [],
          context: { instructions: "research.md" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid generateStrategy value", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
      steps: [
        {
          name: "research",
          requires: [],
          generateStrategy: "invalid-strategy",
          context: { instructions: "research.md" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts subagent as boolean true", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
      steps: [
        {
          name: "research",
          requires: [],
          subagent: true,
          context: { instructions: "research.md" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts subagent as a named string", () => {
    const result = FlowConfigSchema.safeParse({
      name: "plan",
      steps: [
        {
          name: "research",
          requires: [],
          subagent: "researcher",
          context: { instructions: "research.md" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
