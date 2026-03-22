import * as path from "node:path";
import { parse, stringify } from "yaml";
import { TASK_STATE_FILE_NAME } from "../constants.js";
import { readFile, writeFile } from "../utils/fileIo.js";
import type { TaskState } from "./schema.js";
import { taskStateSchema } from "./schema.js";

/**
 * Reads and validates the .taskState.yaml from the given task directory.
 * Throws if the file is missing or the content fails schema validation.
 */
export function readTaskState(taskDir: string): TaskState {
  const filePath = path.join(taskDir, TASK_STATE_FILE_NAME);
  const raw = readFile(filePath);
  const parsed: unknown = parse(raw);
  const result = taskStateSchema.safeParse(parsed);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Task state is invalid at ${filePath}: ${messages}`);
  }
  return result.data;
}

/**
 * Serializes the given TaskState to YAML and writes it to .taskState.yaml
 * in the given task directory.
 */
export function writeTaskState(taskDir: string, state: TaskState): void {
  const filePath = path.join(taskDir, TASK_STATE_FILE_NAME);
  const content = stringify(state);
  writeFile(filePath, content);
}
