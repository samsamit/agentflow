import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { readTaskState, writeTaskState } from "./io.js";
import type { TaskState } from "./schema.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-io-test-"));
}

describe("readTaskState / writeTaskState", () => {
  it("round-trips task state through the filesystem", () => {
    const dir = makeTempDir();
    const state: TaskState = {
      active: true,
      flow: "plan",
      steps: {
        research: { state: "ready" },
        plan: { state: "blocked" },
      },
    };
    writeTaskState(dir, state);
    const read = readTaskState(dir);
    expect(read).toEqual(state);
    fs.rmSync(dir, { recursive: true });
  });

  it("round-trips with optional revision fields", () => {
    const dir = makeTempDir();
    const state: TaskState = {
      active: false,
      flow: "plan",
      steps: {
        research: { state: "revision", revisionCount: 1, revisedBy: "review" },
        review: { state: "done" },
      },
    };
    writeTaskState(dir, state);
    const read = readTaskState(dir);
    expect(read).toEqual(state);
    fs.rmSync(dir, { recursive: true });
  });

  it("throws when task state file does not exist", () => {
    const dir = makeTempDir();
    expect(() => readTaskState(dir)).toThrow();
    fs.rmSync(dir, { recursive: true });
  });
});
