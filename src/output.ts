/**
 * All stdout/stderr output for agentflow CLI.
 * Every output function in this module writes directly to process.stdout or process.stderr.
 * No console.log or console.error is used anywhere else in the codebase.
 */

function write(text: string): void {
  process.stdout.write(`${text}\n`);
}

function writeErr(text: string): void {
  process.stderr.write(`${text}\n`);
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  // foreground
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  // bright
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
} as const;

function styled(text: string, ...codes: string[]): string {
  return `${codes.join("")}${text}${c.reset}`;
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export function banner(): void {
  const logo = [
    "                          __    ____              ",
    "  ____ _____ ____  ____  / /_  / __/ ____ _      __",
    " / __ `/ __ `/ _ \\/ __ \\/ __/ / /_  / __ \\ | /| / /",
    "/ /_/ / /_/ /  __/ / / / /_ / __/ / /_/ / |/ |/ / ",
    "\\__,_/\\__, /\\___/_/ /_/\\__//_/    \\____/|__/|__/  ",
    "     /____/                                        ",
  ];

  write("");
  for (const line of logo) {
    write(styled(line, c.bold, c.brightCyan));
  }
  write(styled("  agent-first workflow engine", c.dim, c.cyan));
  write("");
}

// ---------------------------------------------------------------------------
// Init-specific output
// ---------------------------------------------------------------------------

export function initSection(title: string): void {
  write("");
  write(styled(`  ${title}`, c.bold, c.brightWhite));
  write(styled(`  ${"─".repeat(44)}`, c.gray));
}

export function initCreated(label: string): void {
  write(`  ${styled("✓", c.green, c.bold)}  ${styled(label, c.white)}`);
}

export function initSkipped(label: string): void {
  write(`  ${styled("–", c.gray)}  ${styled(label, c.dim, c.gray)}`);
}

export function initWarning(label: string): void {
  write(`  ${styled("⚠", c.yellow, c.bold)}  ${styled(label, c.yellow)}`);
}

export function initSuccess(): void {
  write("");
  write(styled("  ────────────────────────────────────────────────", c.gray));
  write(
    `  ${styled("✦", c.brightCyan, c.bold)}  ${styled("agentflow initialized successfully", c.bold, c.brightWhite)}`,
  );
  write(`     ${styled("Next:", c.dim, c.gray)} ${styled("agentflow validate", c.cyan)}`);
  write(
    `     ${styled("Docs:", c.dim, c.gray)} ${styled("https://github.com/samsamit/agentflow#readme", c.dim, c.cyan)}`,
  );
  write("");
}

// ---------------------------------------------------------------------------
// General info
// ---------------------------------------------------------------------------

export function info(message: string): void {
  write(message);
}

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------

export function taskStarted(taskName: string, flowName: string, activeSteps: string[]): void {
  write(`Task started: ${taskName}`);
  write(`Flow: ${flowName}`);
  write(`Active steps: ${activeSteps.join(", ")}`);
  write("Run: agentflow next");
}

export function taskComplete(taskName: string): void {
  write(`Task complete: ${taskName}`);
  write("All steps are done.");
}

// ---------------------------------------------------------------------------
// Next step
// ---------------------------------------------------------------------------

/** subagent: undefined = no subagent, true = generic, string = named */
export function nextStep(
  stepName: string,
  status: "ready" | "revision",
  subagent?: string | true,
  taskName?: string,
): void {
  write(`Step: ${stepName}`);
  write(`Status: ${status}`);
  if (subagent === undefined) {
    write(`Run: agentflow context --step ${stepName}`);
  } else if (subagent === true) {
    write("Subagent: spawn a subagent");
    write(`Then run: agentflow context --step ${stepName} --task ${taskName}`);
  } else {
    write(`Subagent: spawn subagent "${subagent}"`);
    write(`Then run: agentflow context --step ${stepName} --task ${taskName}`);
  }
}

export type ParallelStep = {
  name: string;
  subagent?: string | true;
};

export function nextParallel(steps: ParallelStep[], taskName?: string): void {
  const hasSubagents = steps.some((s) => s.subagent !== undefined);

  if (!hasSubagents) {
    write("Steps ready for parallel execution:");
    for (const step of steps) {
      write(`- ${step.name}: run agentflow context --step ${step.name}`);
    }
  } else {
    write("Steps ready for parallel execution. Spawn a subagent for each step below:");
    for (const step of steps) {
      if (typeof step.subagent === "string") {
        write(
          `- ${step.name}: spawn subagent "${step.subagent}", then run agentflow context --step ${step.name} --task ${taskName}`,
        );
      } else if (step.subagent === true) {
        write(
          `- ${step.name}: spawn a subagent, then run agentflow context --step ${step.name} --task ${taskName}`,
        );
      } else {
        write(`- ${step.name}: run agentflow context --step ${step.name}`);
      }
    }
    write("Run all subagents in parallel before proceeding.");
  }
}

// ---------------------------------------------------------------------------
// Step operations
// ---------------------------------------------------------------------------

export function stepContext(content: string): void {
  write(content);
}

export type ContextDebugEntry = {
  label: string;
  lines: number;
  tokens: number;
};

export function stepContextDebug(
  stepName: string,
  taskName: string,
  entries: ContextDebugEntry[],
): void {
  const FILE_COL = 40;
  const NUM_COL = 8;
  const sep = "─".repeat(FILE_COL + NUM_COL + NUM_COL);

  function formatNum(n: number): string {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  write(styled(`Context debug — ${stepName} (${taskName})`, c.bold, c.brightWhite));
  write("");
  write(
    styled("File".padEnd(FILE_COL), c.dim) +
      styled("Lines".padStart(NUM_COL), c.dim) +
      styled("Tokens".padStart(NUM_COL), c.dim),
  );
  write(styled(sep, c.gray));

  for (const entry of entries) {
    const label =
      entry.label.length > FILE_COL ? `…${entry.label.slice(-(FILE_COL - 1))}` : entry.label;
    write(
      label.padEnd(FILE_COL) +
        String(entry.lines).padStart(NUM_COL) +
        formatNum(entry.tokens).padStart(NUM_COL),
    );
  }

  const totalLines = entries.reduce((sum, e) => sum + e.lines, 0);
  const totalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);

  write(styled(sep, c.gray));
  write(
    styled("TOTAL".padEnd(FILE_COL), c.bold) +
      styled(String(totalLines).padStart(NUM_COL), c.bold) +
      styled(formatNum(totalTokens).padStart(NUM_COL), c.bold),
  );
}

export function flowPaused(stepName: string, taskName: string, generatedFile?: string): void {
  write(`Flow paused after step "${stepName}".`);
  if (generatedFile !== undefined) {
    write(`Review the output at:`);
    write(`  agentFlow/tasks/${taskName}/${generatedFile}`);
  }
  write(`Once the user has reviewed and approved, run:`);
  write(`  agentflow next --resume`);
}

export function stepComplete(stepName: string, unblocked: string[]): void {
  write(`Step complete: ${stepName}`);
  if (unblocked.length > 0) {
    write(`Unblocked: ${unblocked.join(", ")}`);
  }
  write("Run: agentflow next");
}

export function stepRevised(
  stepName: string,
  revisionCount: number,
  maxRevisions: number,
  cascadedReady: string[],
  cascadedBlocked: string[],
): void {
  write(`Step marked for revision: ${stepName} (revision ${revisionCount}/${maxRevisions})`);
  if (cascadedReady.length > 0) {
    write(`Cascaded to ready: ${cascadedReady.join(", ")}`);
  }
  if (cascadedBlocked.length > 0) {
    write(`Cascaded to blocked: ${cascadedBlocked.join(", ")}`);
  }
  write("Run: agentflow next");
}

export function revisionIgnored(stepName: string, maxRevisions: number): void {
  write(
    `Warning: Step "${stepName}" has reached the maximum number of revisions (${maxRevisions}/${maxRevisions}). Revision ignored.`,
  );
  write("Run: agentflow next");
}

// ---------------------------------------------------------------------------
// State / list
// ---------------------------------------------------------------------------

export type StepStateEntry = {
  name: string;
  state: "ready" | "done" | "blocked" | "revision";
  generates?: string;
  generatePath?: string;
  fileExists?: boolean;
  requires?: string[];
};

export type TaskStateArgs = {
  taskName: string;
  flowName: string;
  active: boolean;
  steps: StepStateEntry[];
};

export function taskState(args: TaskStateArgs): void {
  write(`Task: ${args.taskName}`);
  write(`Flow: ${args.flowName}`);
  write(`Active: ${args.active}`);
  write("");
  write("Steps:");
  for (const step of args.steps) {
    const namePad = step.name.padEnd(16);
    const statePad = step.state.padEnd(12);
    let detail = "";
    if (step.generates && step.generatePath) {
      const exists = step.fileExists ? "[exists]" : "[missing]";
      detail = `generates: ${step.generates} → ${step.generatePath} ${exists}`;
    } else if (step.requires && step.requires.length > 0) {
      detail = `requires: ${step.requires.join(", ")}`;
    }
    write(`${namePad}${statePad}${detail}`.trimEnd());
  }
}

export type FlowEntry = {
  name: string;
  description: string;
};

export function flowList(flows: FlowEntry[]): void {
  write("Flows:");
  for (const flow of flows) {
    const namePad = flow.name.padEnd(12);
    write(`${namePad}${flow.description}`);
  }
}

export type TaskEntry = {
  name: string;
  active: boolean;
  flowName: string;
  doneSteps: number;
  totalSteps: number;
};

export function taskList(tasks: TaskEntry[]): void {
  write("Tasks:");
  for (const task of tasks) {
    const namePad = task.name.padEnd(14);
    const activePart = task.active ? "(active)    " : "            ";
    write(
      `${namePad}${activePart}flow: ${task.flowName}    steps: ${task.doneSteps}/${task.totalSteps} done`,
    );
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validationPassed(target: string): void {
  write(`Validation passed: ${target}`);
}

export function validationFailed(target: string, errors: string[]): void {
  writeErr(`Validation failed: ${target}`);
  for (const err of errors) {
    writeErr(`  - ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export function error(err: unknown): void {
  if (err instanceof Error) {
    writeErr(`Error: ${err.message}`);
  } else {
    writeErr(`Error: ${String(err)}`);
  }
}

export function errorWithFix(message: string, fix: string): void {
  writeErr(`Error: ${message}`);
  writeErr(`Run: ${fix}`);
}
