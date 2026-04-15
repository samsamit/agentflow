import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture stdout writes
let captured: string;

beforeEach(() => {
  captured = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    captured += chunk.toString();
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    captured += chunk.toString();
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("output.taskStarted", () => {
  it("prints task name, flow name, active steps, and next command", async () => {
    const { taskStarted } = await import("./output.js");
    taskStarted("my-feature", "plan", ["research"]);
    expect(captured).toBe(
      "Task started: my-feature\nFlow: plan\nActive steps: research\nRun: agentflow next\n",
    );
  });

  it("joins multiple active steps with comma", async () => {
    const { taskStarted } = await import("./output.js");
    taskStarted("my-feature", "plan", ["research", "setup"]);
    expect(captured).toContain("Active steps: research, setup");
  });
});

describe("output.nextStep", () => {
  it("prints step name, status, and run command (no subagent)", async () => {
    const { nextStep } = await import("./output.js");
    nextStep("research", "open");
    expect(captured).toBe(
      "Step: research\nStatus: open\nRun: agentflow context --step research\n",
    );
  });

  it("prints revision status", async () => {
    const { nextStep } = await import("./output.js");
    nextStep("research", "revision");
    expect(captured).toBe(
      "Step: research\nStatus: revision\nRun: agentflow context --step research\n",
    );
  });

  it("prints named subagent variant", async () => {
    const { nextStep } = await import("./output.js");
    nextStep("research", "open", "researcher", "my-feature");
    expect(captured).toBe(
      'Step: research\nStatus: open\nSubagent: spawn subagent "researcher"\nThen run: agentflow context --step research --task my-feature\n',
    );
  });

  it("prints generic subagent variant when subagent is true", async () => {
    const { nextStep } = await import("./output.js");
    nextStep("research", "open", true, "my-feature");
    expect(captured).toBe(
      "Step: research\nStatus: open\nSubagent: spawn a subagent\nThen run: agentflow context --step research --task my-feature\n",
    );
  });
});

describe("output.nextParallel", () => {
  it("prints parallel steps without subagents", async () => {
    const { nextParallel } = await import("./output.js");
    nextParallel([{ name: "research" }, { name: "setup" }]);
    expect(captured).toBe(
      "Steps ready for parallel execution:\n- research: run agentflow context --step research\n- setup: run agentflow context --step setup\n",
    );
  });

  it("prints parallel steps with subagents", async () => {
    const { nextParallel } = await import("./output.js");
    nextParallel(
      [
        { name: "research", subagent: "researcher" },
        { name: "setup", subagent: "setup" },
      ],
      "my-feature",
    );
    expect(captured).toBe(
      'Steps ready for parallel execution. Spawn a subagent for each step below:\n- research: spawn subagent "researcher", then run agentflow context --step research --task my-feature\n- setup: spawn subagent "setup", then run agentflow context --step setup --task my-feature\nRun all subagents in parallel before proceeding.\n',
    );
  });
});

describe("output.taskComplete", () => {
  it("prints task complete message", async () => {
    const { taskComplete } = await import("./output.js");
    taskComplete("my-feature");
    expect(captured).toBe("Task complete: my-feature\nAll steps are done.\n");
  });
});

describe("output.stepContext", () => {
  it("prints context content as-is", async () => {
    const { stepContext } = await import("./output.js");
    stepContext("some context block");
    expect(captured).toBe("some context block\n");
  });
});

describe("output.stepComplete", () => {
  it("prints step complete with unblocked steps and next command", async () => {
    const { stepComplete } = await import("./output.js");
    stepComplete("research", ["plan"]);
    expect(captured).toBe("Step complete: research\nUnblocked: plan\nRun: agentflow next\n");
  });

  it("prints multiple unblocked steps joined with comma", async () => {
    const { stepComplete } = await import("./output.js");
    stepComplete("research", ["plan", "setup"]);
    expect(captured).toContain("Unblocked: plan, setup");
  });

  it("omits Unblocked line when no steps unblocked", async () => {
    const { stepComplete } = await import("./output.js");
    stepComplete("research", []);
    expect(captured).toBe("Step complete: research\nRun: agentflow next\n");
  });
});

describe("output.stepRevised", () => {
  it("prints revision info with open and blocked cascaded steps", async () => {
    const { stepRevised } = await import("./output.js");
    stepRevised("research", 2, 3, ["plan"], ["task-breakdown", "implement", "review"]);
    expect(captured).toBe(
      "Step marked for revision: research (revision 2/3)\nCascaded to open: plan\nCascaded to blocked: task-breakdown, implement, review\nRun: agentflow next\n",
    );
  });

  it("omits open line when no steps are open", async () => {
    const { stepRevised } = await import("./output.js");
    stepRevised("research", 1, 3, [], ["plan", "implement"]);
    expect(captured).toBe(
      "Step marked for revision: research (revision 1/3)\nCascaded to blocked: plan, implement\nRun: agentflow next\n",
    );
  });

  it("omits blocked line when no steps are blocked", async () => {
    const { stepRevised } = await import("./output.js");
    stepRevised("research", 1, 3, ["plan", "implement"], []);
    expect(captured).toBe(
      "Step marked for revision: research (revision 1/3)\nCascaded to open: plan, implement\nRun: agentflow next\n",
    );
  });
});

describe("output.revisionIgnored", () => {
  it("prints max revisions warning", async () => {
    const { revisionIgnored } = await import("./output.js");
    revisionIgnored("research", 3);
    expect(captured).toBe(
      'Warning: Step "research" has reached the maximum number of revisions (3/3). Revision ignored.\nRun: agentflow next\n',
    );
  });
});

describe("output.taskState", () => {
  it("prints task state block", async () => {
    const { taskState } = await import("./output.js");
    taskState({
      taskName: "my-feature",
      flowName: "plan",
      active: true,
      steps: [
        {
          name: "research",
          state: "done",
          generates: "research.md",
          generatePath: "tasks/my-feature/research.md",
          fileExists: true,
        },
        {
          name: "plan",
          state: "open",
          generates: "plan.md",
          generatePath: "tasks/my-feature/plan.md",
          fileExists: false,
        },
        { name: "task-breakdown", state: "blocked", requires: ["plan"] },
        { name: "implement", state: "blocked", requires: ["task-breakdown"] },
        { name: "review", state: "blocked", requires: ["implement"] },
      ],
    });
    expect(captured).toContain("Task: my-feature");
    expect(captured).toContain("Flow: plan");
    expect(captured).toContain("Active: true");
    expect(captured).toContain("Steps:");
    expect(captured).toContain("research");
    expect(captured).toContain("done");
    expect(captured).toContain("[exists]");
    expect(captured).toContain("plan");
    expect(captured).toContain("open");
    expect(captured).toContain("[missing]");
    expect(captured).toContain("task-breakdown");
    expect(captured).toContain("blocked");
    expect(captured).toContain("requires: plan");
  });
});

describe("output.flowList", () => {
  it("prints flow list", async () => {
    const { flowList } = await import("./output.js");
    flowList([
      { name: "plan", description: "Standard planning workflow" },
      { name: "research", description: "Deep research workflow" },
    ]);
    expect(captured).toBe(
      "Flows:\nplan        Standard planning workflow\nresearch    Deep research workflow\n",
    );
  });
});

describe("output.taskList", () => {
  it("prints task list", async () => {
    const { taskList } = await import("./output.js");
    taskList([
      { name: "my-feature", active: true, flowName: "plan", doneSteps: 2, totalSteps: 5 },
      { name: "other-task", active: false, flowName: "plan", doneSteps: 5, totalSteps: 5 },
    ]);
    expect(captured).toContain("Tasks:");
    expect(captured).toContain("my-feature");
    expect(captured).toContain("(active)");
    expect(captured).toContain("flow: plan");
    expect(captured).toContain("steps: 2/5 done");
    expect(captured).toContain("other-task");
    expect(captured).toContain("steps: 5/5 done");
  });
});

describe("output.validationPassed", () => {
  it("prints validation passed", async () => {
    const { validationPassed } = await import("./output.js");
    validationPassed("project");
    expect(captured).toBe("Validation passed: project\n");
  });
});

describe("output.validationFailed", () => {
  it("prints validation failed with errors", async () => {
    const { validationFailed } = await import("./output.js");
    validationFailed("my-flow", [
      "Step 'foo' requires unknown step 'bar'",
      "Circular dependency detected",
    ]);
    expect(captured).toContain("Validation failed: my-flow");
    expect(captured).toContain("Step 'foo' requires unknown step 'bar'");
    expect(captured).toContain("Circular dependency detected");
  });
});

describe("output.error", () => {
  it("prints error message from Error object", async () => {
    const { error } = await import("./output.js");
    error(new Error("something went wrong"));
    expect(captured).toContain("Error: something went wrong");
  });

  it("prints unknown error as string", async () => {
    const { error } = await import("./output.js");
    error("raw string error");
    expect(captured).toContain("Error: raw string error");
  });
});

describe("output.errorWithFix", () => {
  it("prints error with fix command", async () => {
    const { errorWithFix } = await import("./output.js");
    errorWithFix("No active task found.", "agentflow start --task <name>");
    expect(captured).toBe("Error: No active task found.\nRun: agentflow start --task <name>\n");
  });
});
