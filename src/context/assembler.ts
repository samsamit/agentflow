import * as fs from "node:fs";
import * as path from "node:path";
import {
  DEFAULT_ROOT_FOLDER_NAME,
  FLOWS_FOLDER_NAME,
  INSTRUCTIONS_FOLDER_NAME,
  TASKS_FOLDER_NAME,
} from "../constants.js";
import type { FlowConfig } from "../flow/schema.js";
import { parseStepRef } from "../flow/schema.js";
import type { StepState } from "../task/schema.js";

export type ContextFileEntry = {
  label: string;
  lines: number;
  tokens: number;
};

export type AssembleContextParams = {
  stepName: string;
  taskName: string;
  flowName: string;
  projectRoot: string;
  flow: FlowConfig;
  stepState: StepState;
  taskStepStates: Record<string, StepState>;
};

/**
 * Assembles the full context string for a step.
 * This is what gets injected directly into an AI agent prompt.
 */
export function assembleContext(params: AssembleContextParams): string {
  const { stepName, taskName, flowName, projectRoot, flow, stepState, taskStepStates } = params;

  const step = flow.steps.find((s) => s.name === stepName);
  if (step === undefined) {
    throw new Error(`Step "${stepName}" not found in flow "${flowName}".`);
  }

  const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);
  const parts: string[] = [];

  // 1. Opening context tag
  const descAttr = step.description !== undefined ? ` description="${step.description}"` : "";
  parts.push(`<context step="${stepName}" task="${taskName}"${descAttr}>`);

  // 2. Revision block
  if (stepState.state === "revision" && stepState.revisedBy !== undefined) {
    const revisedBy = stepState.revisedBy;
    const lines: string[] = [`<revision revised-by="${revisedBy}">`, "This step is being revised."];

    if (step.generates !== undefined) {
      const prevFilePath = path.join(taskDir, step.generates);
      if (fs.existsSync(prevFilePath)) {
        const content = fs.readFileSync(prevFilePath, "utf8");
        const fp = [DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName, step.generates].join(
          "/",
        );
        lines.push("", `<previous-output file="${fp}">`, content.trimEnd(), "</previous-output>");
      }
    }

    const revisedByStep = flow.steps.find((s) => s.name === revisedBy);
    if (revisedByStep?.generates !== undefined) {
      const reviewFilePath = path.join(taskDir, revisedByStep.generates);
      if (fs.existsSync(reviewFilePath)) {
        const content = fs.readFileSync(reviewFilePath, "utf8");
        const fp = [
          DEFAULT_ROOT_FOLDER_NAME,
          TASKS_FOLDER_NAME,
          taskName,
          revisedByStep.generates,
        ].join("/");
        lines.push(
          "",
          `<review-feedback step="${revisedBy}" file="${fp}">`,
          content.trimEnd(),
          "</review-feedback>",
        );
      }
    }

    lines.push("", "Rework this step based on the review feedback above.", "</revision>");
    parts.push(lines.join("\n"));
  }

  // 3. Instructions
  const instrPath = path.join(
    projectRoot,
    DEFAULT_ROOT_FOLDER_NAME,
    FLOWS_FOLDER_NAME,
    flowName,
    INSTRUCTIONS_FOLDER_NAME,
    step.context.instructions,
  );
  if (fs.existsSync(instrPath)) {
    const content = fs.readFileSync(instrPath, "utf8");
    parts.push(`<instructions>\n${content.trimEnd()}\n</instructions>`);
  }

  // 4. Reference files
  if (step.context.references !== undefined) {
    for (const refPath of step.context.references) {
      const absRefPath = path.join(projectRoot, refPath);
      if (fs.existsSync(absRefPath)) {
        const content = fs.readFileSync(absRefPath, "utf8");
        parts.push(`<reference path="${refPath}">\n${content.trimEnd()}\n</reference>`);
      }
    }
  }

  // 5. Upstream step outputs
  const validatesStepNames = new Set((step.validates ?? []).map((e) => parseStepRef(e).stepName));
  if (step.context.steps !== undefined) {
    for (const contextStepEntry of step.context.steps) {
      const { stepName: contextStepName, isRef } = parseStepRef(contextStepEntry);
      if (validatesStepNames.has(contextStepName)) continue;

      const contextStep = flow.steps.find((s) => s.name === contextStepName);
      const contextStepState = taskStepStates[contextStepName];
      if (contextStepState === undefined || contextStep === undefined) continue;

      if (contextStepState.state === "done") {
        if (contextStep.generates !== undefined) {
          const genFilePath = path.join(taskDir, contextStep.generates);
          if (!fs.existsSync(genFilePath)) {
            throw new Error(
              `Generated file for step "${contextStepName}" not found: ${genFilePath}`,
            );
          }
          const filePath = [
            DEFAULT_ROOT_FOLDER_NAME,
            TASKS_FOLDER_NAME,
            taskName,
            contextStep.generates,
          ].join("/");
          if (isRef) {
            parts.push(
              `<step-ref step="${contextStepName}" path="${filePath}">\nThis output is large. Read the file at the path above before proceeding.\n</step-ref>`,
            );
          } else {
            const content = fs.readFileSync(genFilePath, "utf8");
            parts.push(
              `<step-output step="${contextStepName}" file="${filePath}">\n${content.trimEnd()}\n</step-output>`,
            );
          }
        }
      } else if (contextStep.required === false) {
        parts.push(
          `<skipped-step step="${contextStepName}">\nOptional step was not completed — skipping context injection.\n</skipped-step>`,
        );
      }
    }
  }

  const hasValidates = step.validates !== undefined && step.validates.length > 0;

  // 6. Validated step files
  if (hasValidates && step.validates !== undefined) {
    for (const validatedStepEntry of step.validates) {
      const { stepName: validatedStepName, isRef } = parseStepRef(validatedStepEntry);
      const validatedStep = flow.steps.find((s) => s.name === validatedStepName);
      if (validatedStep?.generates === undefined) continue;
      const genFilePath = path.join(taskDir, validatedStep.generates);
      const filePath = [
        DEFAULT_ROOT_FOLDER_NAME,
        TASKS_FOLDER_NAME,
        taskName,
        validatedStep.generates,
      ].join("/");
      if (fs.existsSync(genFilePath)) {
        if (isRef) {
          parts.push(
            `<evaluate-ref step="${validatedStepName}" path="${filePath}">\nThis output is large. Read the file at the path above before making your pass/fail decision.\n</evaluate-ref>`,
          );
        } else {
          const content = fs.readFileSync(genFilePath, "utf8");
          parts.push(
            `<evaluate step="${validatedStepName}" file="${filePath}">\n${content.trimEnd()}\n</evaluate>`,
          );
        }
      }
    }
  }

  // 7. Generates instruction
  if (step.generates !== undefined) {
    const genPath = path.join(taskDir, step.generates);
    const fileExists = fs.existsSync(genPath);
    const strategy = step.generateStrategy ?? "replace";
    const filePath = [DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName, step.generates].join(
      "/",
    );

    let strategyInstruction: string;
    if (strategy === "replace") {
      strategyInstruction = fileExists
        ? "An existing version exists. Replace it entirely."
        : "Create this file.";
    } else if (strategy === "update") {
      strategyInstruction = fileExists
        ? "An existing version exists. Update it in place."
        : "Create this file.";
    } else {
      if (fileExists) {
        const revCount = stepState.revisionCount ?? 0;
        const dotIndex = step.generates.lastIndexOf(".");
        let versionedName: string;
        if (dotIndex === -1) {
          versionedName = `${step.generates}.v${revCount}`;
        } else {
          const base = step.generates.slice(0, dotIndex);
          const ext = step.generates.slice(dotIndex);
          versionedName = `${base}.v${revCount}${ext}`;
        }
        strategyInstruction = `An existing version exists. Rename it to ${versionedName} before writing the new version.`;
      } else {
        strategyInstruction = "Create this file.";
      }
    }

    parts.push(
      `<generates file="${filePath}" strategy="${strategy}">\n${strategyInstruction}\n</generates>`,
    );
  }

  // 8. Completion instruction
  if (hasValidates && step.validates !== undefined) {
    const cmdLines = [
      "Evaluate each of the above steps and decide pass or fail.",
      `First run: \`agentflow complete --step ${stepName} --task ${taskName}\``,
      `Then, for each step that fails, run: \`agentflow revise --step <name> --from ${stepName} --task ${taskName}\``,
    ];
    parts.push(`<next-command>\n${cmdLines.join("\n")}\n</next-command>`);
  } else {
    parts.push(
      `<next-command>agentflow complete --step ${stepName} --task ${taskName}</next-command>`,
    );
  }

  // 9. Closing tag
  parts.push("</context>");

  return parts.join("\n\n");
}

function fileEntry(filePath: string, label: string): ContextFileEntry {
  const content = fs.readFileSync(filePath, "utf8");
  return {
    label,
    lines: content.split("\n").length,
    tokens: Math.ceil(content.length / 4),
  };
}

/**
 * Returns a list of files that would be assembled into the context, with line and token counts.
 * Used by `agentflow context --debug` to inspect context footprint without printing the full content.
 */
export function assembleContextDebug(params: AssembleContextParams): ContextFileEntry[] {
  const { stepName, taskName, flowName, projectRoot, flow, stepState, taskStepStates } = params;

  const step = flow.steps.find((s) => s.name === stepName);
  if (step === undefined) {
    throw new Error(`Step "${stepName}" not found in flow "${flowName}".`);
  }

  const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);
  const entries: ContextFileEntry[] = [];

  // Revision files
  if (stepState.state === "revision" && stepState.revisedBy !== undefined) {
    const revisedBy = stepState.revisedBy;

    if (step.generates !== undefined) {
      const prevFilePath = path.join(taskDir, step.generates);
      if (fs.existsSync(prevFilePath)) {
        entries.push(
          fileEntry(
            prevFilePath,
            `${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/${taskName}/${step.generates}`,
          ),
        );
      }
    }

    const revisedByStep = flow.steps.find((s) => s.name === revisedBy);
    if (revisedByStep?.generates !== undefined) {
      const reviewFilePath = path.join(taskDir, revisedByStep.generates);
      if (fs.existsSync(reviewFilePath)) {
        entries.push(
          fileEntry(
            reviewFilePath,
            `${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/${taskName}/${revisedByStep.generates}`,
          ),
        );
      }
    }
  }

  // Instructions file
  const instrPath = path.join(
    projectRoot,
    DEFAULT_ROOT_FOLDER_NAME,
    FLOWS_FOLDER_NAME,
    flowName,
    INSTRUCTIONS_FOLDER_NAME,
    step.context.instructions,
  );
  if (fs.existsSync(instrPath)) {
    entries.push(
      fileEntry(
        instrPath,
        `${DEFAULT_ROOT_FOLDER_NAME}/${FLOWS_FOLDER_NAME}/${flowName}/${INSTRUCTIONS_FOLDER_NAME}/${step.context.instructions}`,
      ),
    );
  }

  // Reference files
  if (step.context.references !== undefined) {
    for (const refPath of step.context.references) {
      const absRefPath = path.join(projectRoot, refPath);
      if (fs.existsSync(absRefPath)) {
        entries.push(fileEntry(absRefPath, refPath));
      }
    }
  }

  // Upstream step outputs (inlined only — skip :ref entries and validates-bound steps)
  const validatesStepNames = new Set((step.validates ?? []).map((e) => parseStepRef(e).stepName));
  if (step.context.steps !== undefined) {
    for (const contextStepEntry of step.context.steps) {
      const { stepName: contextStepName, isRef } = parseStepRef(contextStepEntry);
      if (validatesStepNames.has(contextStepName)) continue;
      if (isRef) continue;

      const contextStep = flow.steps.find((s) => s.name === contextStepName);
      const contextStepState = taskStepStates[contextStepName];
      if (contextStepState === undefined || contextStep === undefined) continue;

      if (contextStepState.state === "done" && contextStep.generates !== undefined) {
        const genFilePath = path.join(taskDir, contextStep.generates);
        if (fs.existsSync(genFilePath)) {
          entries.push(
            fileEntry(
              genFilePath,
              `${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/${taskName}/${contextStep.generates}`,
            ),
          );
        }
      }
    }
  }

  // Validated step files (inlined only — skip :ref entries)
  if (step.validates !== undefined) {
    for (const validatedStepEntry of step.validates) {
      const { stepName: validatedStepName, isRef } = parseStepRef(validatedStepEntry);
      if (isRef) continue;
      const validatedStep = flow.steps.find((s) => s.name === validatedStepName);
      if (validatedStep?.generates === undefined) continue;
      const genFilePath = path.join(taskDir, validatedStep.generates);
      if (fs.existsSync(genFilePath)) {
        entries.push(
          fileEntry(
            genFilePath,
            `${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/${taskName}/${validatedStep.generates}`,
          ),
        );
      }
    }
  }

  return entries;
}
