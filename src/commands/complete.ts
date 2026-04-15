import { loadFlow } from "../flow/index.js";
import { resolveUnblockedSteps } from "../graph/index.js";
import * as output from "../output.js";
import { resolveTask, setActiveTask } from "../task/index.js";
import { writeTaskState } from "../task/io.js";

export type CompleteArgs = {
  projectRoot?: string;
  stepName: string;
  taskName?: string;
};

/**
 * Core logic for completing a step.
 * Throws on invalid state (step not found, step not completable, etc.).
 */
export function completeCommand(args: CompleteArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();
  const { stepName, taskName } = args;

  // Resolve (and validate) the task first, then set it active if explicitly named
  const { state: taskState, dir: taskDir } = resolveTask(projectRoot, taskName);
  if (taskName !== undefined) {
    setActiveTask(projectRoot, taskName);
  }

  const flow = loadFlow(projectRoot, taskState.flow);

  // Validate the step exists in the flow
  if (!flow.steps.some((s) => s.name === stepName)) {
    throw new Error(`Step "${stepName}" not found in flow "${taskState.flow}".`);
  }

  // Validate the step is in a completable state (open or revision)
  const currentStepState = taskState.steps[stepName];
  if (
    currentStepState === undefined ||
    (currentStepState.state !== "open" && currentStepState.state !== "revision")
  ) {
    const currentState = currentStepState?.state ?? "unknown";
    throw new Error(
      `Step "${stepName}" is not in a completable state (current state: ${currentState}).`,
    );
  }

  // Build updated steps: mark step as done, omit revisedBy
  // Construct explicitly to satisfy exactOptionalPropertyTypes (revisedBy must be absent, not undefined)
  const doneStep =
    currentStepState.revisionCount !== undefined
      ? { state: "done" as const, revisionCount: currentStepState.revisionCount }
      : { state: "done" as const };
  const updatedSteps = {
    ...taskState.steps,
    [stepName]: doneStep,
  };

  // Find which blocked steps are now unblocked
  const unblocked = resolveUnblockedSteps(flow.steps, updatedSteps, stepName);

  // Mark newly unblocked steps as open
  for (const name of unblocked) {
    const s = updatedSteps[name];
    if (s !== undefined) {
      updatedSteps[name] = { ...s, state: "open" as const };
    }
  }

  // Check if this step has pauseAfter set
  const stepConfig = flow.steps.find((s) => s.name === stepName);
  const pauseAfter = stepConfig?.pauseAfter === true;

  // Write updated state
  const updatedTaskState = pauseAfter
    ? { ...taskState, steps: updatedSteps, pausedAfterStep: stepName }
    : { ...taskState, steps: updatedSteps };
  writeTaskState(taskDir, updatedTaskState);

  output.stepComplete(stepName, unblocked, pauseAfter);
}

/**
 * CLI command handler for `agentflow complete`.
 * Parses args from commander, calls completeCommand, exits on error.
 */
export async function completeCommandHandler(options: {
  step: string;
  task?: string;
}): Promise<void> {
  try {
    completeCommand({
      stepName: options.step,
      ...(options.task !== undefined && { taskName: options.task }),
    });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
