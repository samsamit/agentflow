import { loadFlow } from "../flow/index.js";
import { isTaskComplete, resolveActionableSteps } from "../graph/index.js";
import type { ParallelStep } from "../output.js";
import * as output from "../output.js";
import { writeTaskState } from "../task/io.js";
import { resolveTask, setActiveTask } from "../task/resolver.js";

export type NextArgs = {
  projectRoot?: string;
  taskName?: string;
  parallel?: boolean;
  resume?: boolean;
};

/**
 * Core logic for the `agentflow next` command.
 * Determines the next step(s) to work on and outputs them.
 * Throws on invalid state.
 */
export function nextCommand(args: NextArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();

  // Resolve (and validate) the task first, then set it active if explicitly named
  const {
    name: taskName,
    dir: taskDir,
    state: resolvedState,
  } = resolveTask(projectRoot, args.taskName);
  if (args.taskName !== undefined) {
    setActiveTask(projectRoot, args.taskName);
  }
  const flow = loadFlow(projectRoot, resolvedState.flow);

  // Handle pause gate
  let taskState = resolvedState;
  if (taskState.pausedAfterStep !== undefined) {
    if (args.resume) {
      // Clear the pause and proceed
      const { pausedAfterStep: _removed, ...stateWithoutPause } = taskState;
      writeTaskState(taskDir, stateWithoutPause);
      taskState = stateWithoutPause;
    } else {
      // Output pause message and stop
      const pausedStepConfig = flow.steps.find((s) => s.name === taskState.pausedAfterStep);
      output.flowPaused(taskState.pausedAfterStep, taskName, pausedStepConfig?.generates);
      return;
    }
  }

  if (isTaskComplete(taskState.steps)) {
    output.taskComplete(taskName);
    return;
  }

  const actionableStepNames = resolveActionableSteps(flow.steps, taskState.steps);

  if (actionableStepNames.length === 0) {
    // No actionable steps but not complete — shouldn't normally happen in a valid workflow
    throw new Error(`No open steps found for task "${taskName}".`);
  }

  if (args.parallel) {
    // Return all actionable steps
    const parallelSteps: ParallelStep[] = actionableStepNames.map((name) => {
      const stepConfig = flow.steps.find((s) => s.name === name);
      const subagent = stepConfig?.subagent === false ? undefined : stepConfig?.subagent;
      return subagent !== undefined ? { name, subagent } : { name };
    });
    output.nextParallel(parallelSteps, taskName);
  } else {
    // Return just the first actionable step
    const firstStepName = actionableStepNames[0];
    if (firstStepName === undefined) {
      throw new Error(`No open steps found for task "${taskName}".`);
    }
    const stepState = taskState.steps[firstStepName]?.state ?? "open";
    const status = stepState === "revision" ? "revision" : "open";
    const stepConfig = flow.steps.find((s) => s.name === firstStepName);
    const subagent = stepConfig?.subagent === false ? undefined : stepConfig?.subagent;
    output.nextStep(firstStepName, status, subagent, taskName);
  }
}

/**
 * CLI command handler for `agentflow next`.
 * Parses args from commander, calls nextCommand, exits on error.
 */
export async function nextCommandHandler(options: {
  task?: string;
  parallel?: boolean;
  resume?: boolean;
}): Promise<void> {
  try {
    nextCommand({
      ...(options.task !== undefined && { taskName: options.task }),
      ...(options.parallel !== undefined && { parallel: options.parallel }),
      ...(options.resume !== undefined && { resume: options.resume }),
    });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
