import type { StepConfig } from "../flow/schema.js";
import type { StepState } from "../task/schema.js";

/**
 * Pure graph functions for ChainFlow.
 * No filesystem access, no process.cwd(). Fully testable with in-memory data.
 */

// ---------------------------------------------------------------------------
// Graph builders
// ---------------------------------------------------------------------------

/**
 * Maps each step name → its `requires` list.
 */
export function buildDependencyGraph(steps: StepConfig[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const step of steps) {
    graph.set(step.name, step.requires ?? []);
  }
  return graph;
}

/**
 * Maps each step name → names of steps that depend on it (reverse edges).
 */
export function buildReverseDependencyGraph(steps: StepConfig[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const step of steps) {
    if (!graph.has(step.name)) {
      graph.set(step.name, []);
    }
    for (const req of step.requires ?? []) {
      const dependents = graph.get(req) ?? [];
      dependents.push(step.name);
      graph.set(req, dependents);
    }
  }
  return graph;
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * Returns step names in valid execution order (all dependencies before dependents).
 * Throws if the graph contains a cycle.
 */
export function topologicalSort(steps: StepConfig[]): string[] {
  const depGraph = buildDependencyGraph(steps);
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(name: string, stack: Set<string>): void {
    if (stack.has(name)) {
      throw new Error(`Cycle detected involving step "${name}"`);
    }
    if (visited.has(name)) return;
    stack.add(name);
    for (const dep of depGraph.get(name) ?? []) {
      visit(dep, stack);
    }
    stack.delete(name);
    visited.add(name);
    result.push(name);
  }

  for (const step of steps) {
    visit(step.name, new Set());
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/**
 * Returns a cycle path array if a cycle exists, null otherwise.
 * Uses DFS with visited + recursion-stack sets.
 */
export function detectCycle(steps: StepConfig[]): string[] | null {
  const depGraph = buildDependencyGraph(steps);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const stackPath: string[] = [];

  function dfs(name: string): string[] | null {
    visited.add(name);
    stack.add(name);
    stackPath.push(name);

    for (const dep of depGraph.get(name) ?? []) {
      if (!visited.has(dep)) {
        const result = dfs(dep);
        if (result !== null) return result;
      } else if (stack.has(dep)) {
        // Found a cycle — return the cycle path
        const cycleStart = stackPath.indexOf(dep);
        return [...stackPath.slice(cycleStart), dep];
      }
    }

    stack.delete(name);
    stackPath.pop();
    return null;
  }

  for (const step of steps) {
    if (!visited.has(step.name)) {
      const cycle = dfs(step.name);
      if (cycle !== null) return cycle;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step state queries
// ---------------------------------------------------------------------------

/**
 * Returns names of steps currently in `ready` state.
 */
export function resolveReadySteps(
  steps: StepConfig[],
  taskStepStates: Record<string, StepState>,
): string[] {
  return steps
    .filter((step) => taskStepStates[step.name]?.state === "ready")
    .map((step) => step.name);
}

/**
 * Returns names of steps that are actionable — either `ready` or `revision`.
 * These are the steps an agent should work on next.
 */
export function resolveActionableSteps(
  steps: StepConfig[],
  taskStepStates: Record<string, StepState>,
): string[] {
  return steps
    .filter((step) => {
      const state = taskStepStates[step.name]?.state;
      return state === "ready" || state === "revision";
    })
    .map((step) => step.name);
}

/**
 * Returns names of `blocked` steps that should become `ready` after
 * `completedStepName` is marked done (i.e. all their requires are now done).
 *
 * NOTE: The caller is responsible for having already updated the state of
 * `completedStepName` to `done` before calling this, OR this function treats
 * `completedStepName` as done for the purpose of its calculation.
 */
export function resolveUnblockedSteps(
  steps: StepConfig[],
  taskStepStates: Record<string, StepState>,
  completedStepName: string,
): string[] {
  const result: string[] = [];
  for (const step of steps) {
    if (taskStepStates[step.name]?.state !== "blocked") continue;
    const requires = step.requires ?? [];
    if (requires.length === 0) continue;
    const allDone = requires.every(
      (req) => req === completedStepName || taskStepStates[req]?.state === "done",
    );
    if (allDone) {
      result.push(step.name);
    }
  }
  return result;
}

/**
 * Returns names of all transitively dependent steps that should be reset to
 * `ready` after `revisedStepName` is marked for revision.
 * Does NOT include the revised step itself.
 */
export function resolveTransitiveCascade(
  steps: StepConfig[],
  _taskStepStates: Record<string, StepState>,
  revisedStepName: string,
): string[] {
  const reverseGraph = buildReverseDependencyGraph(steps);
  const cascade = new Set<string>();
  const queue: string[] = [revisedStepName];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const dependent of reverseGraph.get(current) ?? []) {
      if (!cascade.has(dependent)) {
        cascade.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return [...cascade];
}

/**
 * Returns true when all steps are in `done` state.
 */
export function isTaskComplete(taskStepStates: Record<string, StepState>): boolean {
  return Object.values(taskStepStates).every((s) => s.state === "done");
}
