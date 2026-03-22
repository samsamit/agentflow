import * as path from "path";
import * as output from "../output.js";
import {
  listFlowNames,
  listInstructionFiles,
  loadFlow,
  loadRootConfig,
  validateFlow,
  validateProject,
} from "../flow/index.js";
import {
  DEFAULT_ROOT_FOLDER_NAME,
  FLOWS_FOLDER_NAME,
  TASKS_FOLDER_NAME,
} from "../constants.js";
import { fileExists } from "../utils/fileIo.js";

export async function validateCommand(options: { flow?: string }): Promise<void> {
  const projectRoot = process.cwd();

  try {
    if (options.flow !== undefined) {
      // Validate a single flow
      const flowName = options.flow;
      const flow = loadFlow(projectRoot, flowName);
      const instructionPaths = listInstructionFiles(projectRoot, flowName);
      const result = validateFlow(flow, instructionPaths);

      if (result.valid) {
        output.validationPassed(`flow: ${flowName}`);
      } else {
        output.validationFailed(`flow: ${flowName}`, result.errors);
        process.exit(1);
      }
    } else {
      // Validate entire project
      let rootValid = true;
      try {
        loadRootConfig(projectRoot);
      } catch {
        rootValid = false;
      }

      const flowsFolderExists = fileExists(
        path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME),
      );
      const tasksFolderExists = fileExists(
        path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME),
      );

      const flowNames = listFlowNames(projectRoot);
      const flows: Array<{
        flow: ReturnType<typeof loadFlow>;
        instructionPaths: string[];
        loadError?: string;
      }> = [];

      for (const flowName of flowNames) {
        try {
          const flow = loadFlow(projectRoot, flowName);
          const instructionPaths = listInstructionFiles(projectRoot, flowName);
          flows.push({ flow, instructionPaths });
        } catch (err) {
          flows.push({
            flow: { name: flowName, steps: [] },
            instructionPaths: [],
            loadError: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const result = validateProject(rootValid, flowsFolderExists, tasksFolderExists, flows);

      if (result.valid) {
        output.validationPassed("project");
      } else {
        output.validationFailed("project", result.errors);
        process.exit(1);
      }
    }
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
