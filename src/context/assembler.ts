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

  // 1. Step name and description
  parts.push(`Step: ${stepName}`);
  if (step.description !== undefined) {
    parts.push(`Description: ${step.description}`);
  }

  // 2. Revision block (if in revision state)
  if (stepState.state === "revision" && stepState.revisedBy !== undefined) {
    const revisedBy = stepState.revisedBy;
    parts.push("");
    parts.push(`This step is being revised. It was marked for revision by step "${revisedBy}".`);

    // Inline the step's own previously generated file
    if (step.generates !== undefined) {
      const prevFilePath = path.join(taskDir, step.generates);
      if (fs.existsSync(prevFilePath)) {
        const prevContent = fs.readFileSync(prevFilePath, "utf8");
        parts.push("");
        parts.push(`Previously generated output (${step.generates}):`);
        parts.push(prevContent);
      }
    }

    // Inline the revisedBy step's generated file (review feedback)
    const revisedByStep = flow.steps.find((s) => s.name === revisedBy);
    if (revisedByStep?.generates !== undefined) {
      const reviewFilePath = path.join(taskDir, revisedByStep.generates);
      if (fs.existsSync(reviewFilePath)) {
        const reviewContent = fs.readFileSync(reviewFilePath, "utf8");
        parts.push("");
        parts.push(`Review feedback (${revisedByStep.generates}):`);
        parts.push(reviewContent);
      }
    }

    parts.push("");
    parts.push("Rework this step based on the review feedback above.");
  }

  // 3. Instructions file
  const instrPath = path.join(
    projectRoot,
    DEFAULT_ROOT_FOLDER_NAME,
    FLOWS_FOLDER_NAME,
    flowName,
    INSTRUCTIONS_FOLDER_NAME,
    step.context.instructions,
  );
  if (fs.existsSync(instrPath)) {
    const instrContent = fs.readFileSync(instrPath, "utf8");
    parts.push("");
    parts.push(instrContent);
  }

  // 4. Reference files
  if (step.context.references !== undefined) {
    for (const refPath of step.context.references) {
      const absRefPath = path.join(projectRoot, refPath);
      if (fs.existsSync(absRefPath)) {
        const refContent = fs.readFileSync(absRefPath, "utf8");
        parts.push("");
        parts.push(`Reference (${refPath}):`);
        parts.push(refContent);
      }
    }
  }

  // 5. Upstream step outputs
  const validatesStepNames = new Set((step.validates ?? []).map((e) => parseStepRef(e).stepName));
  if (step.context.steps !== undefined) {
    for (const contextStepEntry of step.context.steps) {
      const { stepName: contextStepName, isRef } = parseStepRef(contextStepEntry);

      // Skip steps that will be injected in the validates section
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
          parts.push("");
          if (isRef) {
            const refPath = [DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName, contextStep.generates].join("/");
            parts.push(`Reference step "${contextStepName}" output at: ${refPath} — read this file before proceeding.`);
          } else {
            const genContent = fs.readFileSync(genFilePath, "utf8");
            parts.push(`Output from step "${contextStepName}" (${contextStep.generates}):`);
            parts.push(genContent);
          }
        }
      } else if (contextStep.required === false) {
        // Optional step not done
        parts.push("");
        parts.push(
          `Note: Optional step "${contextStepName}" was not completed — skipping context injection.`,
        );
      } else {
        // Required step not done — this shouldn't normally happen (step would be blocked)
        // But if it does, skip silently
      }
    }
  }

  const hasValidates = step.validates !== undefined && step.validates.length > 0;

  // 6. Validated step files (for validates steps)
  if (hasValidates && step.validates !== undefined) {
    parts.push("");
    parts.push("--- Steps to evaluate ---");
    for (const validatedStepEntry of step.validates) {
      const { stepName: validatedStepName, isRef } = parseStepRef(validatedStepEntry);
      const validatedStep = flow.steps.find((s) => s.name === validatedStepName);
      if (validatedStep?.generates === undefined) continue;
      const genFilePath = path.join(taskDir, validatedStep.generates);
      if (fs.existsSync(genFilePath)) {
        parts.push("");
        if (isRef) {
          const refPath = [DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName, validatedStep.generates].join("/");
          parts.push(`Evaluate step "${validatedStepName}": read the output at ${refPath} before making your pass/fail decision.`);
        } else {
          const genContent = fs.readFileSync(genFilePath, "utf8");
          parts.push(`Step "${validatedStepName}" output (${validatedStep.generates}):`);
          parts.push(genContent);
        }
      }
    }
  }

  // 7. Generates instruction
  if (step.generates !== undefined) {
    const genPath = path.join(taskDir, step.generates);
    const fileExists = fs.existsSync(genPath);
    const strategy = step.generateStrategy ?? "replace";

    parts.push("");
    parts.push(
      `This step must generate the file: ${[DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName, step.generates].join("/")}`,
    );

    if (strategy === "replace") {
      if (fileExists) {
        parts.push("Strategy: An existing version exists. Replace it entirely.");
      } else {
        parts.push("Strategy: Create this file.");
      }
    } else if (strategy === "update") {
      if (fileExists) {
        parts.push("Strategy: An existing version exists. Update it in place.");
      } else {
        parts.push("Strategy: Create this file.");
      }
    } else if (strategy === "version") {
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
        parts.push(
          `Strategy: An existing version exists. Rename it to ${versionedName} before writing the new version.`,
        );
      } else {
        parts.push("Strategy: Create this file.");
      }
    }
  }

  // 8. Completion instruction
  if (hasValidates && step.validates !== undefined) {
    // Evaluation instruction (folds in the complete command)
    parts.push("");
    parts.push("Evaluate each of the above steps and decide pass or fail.");
    parts.push(`First run: \`agentflow complete --step ${stepName} --task ${taskName}\``);
    parts.push(
      `Then, for each step that fails, run: \`agentflow revise --step <name> --from ${stepName} --task ${taskName}\``,
    );
  } else {
    // Normal completion instruction
    parts.push("");
    parts.push(
      `When this step is complete, run: \`agentflow complete --step ${stepName} --task ${taskName}\``,
    );
  }

  return parts.join("\n");
}
