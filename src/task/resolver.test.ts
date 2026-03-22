import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { writeTaskState } from "./io.js";
import { resolveActiveTask, resolveTask, setActiveTask } from "./resolver.js";
import type { TaskState } from "./schema.js";

function makeTempProject(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-resolver-test-"));
  // Create agentFlow/tasks/ structure
  fs.mkdirSync(path.join(tmpDir, "agentFlow", "tasks"), { recursive: true });
  return tmpDir;
}

function makeTaskDir(projectRoot: string, taskName: string): string {
  const taskDir = path.join(projectRoot, "agentFlow", "tasks", taskName);
  fs.mkdirSync(taskDir, { recursive: true });
  return taskDir;
}

describe("resolveActiveTask", () => {
  it("throws when no tasks directory exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-empty-"));
    fs.mkdirSync(path.join(tmpDir, "agentFlow"), { recursive: true });
    expect(() => resolveActiveTask(tmpDir)).toThrow(
      "No active task found. Run: agentflow start --task <name>",
    );
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when tasks directory is empty", () => {
    const projectRoot = makeTempProject();
    expect(() => resolveActiveTask(projectRoot)).toThrow(
      "No active task found. Run: agentflow start --task <name>",
    );
    fs.rmSync(projectRoot, { recursive: true });
  });

  it("throws when no task is active", () => {
    const projectRoot = makeTempProject();
    const taskDir = makeTaskDir(projectRoot, "my-feature");
    const state: TaskState = {
      active: false,
      flow: "plan",
      steps: { research: { state: "ready" } },
    };
    writeTaskState(taskDir, state);
    expect(() => resolveActiveTask(projectRoot)).toThrow(
      "No active task found. Run: agentflow start --task <name>",
    );
    fs.rmSync(projectRoot, { recursive: true });
  });

  it("returns the active task when one exists", () => {
    const projectRoot = makeTempProject();
    const taskDir = makeTaskDir(projectRoot, "my-feature");
    const state: TaskState = {
      active: true,
      flow: "plan",
      steps: { research: { state: "ready" } },
    };
    writeTaskState(taskDir, state);
    const result = resolveActiveTask(projectRoot);
    expect(result.name).toBe("my-feature");
    expect(result.state.active).toBe(true);
    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("resolveTask", () => {
  it("returns active task when no taskName given", () => {
    const projectRoot = makeTempProject();
    const taskDir = makeTaskDir(projectRoot, "my-feature");
    const state: TaskState = {
      active: true,
      flow: "plan",
      steps: { research: { state: "ready" } },
    };
    writeTaskState(taskDir, state);
    const result = resolveTask(projectRoot);
    expect(result.name).toBe("my-feature");
    fs.rmSync(projectRoot, { recursive: true });
  });

  it("returns named task when taskName given", () => {
    const projectRoot = makeTempProject();
    const taskDir = makeTaskDir(projectRoot, "other-task");
    const state: TaskState = {
      active: false,
      flow: "plan",
      steps: { research: { state: "ready" } },
    };
    writeTaskState(taskDir, state);
    const result = resolveTask(projectRoot, "other-task");
    expect(result.name).toBe("other-task");
    fs.rmSync(projectRoot, { recursive: true });
  });

  it("throws when named task does not exist", () => {
    const projectRoot = makeTempProject();
    expect(() => resolveTask(projectRoot, "nonexistent")).toThrow();
    fs.rmSync(projectRoot, { recursive: true });
  });
});

describe("setActiveTask", () => {
  it("sets the named task as active and deactivates others", () => {
    const projectRoot = makeTempProject();
    const task1Dir = makeTaskDir(projectRoot, "task-one");
    const task2Dir = makeTaskDir(projectRoot, "task-two");

    const state1: TaskState = {
      active: true,
      flow: "plan",
      steps: { research: { state: "ready" } },
    };
    const state2: TaskState = {
      active: false,
      flow: "plan",
      steps: { research: { state: "ready" } },
    };
    writeTaskState(task1Dir, state1);
    writeTaskState(task2Dir, state2);

    setActiveTask(projectRoot, "task-two");

    const result1 = resolveTask(projectRoot, "task-one");
    const result2 = resolveTask(projectRoot, "task-two");

    expect(result1.state.active).toBe(false);
    expect(result2.state.active).toBe(true);

    fs.rmSync(projectRoot, { recursive: true });
  });
});
