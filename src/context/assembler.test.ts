import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { FlowConfig } from "../flow/schema.js";
import type { StepState } from "../task/schema.js";
import { assembleContext, assembleContextDebug } from "./assembler.js";

/**
 * Helper to build a minimal temp project directory for context tests.
 */
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-context-test-"));
}

function makeFlowDir(projectRoot: string, flowName: string): string {
  const dir = path.join(projectRoot, "agentFlow", "flows", flowName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeInstructionsDir(projectRoot: string, flowName: string): string {
  const dir = path.join(projectRoot, "agentFlow", "flows", flowName, "instructions");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeTaskDir(projectRoot: string, taskName: string): string {
  const dir = path.join(projectRoot, "agentFlow", "tasks", taskName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("assembleContext — ready state", () => {
  it("includes step name, description, instructions, generates instruction, and complete command", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    makeTaskDir(projectRoot, "my-task");

    // Write instructions file
    fs.writeFileSync(path.join(instrDir, "research.md"), "Research the domain thoroughly.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research the problem domain",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: {
            instructions: "research.md",
          },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: stepState,
    };

    const result = assembleContext({
      stepName: "research",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    expect(result).toContain('<context step="research" task="my-task"');
    expect(result).toContain('description="Research the problem domain"');
    expect(result).toContain("Research the domain thoroughly.");
    expect(result).toContain('<generates file="agentFlow/tasks/my-task/research.md"');
    expect(result).toContain("agentflow complete --step research --task my-task");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("inlines reference files resolved from project root", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "research.md"), "Instructions content.\n");

    // Reference file in project root
    fs.mkdirSync(path.join(projectRoot, "docs"), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, "docs", "requirements.md"),
      "# Requirements\nBe fast.\n",
    );

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: {
            instructions: "research.md",
            references: ["docs/requirements.md"],
          },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };

    const result = assembleContext({
      stepName: "research",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: stepState },
    });

    expect(result).toContain("# Requirements");
    expect(result).toContain("Be fast.");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("inlines upstream step generated file when step is done", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "plan.md"), "Create a plan.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "# Research Output\nFindings here.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          description: "Plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: {
            instructions: "plan.md",
            steps: ["research"],
          },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "done" },
      plan: stepState,
    };

    const result = assembleContext({
      stepName: "plan",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    expect(result).toContain("# Research Output");
    expect(result).toContain("Findings here.");

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — optional skipped upstream step", () => {
  it("outputs a note for optional step not done", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "plan.md"), "Create a plan.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: false,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          description: "Plan",
          required: true,
          requires: [],
          generates: "plan.md",
          generateStrategy: "replace",
          context: {
            instructions: "plan.md",
            steps: ["research"],
          },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "ready" },
      plan: stepState,
    };

    const result = assembleContext({
      stepName: "plan",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    expect(result).toContain('<skipped-step step="research">');
    expect(result).toContain("Optional step was not completed — skipping context injection.");

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — missing required upstream file", () => {
  it("throws when required upstream step is done but file is missing", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "plan.md"), "Create a plan.\n");
    // Note: research.md is NOT written to the task dir

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          description: "Plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: {
            instructions: "plan.md",
            steps: ["research"],
          },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "done" },
      plan: stepState,
    };

    expect(() =>
      assembleContext({
        stepName: "plan",
        taskName: "my-task",
        flowName,
        projectRoot,
        flow,
        stepState,
        taskStepStates,
      }),
    ).toThrow('Generated file for step "research" not found:');

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — revision state", () => {
  it("includes revision block with previous output and reviewer feedback", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "research.md"), "Research instructions.\n");
    // The step being revised has its previous output
    fs.writeFileSync(path.join(taskDir, "research.md"), "Old research output.\n");
    // The reviewer step has its output
    fs.writeFileSync(path.join(taskDir, "review.md"), "Review feedback: improve section 2.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: {
            instructions: "research.md",
          },
        },
        {
          name: "review",
          description: "Review",
          required: true,
          requires: ["research"],
          generates: "review.md",
          generateStrategy: "replace",
          context: { instructions: "review.md" },
          validates: ["research"],
        },
      ],
    };

    const stepState: StepState = { state: "revision", revisionCount: 1, revisedBy: "review" };
    const taskStepStates: Record<string, StepState> = {
      research: stepState,
      review: { state: "done" },
    };

    const result = assembleContext({
      stepName: "research",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    expect(result).toContain('<revision revised-by="review">');
    expect(result).toContain("This step is being revised.");
    expect(result).toContain("Old research output.");
    expect(result).toContain("Review feedback: improve section 2.");
    expect(result).toContain("Rework this step based on the review feedback above.");

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — :ref in context.steps", () => {
  it("emits a reference line instead of inlining file content when step is :ref", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "plan.md"), "Create a plan.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "# Research Output\nFindings here.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          description: "Plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: {
            instructions: "plan.md",
            steps: ["research:ref"],
          },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "done" },
      plan: stepState,
    };

    const result = assembleContext({
      stepName: "plan",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    // Should emit reference tag, not inline content
    expect(result).toContain('<step-ref step="research"');
    expect(result).toContain("agentFlow/tasks/my-task/research.md");
    expect(result).toContain("Read the file at the path above before proceeding.");
    // Should NOT inline the file content
    expect(result).not.toContain("Findings here.");

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — :ref in validates", () => {
  it("emits an evaluate reference line instead of inlining file content", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "review.md"), "Review all outputs.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research findings.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "review",
          description: "Review everything",
          required: true,
          requires: ["research"],
          generates: "review.md",
          generateStrategy: "replace",
          context: { instructions: "review.md" },
          validates: ["research:ref"],
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "done" },
      review: stepState,
    };

    const result = assembleContext({
      stepName: "review",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    // Should emit evaluate-ref tag, not inline content
    expect(result).toContain('<evaluate-ref step="research"');
    expect(result).toContain("agentFlow/tasks/my-task/research.md");
    expect(result).toContain("pass/fail decision");
    // Should NOT inline the file content
    expect(result).not.toContain("Research findings.");

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — validates steps", () => {
  it("outputs validated files, generates instruction, then evaluation instruction (no separate complete line)", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "review.md"), "Review all outputs.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research findings.\n");
    fs.writeFileSync(path.join(taskDir, "plan.md"), "The plan.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          description: "Plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: { instructions: "plan.md" },
        },
        {
          name: "review",
          description: "Review everything",
          required: true,
          requires: ["plan"],
          generates: "review.md",
          generateStrategy: "replace",
          context: {
            instructions: "review.md",
          },
          validates: ["research", "plan"],
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "done" },
      plan: { state: "done" },
      review: stepState,
    };

    const result = assembleContext({
      stepName: "review",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    // Should contain validated step files inside evaluate tags
    expect(result).toContain('<evaluate step="research"');
    expect(result).toContain('<evaluate step="plan"');
    expect(result).toContain("Research findings.");
    expect(result).toContain("The plan.");

    // Should contain evaluation instruction inside next-command tag
    expect(result).toContain("<next-command>");
    expect(result).toContain("Evaluate each of the above steps and decide pass or fail.");
    expect(result).toContain("agentflow complete --step review --task my-task");
    expect(result).toContain("agentflow revise --step");
    expect(result).toContain("--from review");

    // Should NOT contain a standalone "When this step is complete, run:" line
    expect(result).not.toContain("When this step is complete, run:");

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContextDebug", () => {
  it("returns an entry for the instructions file with correct label, lines, and tokens", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    makeTaskDir(projectRoot, "my-task");

    const content = "Do the research.\nBe thorough.\n";
    fs.writeFileSync(path.join(instrDir, "research.md"), content);

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const entries = assembleContextDebug({
      stepName: "research",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: stepState },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toContain("research.md");
    expect(entries[0]?.lines).toBe(content.split("\n").length);
    expect(entries[0]?.tokens).toBe(Math.ceil(content.length / 4));

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("includes reference files", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "research.md"), "Instructions.\n");
    fs.mkdirSync(path.join(projectRoot, "docs"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "docs", "requirements.md"), "# Requirements\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md", references: ["docs/requirements.md"] },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const entries = assembleContextDebug({
      stepName: "research",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: stepState },
    });

    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.label === "docs/requirements.md")).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("includes upstream step output files (done, non-ref)", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "plan.md"), "Plan instructions.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research output.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: { instructions: "plan.md", steps: ["research"] },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const entries = assembleContextDebug({
      stepName: "plan",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: { state: "done" }, plan: stepState },
    });

    expect(entries.some((e) => e.label.includes("research.md"))).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("excludes :ref upstream steps", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "plan.md"), "Plan instructions.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research output.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "plan",
          required: true,
          requires: ["research"],
          generates: "plan.md",
          generateStrategy: "replace",
          context: { instructions: "plan.md", steps: ["research:ref"] },
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const entries = assembleContextDebug({
      stepName: "plan",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: { state: "done" }, plan: stepState },
    });

    // Only the instructions file — research.md is :ref so not counted
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toContain("plan.md");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("includes validated step files (non-ref)", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "review.md"), "Review instructions.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research output.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "review",
          required: true,
          requires: ["research"],
          generates: "review.md",
          generateStrategy: "replace",
          context: { instructions: "review.md" },
          validates: ["research"],
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const entries = assembleContextDebug({
      stepName: "review",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: { state: "done" }, review: stepState },
    });

    expect(entries.some((e) => e.label.includes("research.md"))).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("excludes :ref validated steps", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "review.md"), "Review instructions.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research output.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "review",
          required: true,
          requires: ["research"],
          generates: "review.md",
          generateStrategy: "replace",
          context: { instructions: "review.md" },
          validates: ["research:ref"],
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const entries = assembleContextDebug({
      stepName: "review",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: { state: "done" }, review: stepState },
    });

    // Only the instructions file — research.md is :ref so excluded
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toContain("review.md");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("includes revision files when step is in revision state", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "research.md"), "Research instructions.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Old research output.\n");
    fs.writeFileSync(path.join(taskDir, "review.md"), "Review feedback.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "review",
          required: true,
          requires: ["research"],
          generates: "review.md",
          generateStrategy: "replace",
          context: { instructions: "review.md" },
          validates: ["research"],
        },
      ],
    };

    const stepState: StepState = { state: "revision", revisionCount: 1, revisedBy: "review" };
    const entries = assembleContextDebug({
      stepName: "research",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates: { research: stepState, review: { state: "done" } },
    });

    const labels = entries.map((e) => e.label);
    // Both the step's previous output and the reviewer's feedback should be included
    expect(labels.some((l) => l.includes("research.md") && l.includes("my-task"))).toBe(true);
    expect(labels.some((l) => l.includes("review.md") && l.includes("my-task"))).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("assembleContext — deduplication of steps in both context.steps and validates", () => {
  it("injects the step only once via validates when it appears in both context.steps and validates", () => {
    const projectRoot = makeTempDir();
    const flowName = "plan";
    makeFlowDir(projectRoot, flowName);
    const instrDir = makeInstructionsDir(projectRoot, flowName);
    const taskDir = makeTaskDir(projectRoot, "my-task");

    fs.writeFileSync(path.join(instrDir, "review.md"), "Review the research.\n");
    fs.writeFileSync(path.join(taskDir, "research.md"), "Research findings.\n");

    const flow: FlowConfig = {
      name: "plan",
      steps: [
        {
          name: "research",
          description: "Research",
          required: true,
          requires: [],
          generates: "research.md",
          generateStrategy: "replace",
          context: { instructions: "research.md" },
        },
        {
          name: "review",
          description: "Review",
          required: true,
          requires: ["research"],
          generates: "review.md",
          generateStrategy: "replace",
          context: {
            instructions: "review.md",
            steps: ["research"],
          },
          validates: ["research"],
        },
      ],
    };

    const stepState: StepState = { state: "ready" };
    const taskStepStates: Record<string, StepState> = {
      research: { state: "done" },
      review: stepState,
    };

    const result = assembleContext({
      stepName: "review",
      taskName: "my-task",
      flowName,
      projectRoot,
      flow,
      stepState,
      taskStepStates,
    });

    // Content should appear exactly once
    const occurrences = result.split("Research findings.").length - 1;
    expect(occurrences).toBe(1);

    // Should appear under the validates section (evaluate tag), not context.steps (step-output tag)
    expect(result).toContain('<evaluate step="research"');
    expect(result).not.toContain('<step-output step="research"');

    fs.rmSync(projectRoot, { recursive: true });
  });
});
