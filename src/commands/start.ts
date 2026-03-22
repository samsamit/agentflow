import * as path from "path";
import {
  DEFAULT_ROOT_FOLDER_NAME,
  TASKS_FOLDER_NAME,
} from "../constants.js";
import * as output from "../output.js";
import { fileExists, createFolder } from "../utils/fileIo.js";
import { resolveFlowName, loadFlow } from "../flow/index.js";
import { getInitialStepStates } from "../task/state.js";
import { writeTaskState, readTaskState } from "../task/io.js";
import { setActiveTask } from "../task/resolver.js";

export type StartArgs = {
  projectRoot?: string;
  taskName: string;
  flowName?: string;
};

/**
 * Core logic for starting a new task.
 * Throws on invalid state (task already exists, flow not found, etc.).
 */
export function startCommand(args: StartArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();
  const { taskName } = args;

  const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);

  if (fileExists(taskDir)) {
    throw new Error(`Task "${taskName}" already exists.`);
  }

  const flowName = resolveFlowName(projectRoot, args.flowName);
  const flow = loadFlow(projectRoot, flowName);

  const initialSteps = getInitialStepStates(flow.steps);
  const taskState = {
    active: true,
    flow: flowName,
    steps: initialSteps,
  };

  // Create the task directory
  createFolder(taskDir);

  // Write the initial task state
  writeTaskState(taskDir, taskState);

  // Deactivate all other tasks and activate this one
  setActiveTask(projectRoot, taskName);

  // Determine active (ready) steps for output
  const activeSteps = Object.entries(initialSteps)
    .filter(([, s]) => s.state === "ready")
    .map(([name]) => name);

  output.taskStarted(taskName, flowName, activeSteps);
}

/**
 * CLI command handler for `agentflow start`.
 * Parses args from commander, calls startCommand, exits on error.
 */
export async function startCommandHandler(options: { task: string; flow?: string }): Promise<void> {
  try {
    startCommand({ taskName: options.task, flowName: options.flow });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
