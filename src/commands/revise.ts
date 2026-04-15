import { loadFlow } from "../flow/index.js";
import { buildDependencyGraph, resolveTransitiveCascade } from "../graph/index.js";
import * as output from "../output.js";
import { resolveTask, setActiveTask } from "../task/index.js";
import { writeTaskState } from "../task/io.js";

export type ReviseArgs = {
  projectRoot?: string;
  stepName: string;
  fromStep: string;
  taskName?: string;
};

/**
 * Core logic for marking a step for revision.
 * Throws on invalid state (step not found, etc.).
 * If maxRevisions is reached, outputs a warning and returns without changing state.
 */
export function reviseCommand(args: ReviseArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();
  const { stepName, fromStep, taskName } = args;

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

  // Increment revisionCount
  const currentStepState = taskState.steps[stepName] ?? { state: "done" as const };
  const newRevisionCount = (currentStepState.revisionCount ?? 0) + 1;

  // Check against maxRevisions
  const maxRevisions = flow.maxRevisions;
  if (maxRevisions !== undefined && newRevisionCount > maxRevisions) {
    output.revisionIgnored(stepName, maxRevisions);
    return;
  }

  // Mark step as revision with updated revisionCount and revisedBy
  const updatedSteps = {
    ...taskState.steps,
    [stepName]: {
      ...currentStepState,
      state: "revision" as const,
      revisionCount: newRevisionCount,
      revisedBy: fromStep,
    },
  };

  // Find all transitively dependent steps and reset their state
  const cascaded = resolveTransitiveCascade(flow.steps, updatedSteps, stepName);
  const depGraph = buildDependencyGraph(flow.steps);
  const cascadedReady: string[] = [];
  const cascadedBlocked: string[] = [];

  for (const name of cascaded) {
    const s = updatedSteps[name];
    const requires = depGraph.get(name) ?? [];
    const allDepsDone = requires.every((dep) => updatedSteps[dep]?.state === "done");
    const newState = allDepsDone ? ("open" as const) : ("blocked" as const);
    if (s !== undefined) {
      const { revisedBy: _revisedBy, ...rest } = s;
      updatedSteps[name] = { ...rest, state: newState };
    } else {
      updatedSteps[name] = { state: newState };
    }
    if (newState === "open") {
      cascadedReady.push(name);
    } else {
      cascadedBlocked.push(name);
    }
  }

  // Write updated state
  writeTaskState(taskDir, { ...taskState, steps: updatedSteps });

  // Output — maxRevisions is required by the output signature; use 0 if not set (shouldn't happen
  // in practice since we only show count/max when maxRevisions is defined, but the output.ts
  // function always accepts a number)
  output.stepRevised(stepName, newRevisionCount, maxRevisions ?? 0, cascadedReady, cascadedBlocked);
}

/**
 * CLI command handler for `agentflow revise`.
 * Parses args from commander, calls reviseCommand, exits on error.
 */
export async function reviseCommandHandler(options: {
  step: string;
  from: string;
  task?: string;
}): Promise<void> {
  try {
    reviseCommand({
      stepName: options.step,
      fromStep: options.from,
      ...(options.task !== undefined && { taskName: options.task }),
    });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
