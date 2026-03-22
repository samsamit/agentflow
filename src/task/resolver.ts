import * as path from "node:path";
import { DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME } from "../constants.js";
import { fileExists, listDirs } from "../utils/fileIo.js";
import { readTaskState, writeTaskState } from "./io.js";
import type { TaskState } from "./schema.js";

/**
 * Finds the currently active task in agentFlow/tasks/.
 * Throws if no task is active.
 */
export function resolveActiveTask(projectRoot: string): {
  name: string;
  dir: string;
  state: TaskState;
} {
  const tasksDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME);

  if (!fileExists(tasksDir)) {
    throw new Error("No active task found. Run: agentflow start --task <name>");
  }

  const taskNames = listDirs(tasksDir);

  for (const name of taskNames) {
    const dir = path.join(tasksDir, name);
    try {
      const state = readTaskState(dir);
      if (state.active) {
        return { name, dir, state };
      }
    } catch {
      // Skip tasks with unreadable state files
    }
  }

  throw new Error("No active task found. Run: agentflow start --task <name>");
}

/**
 * Returns the resolved task: the named task if provided, otherwise the active task.
 * Throws if the named task does not exist or if no active task is found.
 */
export function resolveTask(
  projectRoot: string,
  taskName?: string,
): { name: string; dir: string; state: TaskState } {
  if (taskName === undefined) {
    return resolveActiveTask(projectRoot);
  }

  const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);

  if (!fileExists(taskDir)) {
    throw new Error(`Task "${taskName}" not found.`);
  }

  const state = readTaskState(taskDir);
  return { name: taskName, dir: taskDir, state };
}

/**
 * Sets the named task as active (active: true) and deactivates all other tasks.
 * Throws if the named task does not exist.
 */
export function setActiveTask(projectRoot: string, taskName: string): void {
  const tasksDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME);
  const taskNames = fileExists(tasksDir) ? listDirs(tasksDir) : [];

  for (const name of taskNames) {
    const dir = path.join(tasksDir, name);
    try {
      const state = readTaskState(dir);
      const shouldBeActive = name === taskName;
      if (state.active !== shouldBeActive) {
        writeTaskState(dir, { ...state, active: shouldBeActive });
      }
    } catch {
      // Skip tasks with unreadable state files
    }
  }
}
