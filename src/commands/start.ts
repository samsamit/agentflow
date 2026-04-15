import * as path from "node:path";
import { DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME } from "../constants.js";
import { loadFlow, resolveFlowName } from "../flow/index.js";
import * as output from "../output.js";
import { writeTaskState } from "../task/io.js";
import { setActiveTask } from "../task/resolver.js";
import { getInitialStepStates } from "../task/state.js";
import { createFolder, fileExists } from "../utils/fileIo.js";

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

  // Determine active (open) steps for output
  const activeSteps = Object.entries(initialSteps)
    .filter(([, s]) => s.state === "open")
    .map(([name]) => name);

  output.taskStarted(taskName, flowName, activeSteps);
}

/**
 * CLI command handler for `agentflow start`.
 * Parses args from commander, calls startCommand, exits on error.
 */
export async function startCommandHandler(options: { task: string; flow?: string }): Promise<void> {
  try {
    startCommand({
      taskName: options.task,
      ...(options.flow !== undefined && { flowName: options.flow }),
    });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
