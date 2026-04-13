import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { checkbox, confirm, select } from "@inquirer/prompts";
import {
  AGENTS_FOLDER_NAME,
  AI_TOOL_ROOTS,
  CONFIG_FILE_NAME,
  DEFAULT_ROOT_FOLDER_NAME,
  FLOWS_FOLDER_NAME,
  OPTIMIZE_SKILL_NAME,
  SCHEMA_CDN_URL,
  SKILL_FILE_NAME,
  SKILL_NAME,
  SKILLS_FOLDER_NAME,
  TASKS_FOLDER_NAME,
} from "../constants.js";
import { writeClaudeCodePermissions } from "../ide/claude-code.js";
import { writeJetBrainsSchema } from "../ide/jetbrains.js";
import { writeVsCodeSettings } from "../ide/vscode.js";
import { writeZedSettings } from "../ide/zed.js";
import * as output from "../output.js";
import configTemplate from "../templates/config.yaml";
import type { ConfirmFn, WriteResult } from "../types.js";
import {
  copyFile,
  createFolder,
  fileExists,
  listDirs,
  listFilesRecursive,
  readFile,
  writeFile,
} from "../utils/fileIo.js";

/** Resolves the absolute path to the bundled flows directory (flows/ at package root). */
function getBundledFlowsDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  // In built output: dist/index.mjs → project root is one level up
  // In dev/test: src/commands/init.ts → project root is two levels up
  // We detect by checking whether the resolved path contains a `flows/` dir
  const candidates = [
    path.resolve(path.dirname(__filename), "..", "flows"),
    path.resolve(path.dirname(__filename), "..", "..", "flows"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  output.info("  Warning: Bundled flows directory not found — skipping flow copy.");
  return "";
}

/** Resolves the absolute path to a bundled skill file (skills/<skillName>/SKILL.md at package root). */
function getBundledSkillFile(skillName: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const candidates = [
    path.resolve(path.dirname(__filename), "..", SKILLS_FOLDER_NAME, skillName, SKILL_FILE_NAME),
    path.resolve(
      path.dirname(__filename),
      "..",
      "..",
      SKILLS_FOLDER_NAME,
      skillName,
      SKILL_FILE_NAME,
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[candidates.length - 1] ?? "";
}

function outputForResult(result: WriteResult, label: string): void {
  if (result === "written") output.initCreated(label);
  else if (result === "skipped") output.initSkipped(label);
  else output.initDeclined(label);
}

async function copyFileWithConfirm(
  srcPath: string,
  destPath: string,
  label: string,
  confirmFn: ConfirmFn,
): Promise<void> {
  if (fileExists(destPath)) {
    const srcContent = readFile(srcPath);
    const destContent = readFile(destPath);
    if (srcContent === destContent) {
      output.initSkipped(label);
      return;
    }
    const ok = await confirmFn(`Overwrite ${label}?`);
    if (!ok) {
      output.initDeclined(label);
      return;
    }
  }
  copyFile(srcPath, destPath);
  output.initCreated(label);
}

async function copySkill(
  skillName: string,
  currentDir: string,
  toolRoot: string,
  confirmFn: ConfirmFn,
): Promise<void> {
  const bundledSkillFile = getBundledSkillFile(skillName);
  if (fileExists(bundledSkillFile)) {
    const skillDestDir = path.join(currentDir, toolRoot, SKILLS_FOLDER_NAME, skillName);
    const skillDestPath = path.join(skillDestDir, SKILL_FILE_NAME);
    createFolder(skillDestDir);
    const label = path.relative(currentDir, skillDestPath);
    await copyFileWithConfirm(bundledSkillFile, skillDestPath, label, confirmFn);
  } else {
    output.initWarning(`Bundled skill file for "${skillName}" not found — skipping`);
  }
}

export async function init(options: { default?: boolean } = {}) {
  try {
    const currentDir = process.cwd();
    const mainFolderPath = path.join(currentDir, DEFAULT_ROOT_FOLDER_NAME);
    const configFilePath = path.join(mainFolderPath, CONFIG_FILE_NAME);

    const autoApprove = options.default === true;
    const confirmFn: ConfirmFn = autoApprove
      ? async () => true
      : async (message) => confirm({ message });

    output.banner();

    // --- Directory structure ---
    output.initSection("Setting up project structure");
    createFolder(mainFolderPath);
    output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/`);

    writeFile(configFilePath, configTemplate);
    output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${CONFIG_FILE_NAME}`);

    createFolder(path.join(mainFolderPath, TASKS_FOLDER_NAME));
    output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/`);

    createFolder(path.join(mainFolderPath, FLOWS_FOLDER_NAME));
    output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${FLOWS_FOLDER_NAME}/`);

    // --- Copy bundled flows ---
    let selectedFlows: string[] = [];
    const bundledFlowsDir = getBundledFlowsDir();
    if (!options.default && bundledFlowsDir !== "" && fileExists(bundledFlowsDir)) {
      const bundledFlowNames = listDirs(bundledFlowsDir);
      if (bundledFlowNames.length > 0) {
        output.initSection("Bundled flows");
        output.initDescription("Select which workflow templates to copy into your project.");
        selectedFlows = await checkbox<string>({
          message: "Select flows to copy into your project:",
          choices: bundledFlowNames.map((name) => ({ name, value: name, checked: true })),
        });

        if (selectedFlows.length > 0) {
          for (const flowName of selectedFlows) {
            const srcFlowDir = path.join(bundledFlowsDir, flowName);
            const destFlowDir = path.join(mainFolderPath, FLOWS_FOLDER_NAME, flowName);
            const relFiles = listFilesRecursive(srcFlowDir, [AGENTS_FOLDER_NAME]);
            for (const relPath of relFiles) {
              const srcFile = path.join(srcFlowDir, relPath);
              const destFile = path.join(destFlowDir, relPath);
              const label = path.join(
                DEFAULT_ROOT_FOLDER_NAME,
                FLOWS_FOLDER_NAME,
                flowName,
                relPath,
              );
              await copyFileWithConfirm(srcFile, destFile, label, confirmFn);
            }
          }
        } else {
          output.initSkipped("No flows selected");
        }
      }
    }

    // --- IDE config ---
    if (options.default) {
      output.initSkipped("IDE configuration skipped");
    } else {
      output.initSection("IDE integration");
      output.initDescription("Adds YAML schema validation for flow config files in your editor.");

      const ideChoice = await select<string>({
        message: "Select your IDE for YAML schema support:",
        choices: [
          { name: "VS Code", value: "vscode" },
          { name: "JetBrains (IntelliJ, WebStorm, etc.)", value: "jetbrains" },
          { name: "Zed", value: "zed" },
          { name: "None / skip", value: "none" },
        ],
      });

      if (ideChoice === "vscode") {
        const { result, filePath } = await writeVsCodeSettings(
          currentDir,
          SCHEMA_CDN_URL,
          confirmFn,
        );
        outputForResult(result, path.relative(currentDir, filePath));
      } else if (ideChoice === "jetbrains") {
        const { result, filePath } = await writeJetBrainsSchema(
          currentDir,
          SCHEMA_CDN_URL,
          confirmFn,
        );
        outputForResult(result, path.relative(currentDir, filePath));
      } else if (ideChoice === "zed") {
        const { result, filePath } = await writeZedSettings(currentDir, SCHEMA_CDN_URL, confirmFn);
        outputForResult(result, path.relative(currentDir, filePath));
      } else {
        output.initSkipped("IDE configuration skipped");
      }
    }

    // --- AI tool skill + agent injection ---
    if (options.default) {
      output.initSkipped("AI tool integration skipped");
    } else {
      output.initSection("AI tool integration");
      output.initDescription(
        "Installs the agentflow skill and agent definitions for your AI tool.",
      );

      const aiToolChoice = await select<string>({
        message: "Select your AI tool to inject the agentflow skill:",
        choices: [
          { name: "Claude Code", value: "claude-code" },
          { name: "Cursor", value: "cursor" },
          { name: "Windsurf", value: "windsurf" },
          { name: "None / skip", value: "none" },
        ],
      });

      if (aiToolChoice !== "none") {
        const toolRoot = AI_TOOL_ROOTS[aiToolChoice];
        if (toolRoot !== undefined) {
          // Skill injection
          await copySkill(SKILL_NAME, currentDir, toolRoot, confirmFn);
          await copySkill(OPTIMIZE_SKILL_NAME, currentDir, toolRoot, confirmFn);

          // Permissions — add agentflow Bash rules to ~/.claude/settings.json (Claude Code only)
          if (aiToolChoice === "claude-code") {
            const { result, filePath } = writeClaudeCodePermissions();
            outputForResult(result, `${filePath} (permissions)`);
          }

          // Agent injection — install agent files bundled with each selected flow
          if (selectedFlows.length > 0 && bundledFlowsDir !== "") {
            const agentsDestDir = path.join(currentDir, toolRoot, AGENTS_FOLDER_NAME);
            for (const flowName of selectedFlows) {
              const agentsSrcDir = path.join(bundledFlowsDir, flowName, AGENTS_FOLDER_NAME);
              if (fileExists(agentsSrcDir)) {
                createFolder(agentsDestDir);
                for (const agentFile of fs.readdirSync(agentsSrcDir)) {
                  const agentSrc = path.join(agentsSrcDir, agentFile);
                  const agentDest = path.join(agentsDestDir, agentFile);
                  const label = path.relative(currentDir, agentDest);
                  await copyFileWithConfirm(agentSrc, agentDest, label, confirmFn);
                }
              }
            }
          }
        }
      } else {
        output.initSkipped("AI tool integration skipped");
      }
    }

    output.initSuccess();
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
