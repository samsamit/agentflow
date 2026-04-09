import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { readTaskState } from "../task/io.js";
import { completeCommand } from "./complete.js";

/**
 * Creates a minimal project structure with a root config and a flow config
 * that mirrors the linear plan flow: research → plan → task-breakdown → implement → review
 */
function makeTestProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-complete-test-"));

  // root config
  fs.mkdirSync(path.join(projectRoot, "agentFlow"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "agentFlow", ".agentflow.yaml"), "defaultFlow: plan\n");

  // tasks folder
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "tasks"), { recursive: true });

  // flow config — linear: research → plan → implement
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "flows", "plan"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "agentFlow", "flows", "plan", ".agentflow.yaml"),
    `${[
      "name: plan",
      "description: Standard planning workflow",
      "maxRevisions: 3",
      "steps:",
      "  - name: research",
      "    description: Research",
      "    requires: []",
      "    context:",
      "      instructions: research.md",
      "  - name: plan-step",
      "    description: Plan",
      "    requires:",
      "      - research",
      "    context:",
      "      instructions: plan-step.md",
      "  - name: implement",
      "    description: Implement",
      "    requires:",
      "      - plan-step",
      "    context:",
      "      instructions: implement.md",
    ].join("\n")}\n`,
  );

  // existing task: research=ready, plan-step=blocked, implement=blocked
  const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(
    path.join(taskDir, ".taskState.yaml"),
    `${[
      "active: true",
      "flow: plan",
      "steps:",
      "  research:",
      "    state: ready",
      "  plan-step:",
      "    state: blocked",
      "  implement:",
      "    state: blocked",
    ].join("\n")}\n`,
  );

  return projectRoot;
}

describe("completeCommand integration", () => {
  it("marks the step as done and unblocks direct downstream steps", () => {
    const projectRoot = makeTestProject();

    completeCommand({ projectRoot, stepName: "research", taskName: "my-feature" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.steps.research?.state).toBe("done");
    expect(state.steps["plan-step"]?.state).toBe("ready");
    expect(state.steps.implement?.state).toBe("blocked");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("clears revisedBy when completing a step in revision state", () => {
    const projectRoot = makeTestProject();

    // Put research into revision state with a revisedBy
    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    fs.writeFileSync(
      path.join(taskDir, ".taskState.yaml"),
      `${[
        "active: true",
        "flow: plan",
        "steps:",
        "  research:",
        "    state: revision",
        "    revisionCount: 1",
        "    revisedBy: plan-step",
        "  plan-step:",
        "    state: ready",
        "  implement:",
        "    state: blocked",
      ].join("\n")}\n`,
    );

    completeCommand({ projectRoot, stepName: "research", taskName: "my-feature" });

    const state = readTaskState(taskDir);
    expect(state.steps.research?.state).toBe("done");
    expect(state.steps.research?.revisedBy).toBeUndefined();

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("throws when step does not exist in the flow", () => {
    const projectRoot = makeTestProject();

    expect(() =>
      completeCommand({ projectRoot, stepName: "nonexistent", taskName: "my-feature" }),
    ).toThrow('Step "nonexistent" not found in flow "plan".');

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("throws when step is not in ready or revision state", () => {
    const projectRoot = makeTestProject();

    expect(() =>
      completeCommand({ projectRoot, stepName: "plan-step", taskName: "my-feature" }),
    ).toThrow('Step "plan-step" is not in a completable state (current state: blocked).');

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("writes pausedAfterStep when completing a step with pauseAfter: true", () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-complete-pause-test-"));

    fs.mkdirSync(path.join(projectRoot, "agentFlow"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "agentFlow", ".agentflow.yaml"), "defaultFlow: plan\n");
    fs.mkdirSync(path.join(projectRoot, "agentFlow", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, "agentFlow", "flows", "plan"), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, "agentFlow", "flows", "plan", ".agentflow.yaml"),
      `${[
        "name: plan",
        "steps:",
        "  - name: research",
        "    pauseAfter: true",
        "    requires: []",
        "    context:",
        "      instructions: research.md",
        "  - name: implement",
        "    requires:",
        "      - research",
        "    context:",
        "      instructions: implement.md",
      ].join("\n")}\n`,
    );

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, ".taskState.yaml"),
      `${[
        "active: true",
        "flow: plan",
        "steps:",
        "  research:",
        "    state: ready",
        "  implement:",
        "    state: blocked",
      ].join("\n")}\n`,
    );

    completeCommand({ projectRoot, stepName: "research", taskName: "my-feature" });

    const state = readTaskState(taskDir);
    expect(state.pausedAfterStep).toBe("research");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("does not write pausedAfterStep when step has no pauseAfter", () => {
    const projectRoot = makeTestProject();

    completeCommand({ projectRoot, stepName: "research", taskName: "my-feature" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);
    expect(state.pausedAfterStep).toBeUndefined();

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("resolves active task when --task is not provided", () => {
    const projectRoot = makeTestProject();

    // No explicit taskName — resolves via active task
    completeCommand({ projectRoot, stepName: "research" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.steps.research?.state).toBe("done");

    fs.rmSync(projectRoot, { recursive: true });
  });
});
