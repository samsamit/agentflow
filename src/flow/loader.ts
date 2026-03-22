import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import {
  CONFIG_FILE_NAME,
  DEFAULT_ROOT_FOLDER_NAME,
  FLOWS_FOLDER_NAME,
  INSTRUCTIONS_FOLDER_NAME,
} from "../constants.js";
import { fileExists, listDirs, readFile } from "../utils/fileIo.js";
import type { FlowConfig, RootConfig } from "./schema.js";
import { flowConfigSchema, rootConfigSchema } from "./schema.js";

/**
 * Reads and parses the root config at agentFlow/.agentflow.yaml.
 * Throws with a clear message if the file is missing or invalid.
 */
export function loadRootConfig(projectRoot: string): RootConfig {
  const configPath = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, CONFIG_FILE_NAME);

  if (!fileExists(configPath)) {
    throw new Error(`Root config not found: ${configPath}\nRun: agentflow init`);
  }

  const raw = readFile(configPath);
  const parsed: unknown = parse(raw);
  const result = rootConfigSchema.safeParse(parsed);

  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Root config is invalid: ${messages}`);
  }

  return result.data;
}

/**
 * Reads and parses a flow config at agentFlow/flows/<name>/.agentflow.yaml.
 * Throws with a clear message if the file is missing or the config is invalid.
 */
export function loadFlow(projectRoot: string, flowName: string): FlowConfig {
  const flowPath = path.join(
    projectRoot,
    DEFAULT_ROOT_FOLDER_NAME,
    FLOWS_FOLDER_NAME,
    flowName,
    CONFIG_FILE_NAME,
  );

  if (!fileExists(flowPath)) {
    throw new Error(`Flow "${flowName}" not found: ${flowPath}`);
  }

  const raw = readFile(flowPath);
  const parsed: unknown = parse(raw);
  const result = flowConfigSchema.safeParse(parsed);

  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Flow "${flowName}" config is invalid: ${messages}`);
  }

  return result.data;
}

/**
 * Returns the flow name to use: the provided option if given, otherwise
 * reads the root config and returns defaultFlow.
 */
export function resolveFlowName(projectRoot: string, flowOption?: string): string {
  if (flowOption !== undefined && flowOption.trim() !== "") {
    return flowOption;
  }
  const root = loadRootConfig(projectRoot);
  return root.defaultFlow;
}

/**
 * Lists instruction file names (basename only) for a given flow.
 * Returns an empty array if the instructions directory does not exist.
 */
export function listInstructionFiles(projectRoot: string, flowName: string): string[] {
  const instructionsDir = path.join(
    projectRoot,
    DEFAULT_ROOT_FOLDER_NAME,
    FLOWS_FOLDER_NAME,
    flowName,
    INSTRUCTIONS_FOLDER_NAME,
  );

  if (!fileExists(instructionsDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(instructionsDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Lists all flow names found in agentFlow/flows/.
 */
export function listFlowNames(projectRoot: string): string[] {
  const flowsDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME);
  if (!fileExists(flowsDir)) return [];
  return listDirs(flowsDir);
}
