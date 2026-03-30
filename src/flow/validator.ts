import type { FlowConfig } from "./schema.js";
import { parseStepRef } from "./schema.js";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Detects cycles in the requires graph using DFS with a recursion stack.
 * Returns the cycle path as an array of step names, or null if no cycle.
 */
function detectCycle(
  stepName: string,
  requiresMap: Map<string, string[]>,
  visited: Set<string>,
  stack: Set<string>,
  path: string[],
): string[] | null {
  visited.add(stepName);
  stack.add(stepName);
  path.push(stepName);

  const deps = requiresMap.get(stepName) ?? [];
  for (const dep of deps) {
    if (!visited.has(dep)) {
      const cycle = detectCycle(dep, requiresMap, visited, stack, path);
      if (cycle !== null) return cycle;
    } else if (stack.has(dep)) {
      // Found cycle — return path from dep to current
      const cycleStart = path.indexOf(dep);
      return path.slice(cycleStart);
    }
  }

  stack.delete(stepName);
  path.pop();
  return null;
}

/**
 * Validates a flow config. Pure — no filesystem access.
 *
 * @param flow - the parsed FlowConfig
 * @param existingInstructionPaths - list of instruction file names that exist
 *   on disk (relative to the flow's instructions/ folder). The caller is
 *   responsible for listing the directory and passing the filenames here.
 */
export function validateFlow(
  flow: FlowConfig,
  existingInstructionPaths: string[],
): ValidationResult {
  const errors: string[] = [];
  const stepNames = new Set(flow.steps.map((s) => s.name));
  const instructionSet = new Set(existingInstructionPaths);

  // Build requires map for cycle detection
  const requiresMap = new Map<string, string[]>();
  for (const step of flow.steps) {
    requiresMap.set(step.name, step.requires ?? []);
  }

  // --- Check unknown requires + context.steps + validates ---
  for (const step of flow.steps) {
    // requires
    for (const dep of step.requires ?? []) {
      if (!stepNames.has(dep)) {
        errors.push(`Step "${step.name}" requires unknown step "${dep}".`);
      }
    }

    // context.steps
    for (const ctxStepEntry of step.context.steps ?? []) {
      const { stepName: ctxStep, isRef } = parseStepRef(ctxStepEntry);
      if (!stepNames.has(ctxStep)) {
        errors.push(`Step "${step.name}" references unknown step "${ctxStep}" in context.steps.`);
      } else if (isRef) {
        const referencedStep = flow.steps.find((s) => s.name === ctxStep);
        if (referencedStep?.generates === undefined) {
          errors.push(
            `Step "${step.name}" uses ":ref" for step "${ctxStep}" in context.steps, but that step has no "generates" field.`,
          );
        }
      }
    }

    // validates
    for (const validatedEntry of step.validates ?? []) {
      const { stepName: validated, isRef } = parseStepRef(validatedEntry);
      if (!stepNames.has(validated)) {
        errors.push(`Step "${step.name}" references unknown step "${validated}" in validates.`);
      } else if (isRef) {
        const referencedStep = flow.steps.find((s) => s.name === validated);
        if (referencedStep?.generates === undefined) {
          errors.push(
            `Step "${step.name}" uses ":ref" for step "${validated}" in validates, but that step has no "generates" field.`,
          );
        }
      }
    }

    // instruction file existence
    if (!instructionSet.has(step.context.instructions)) {
      errors.push(
        `Step "${step.name}" instruction file not found: "${step.context.instructions}".`,
      );
    }
  }

  // --- Cycle detection ---
  const visited = new Set<string>();
  for (const step of flow.steps) {
    if (!visited.has(step.name)) {
      const cycle = detectCycle(step.name, requiresMap, visited, new Set<string>(), []);
      if (cycle !== null) {
        errors.push(`Circular dependency detected in requires: ${cycle.join(" → ")}`);
        // Only report the first cycle found to avoid noise
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the whole project (root config validity + folder existence + all flows).
 */
export function validateProject(
  rootValid: boolean,
  flowsFolderExists: boolean,
  tasksFolderExists: boolean,
  flows: Array<{ flow: FlowConfig; instructionPaths: string[]; loadError?: string }>,
): ValidationResult {
  const errors: string[] = [];

  if (!rootValid) {
    errors.push("Root config (.agentflow.yaml) is missing or invalid.");
  }

  if (!flowsFolderExists) {
    errors.push("flows/ folder is missing.");
  }

  if (!tasksFolderExists) {
    errors.push("tasks/ folder is missing.");
  }

  for (const { flow, instructionPaths, loadError } of flows) {
    if (loadError !== undefined) {
      errors.push(`[flow: ${flow.name}] Failed to load: ${loadError}`);
      continue;
    }
    const result = validateFlow(flow, instructionPaths);
    if (!result.valid) {
      for (const err of result.errors) {
        errors.push(`[flow: ${flow.name}] ${err}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
