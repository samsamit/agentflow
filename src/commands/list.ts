import * as path from "node:path";
import { DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME } from "../constants.js";
import { listFlowNames, loadFlow } from "../flow/index.js";
import type { FlowEntry, TaskEntry } from "../output.js";
import * as output from "../output.js";
import { readTaskState } from "../task/io.js";
import { fileExists, listDirs } from "../utils/fileIo.js";

export type ListArgs = {
  projectRoot?: string;
};

/**
 * Lists all flows in the project and prints them.
 * Exits cleanly with a message if no flows exist.
 */
export function listFlowsCommand(args: ListArgs = {}): void {
  const projectRoot = args.projectRoot ?? process.cwd();

  const flowNames = listFlowNames(projectRoot);

  if (flowNames.length === 0) {
    output.info("No flows found. Add a flow config under agentFlow/flows/.");
    return;
  }

  const flows: FlowEntry[] = [];

  for (const name of flowNames) {
    try {
      const flow = loadFlow(projectRoot, name);
      flows.push({ name: flow.name, description: flow.description ?? "" });
    } catch {
      // Skip flows that fail to load
      flows.push({ name, description: "(invalid config)" });
    }
  }

  output.flowList(flows);
}

/**
 * Lists all tasks in the project and prints their status.
 * Exits cleanly with a message if no tasks exist.
 */
export function listTasksCommand(args: ListArgs = {}): void {
  const projectRoot = args.projectRoot ?? process.cwd();

  const tasksDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME);

  if (!fileExists(tasksDir)) {
    output.info("No tasks found. Run: agentflow start --task <name>");
    return;
  }

  const taskNames = listDirs(tasksDir);

  if (taskNames.length === 0) {
    output.info("No tasks found. Run: agentflow start --task <name>");
    return;
  }

  const tasks: TaskEntry[] = [];

  for (const name of taskNames) {
    const taskDir = path.join(tasksDir, name);
    try {
      const state = readTaskState(taskDir);
      const totalSteps = Object.keys(state.steps).length;
      const doneSteps = Object.values(state.steps).filter((s) => s.state === "done").length;
      tasks.push({
        name,
        active: state.active,
        flowName: state.flow,
        doneSteps,
        totalSteps,
      });
    } catch {
      // Skip tasks with unreadable state files
    }
  }

  if (tasks.length === 0) {
    output.info("No tasks found. Run: agentflow start --task <name>");
    return;
  }

  output.taskList(tasks);
}

/**
 * CLI command handler for `agentflow list flows`.
 */
export async function listFlowsCommandHandler(): Promise<void> {
  try {
    listFlowsCommand();
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}

/**
 * CLI command handler for `agentflow list tasks`.
 */
export async function listTasksCommandHandler(): Promise<void> {
  try {
    listTasksCommand();
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
