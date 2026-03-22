import * as path from "node:path";
import { DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME } from "../constants.js";
import { loadFlow } from "../flow/index.js";
import type { StepStateEntry } from "../output.js";
import * as output from "../output.js";
import { resolveTask, setActiveTask } from "../task/resolver.js";
import { fileExists } from "../utils/fileIo.js";

export type StateArgs = {
  projectRoot?: string;
  taskName?: string;
};

/**
 * Core logic for the `state` command.
 * Resolves the task (active or named), loads its flow config,
 * and prints each step's status with generates/requires details.
 * Throws on error.
 */
export function stateCommand(args: StateArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();

  // Resolve (and validate) the task first, then set it active if explicitly named
  const { name: taskName, state: taskState } = resolveTask(projectRoot, args.taskName);
  if (args.taskName !== undefined) {
    setActiveTask(projectRoot, args.taskName);
  }
  const flow = loadFlow(projectRoot, taskState.flow);

  const steps: StepStateEntry[] = flow.steps.map((stepConfig) => {
    const stepState = taskState.steps[stepConfig.name];
    const state = stepState?.state ?? "blocked";

    const entry: StepStateEntry = {
      name: stepConfig.name,
      state,
    };

    if (stepConfig.generates) {
      // Show generates info — for all steps that have a generates field
      const generatePath = path.join(TASKS_FOLDER_NAME, taskName, stepConfig.generates);
      const absoluteGeneratePath = path.join(
        projectRoot,
        DEFAULT_ROOT_FOLDER_NAME,
        TASKS_FOLDER_NAME,
        taskName,
        stepConfig.generates,
      );
      entry.generates = stepConfig.generates;
      entry.generatePath = generatePath;
      entry.fileExists = fileExists(absoluteGeneratePath);
    } else if (state === "blocked") {
      // No generates field and blocked — show requires
      entry.requires = stepConfig.requires ?? [];
    }

    return entry;
  });

  output.taskState({
    taskName,
    flowName: taskState.flow,
    active: taskState.active,
    steps,
  });
}

/**
 * CLI command handler for `agentflow state`.
 */
export async function stateCommandHandler(options: { task?: string }): Promise<void> {
  try {
    stateCommand({ ...(options.task !== undefined && { taskName: options.task }) });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
