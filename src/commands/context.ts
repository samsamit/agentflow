import { assembleContext } from "../context/assembler.js";
import { loadFlow } from "../flow/index.js";
import * as output from "../output.js";
import { resolveTask, setActiveTask } from "../task/resolver.js";

export type ContextArgs = {
  projectRoot?: string;
  stepName: string;
  taskName?: string;
};

/**
 * Core logic for `agentflow context --step <name> [--task <name>]`.
 * Assembles and outputs full context for the given step.
 */
export function contextCommand(args: ContextArgs): void {
  const projectRoot = args.projectRoot ?? process.cwd();

  // Resolve (and validate) the task first, then set it active if explicitly named
  const { name: taskName, state: taskState } = resolveTask(projectRoot, args.taskName);
  if (args.taskName !== undefined) {
    setActiveTask(projectRoot, args.taskName);
  }
  const flow = loadFlow(projectRoot, taskState.flow);

  const stepState = taskState.steps[args.stepName];
  if (stepState === undefined) {
    throw new Error(`Step "${args.stepName}" not found in task "${taskName}".`);
  }

  const content = assembleContext({
    stepName: args.stepName,
    taskName,
    flowName: taskState.flow,
    projectRoot,
    flow,
    stepState,
    taskStepStates: taskState.steps,
  });

  output.stepContext(content);
}

/**
 * CLI handler for `agentflow context`.
 */
export async function contextCommandHandler(options: {
  step: string;
  task?: string;
}): Promise<void> {
  try {
    contextCommand({
      stepName: options.step,
      ...(options.task !== undefined && { taskName: options.task }),
    });
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
