import { loadFlow } from "../flow/index.js";
import { isTaskComplete, resolveReadySteps } from "../graph/index.js";
import type { ParallelStep } from "../output.js";
import * as output from "../output.js";
import { resolveTask, setActiveTask } from "../task/resolver.js";

export type NextArgs = {
  projectRoot?: string;
  taskName?: string;
  parallel?: boolean;
};

/**
 * Core logic for the `agentflow next` command.
 * Determines the next step(s) to work on and outputs them.
 * Throws on invalid state.
 */
export function nextCommand(args: NextArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();

  // Resolve (and validate) the task first, then set it active if explicitly named
  const { name: taskName, state: taskState } = resolveTask(projectRoot, args.taskName);
  if (args.taskName !== undefined) {
    setActiveTask(projectRoot, args.taskName);
  }
  const flow = loadFlow(projectRoot, taskState.flow);

  if (isTaskComplete(taskState.steps)) {
    output.taskComplete(taskName);
    return;
  }

  const readyStepNames = resolveReadySteps(flow.steps, taskState.steps);

  if (readyStepNames.length === 0) {
    // No ready steps but not complete — shouldn't normally happen in a valid workflow
    throw new Error(`No ready steps found for task "${taskName}".`);
  }

  if (args.parallel) {
    // Return all ready steps
    const parallelSteps: ParallelStep[] = readyStepNames.map((name) => {
      const stepConfig = flow.steps.find((s) => s.name === name);
      const subagent = stepConfig?.subagent === false ? undefined : stepConfig?.subagent;
      return subagent !== undefined ? { name, subagent } : { name };
    });
    output.nextParallel(parallelSteps, taskName);
  } else {
    // Return just the first ready step
    const firstStepName = readyStepNames[0];
    if (firstStepName === undefined) {
      throw new Error(`No ready steps found for task "${taskName}".`);
    }
    const stepConfig = flow.steps.find((s) => s.name === firstStepName);
    const subagent = stepConfig?.subagent === false ? undefined : stepConfig?.subagent;
    output.nextStep(firstStepName, subagent, taskName);
  }
}

/**
 * CLI command handler for `agentflow next`.
 * Parses args from commander, calls nextCommand, exits on error.
 */
export async function nextCommandHandler(options: {
  task?: string;
  parallel?: boolean;
}): Promise<void> {
  try {
    nextCommand({
      ...(options.task !== undefined && { taskName: options.task }),
      ...(options.parallel !== undefined && { parallel: options.parallel }),
    });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
