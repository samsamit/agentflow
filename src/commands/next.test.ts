import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readTaskState } from "../task/io.js";
import { nextCommand } from "./next.js";

function makeTestProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-next-test-"));

  fs.mkdirSync(path.join(projectRoot, "agentFlow"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "agentFlow", ".agentflow.yaml"), "defaultFlow: plan\n");
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "agentFlow", "flows", "plan"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "agentFlow", "flows", "plan", ".agentflow.yaml"),
    [
      "name: plan",
      "steps:",
      "  - name: research",
      "    pauseAfter: true",
      "    generates: research.md",
      "    requires: []",
      "    context:",
      "      instructions: research.md",
      "  - name: implement",
      "    requires:",
      "      - research",
      "    context:",
      "      instructions: implement.md",
    ].join("\n") + "\n",
  );

  return projectRoot;
}

function makePausedTask(projectRoot: string): string {
  const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(
    path.join(taskDir, ".taskState.yaml"),
    [
      "active: true",
      "flow: plan",
      "pausedAfterStep: research",
      "steps:",
      "  research:",
      "    state: done",
      "  implement:",
      "    state: ready",
    ].join("\n") + "\n",
  );
  return taskDir;
}

describe("nextCommand pause behavior", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("outputs a pause message when pausedAfterStep is set", () => {
    const projectRoot = makeTestProject();
    makePausedTask(projectRoot);

    nextCommand({ projectRoot, taskName: "my-feature" });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("Flow paused after step");
    expect(output).toContain("research");
    expect(output).toContain("agentflow next --resume");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("pause message includes the generated file path", () => {
    const projectRoot = makeTestProject();
    makePausedTask(projectRoot);

    nextCommand({ projectRoot, taskName: "my-feature" });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("research.md");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("clears pausedAfterStep and returns next step when --resume is passed", () => {
    const projectRoot = makeTestProject();
    const taskDir = makePausedTask(projectRoot);

    nextCommand({ projectRoot, taskName: "my-feature", resume: true });

    const state = readTaskState(taskDir);
    expect(state.pausedAfterStep).toBeUndefined();

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("implement");
    expect(output).not.toContain("Flow paused");

    fs.rmSync(projectRoot, { recursive: true });
  });

  it("runs normally when --resume is passed but task is not paused", () => {
    const projectRoot = makeTestProject();
    const taskDir = path.join(projectRoot, "agentFlow", "tasks", "my-feature");
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, ".taskState.yaml"),
      [
        "active: true",
        "flow: plan",
        "steps:",
        "  research:",
        "    state: ready",
        "  implement:",
        "    state: blocked",
      ].join("\n") + "\n",
    );

    expect(() => nextCommand({ projectRoot, taskName: "my-feature", resume: true })).not.toThrow();

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("research");
    expect(output).not.toContain("Flow paused");

    fs.rmSync(projectRoot, { recursive: true });
  });
});
