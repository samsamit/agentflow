import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { readTaskState } from "../task/io.js";
import { reviseCommand } from "./revise.js";

/**
 * Creates a minimal project with a linear flow: research → plan → implement → review
 * with maxRevisions: 3.
 * Initial task state: research=done, plan=done, implement=done, review=ready
 */
function makeTestProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-revise-test-"));

  // root config
  fs.mkdirSync(path.join(projectRoot, "agentFlow"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "agentFlow", ".agentflow.yaml"), "defaultFlow: plan\n");

  // tasks folder
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "tasks"), { recursive: true });

  // flow config with maxRevisions
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
      "  - name: review",
      "    description: Review",
      "    requires:",
      "      - implement",
      "    context:",
      "      instructions: review.md",
    ].join("\n")}\n`,
  );

  // task: all done except review which is ready
  const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(
    path.join(taskDir, ".taskState.yaml"),
    `${[
      "active: true",
      "flow: plan",
      "steps:",
      "  research:",
      "    state: done",
      "  plan-step:",
      "    state: done",
      "  implement:",
      "    state: done",
      "  review:",
      "    state: ready",
    ].join("\n")}\n`,
  );

  return projectRoot;
}

describe("reviseCommand integration", () => {
  it("sets step to revision and stores revisedBy", () => {
    const projectRoot = makeTestProject();

    reviseCommand({
      projectRoot,
      stepName: "research",
      fromStep: "review",
      taskName: "my-feature",
    });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.steps.research?.state).toBe("revision");
    expect(state.steps.research?.revisedBy).toBe("review");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("increments revisionCount from 0", () => {
    const projectRoot = makeTestProject();

    reviseCommand({
      projectRoot,
      stepName: "research",
      fromStep: "review",
      taskName: "my-feature",
    });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.steps.research?.revisionCount).toBe(1);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("increments revisionCount from existing count", () => {
    const projectRoot = makeTestProject();

    // Pre-set revisionCount to 1
    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    fs.writeFileSync(
      path.join(taskDir, ".taskState.yaml"),
      `${[
        "active: true",
        "flow: plan",
        "steps:",
        "  research:",
        "    state: done",
        "    revisionCount: 1",
        "  plan-step:",
        "    state: done",
        "  implement:",
        "    state: done",
        "  review:",
        "    state: ready",
      ].join("\n")}\n`,
    );

    reviseCommand({
      projectRoot,
      stepName: "research",
      fromStep: "review",
      taskName: "my-feature",
    });

    const state = readTaskState(taskDir);
    expect(state.steps.research?.revisionCount).toBe(2);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("cascades all transitive dependents to ready", () => {
    const projectRoot = makeTestProject();

    reviseCommand({
      projectRoot,
      stepName: "research",
      fromStep: "review",
      taskName: "my-feature",
    });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    // All downstream of research should now be ready
    expect(state.steps["plan-step"]?.state).toBe("ready");
    expect(state.steps.implement?.state).toBe("ready");
    expect(state.steps.review?.state).toBe("ready");

    // research itself is in revision
    expect(state.steps.research?.state).toBe("revision");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("does not cascade research itself", () => {
    const projectRoot = makeTestProject();

    reviseCommand({
      projectRoot,
      stepName: "research",
      fromStep: "review",
      taskName: "my-feature",
    });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.steps.research?.state).toBe("revision");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("ignores revision when maxRevisions is already reached and makes no state changes", () => {
    const projectRoot = makeTestProject();

    // Pre-set revisionCount to 3 (= maxRevisions)
    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    fs.writeFileSync(
      path.join(taskDir, ".taskState.yaml"),
      `${[
        "active: true",
        "flow: plan",
        "steps:",
        "  research:",
        "    state: done",
        "    revisionCount: 3",
        "  plan-step:",
        "    state: done",
        "  implement:",
        "    state: done",
        "  review:",
        "    state: ready",
      ].join("\n")}\n`,
    );

    reviseCommand({
      projectRoot,
      stepName: "research",
      fromStep: "review",
      taskName: "my-feature",
    });

    const state = readTaskState(taskDir);

    // No state changes — research stays done, downstream stays done
    expect(state.steps.research?.state).toBe("done");
    expect(state.steps.research?.revisionCount).toBe(3);
    expect(state.steps["plan-step"]?.state).toBe("done");
    expect(state.steps.implement?.state).toBe("done");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("throws when step does not exist in the flow", () => {
    const projectRoot = makeTestProject();

    expect(() =>
      reviseCommand({
        projectRoot,
        stepName: "nonexistent",
        fromStep: "review",
        taskName: "my-feature",
      }),
    ).toThrow('Step "nonexistent" not found in flow "plan".');

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("resolves active task when --task is not provided", () => {
    const projectRoot = makeTestProject();

    reviseCommand({ projectRoot, stepName: "research", fromStep: "review" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.steps.research?.state).toBe("revision");

    fs.rmSync(projectRoot, { recursive: true });
  });
});
