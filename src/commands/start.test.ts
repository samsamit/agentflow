import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_STATE_FILE_NAME } from "../constants.js";
import { readTaskState } from "../task/io.js";
import { startCommand } from "./start.js";

/**
 * Creates a minimal project structure with a root config and a flow config.
 */
function makeTestProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-start-test-"));

  // root config
  fs.mkdirSync(path.join(projectRoot, "agentFlow"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "agentFlow", ".agentflow.yaml"), "defaultFlow: plan\n");

  // tasks folder
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "tasks"), { recursive: true });

  // flow config
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "flows", "plan"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "agentFlow", "flows", "plan", ".agentflow.yaml"),
    `${[
      "name: plan",
      "description: Standard planning workflow",
      "steps:",
      "  - name: research",
      "    description: Research",
      "    requires: []",
      "    context:",
      "      instructions: research.md",
      "  - name: implement",
      "    description: Implement",
      "    requires:",
      "      - research",
      "    context:",
      "      instructions: implement.md",
    ].join("\n")}\n`,
  );

  return projectRoot;
}

describe("startCommand integration", () => {
  it("creates the task directory and .taskState.yaml", () => {
    const projectRoot = makeTestProject();
    startCommand({ projectRoot, taskName: "my-feature" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    expect(fs.existsSync(taskDir)).toBe(true);
    expect(fs.existsSync(path.join(taskDir, TASK_STATE_FILE_NAME))).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("writes correct initial step states", () => {
    const projectRoot = makeTestProject();
    startCommand({ projectRoot, taskName: "my-feature" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    const state = readTaskState(taskDir);

    expect(state.active).toBe(true);
    expect(state.flow).toBe("plan");
    expect(state.steps.research?.state).toBe("ready");
    expect(state.steps.implement?.state).toBe("blocked");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("throws when task already exists", () => {
    const projectRoot = makeTestProject();
    startCommand({ projectRoot, taskName: "my-feature" });

    expect(() => startCommand({ projectRoot, taskName: "my-feature" })).toThrow(
      'Task "my-feature" already exists.',
    );

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("deactivates previously active task when starting a new one", () => {
    const projectRoot = makeTestProject();
    startCommand({ projectRoot, taskName: "task-one" });
    startCommand({ projectRoot, taskName: "task-two" });

    const task1Dir = path.join(projectRoot, "agentFlow", "tasks", "task-one");
    const task2Dir = path.join(projectRoot, "agentFlow", "tasks", "task-two");

    const state1 = readTaskState(task1Dir);
    const state2 = readTaskState(task2Dir);

    expect(state1.active).toBe(false);
    expect(state2.active).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("uses the specified flow when --flow is provided", () => {
    const projectRoot = makeTestProject();

    // Add a second flow
    fs.mkdirSync(path.join(projectRoot, "agentFlow", "flows", "research"), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, "agentFlow", "flows", "research", ".agentflow.yaml"),
      `${[
        "name: research",
        "steps:",
        "  - name: gather",
        "    requires: []",
        "    context:",
        "      instructions: gather.md",
      ].join("\n")}\n`,
    );

    startCommand({ projectRoot, taskName: "my-research", flowName: "research" });

    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-research");
    const state = readTaskState(taskDir);

    expect(state.flow).toBe("research");
    expect(state.steps.gather?.state).toBe("ready");

    fs.rmSync(projectRoot, { recursive: true });
  });
});
