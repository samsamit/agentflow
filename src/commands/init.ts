import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import {
  AGENTS_FOLDER_NAME,
  AI_TOOL_ROOTS,
  CONFIG_FILE_NAME,
  DEFAULT_ROOT_FOLDER_NAME,
  FLOW_SKILL_NAME,
  FLOWS_FOLDER_NAME,
  OPTIMIZE_SKILL_NAME,
  SCHEMA_CDN_URL,
  SKILL_FILE_NAME,
  SKILL_NAME,
  SKILLS_FOLDER_NAME,
  TASKS_FOLDER_NAME,
} from "../constants.js";
import {
  readClaudeCodeLocalSettings,
  writeClaudeCodeLocalSettings,
  writeClaudeCodePermissions,
} from "../ide/claude-code.js";
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

    const mainFolderResult = createFolder(mainFolderPath);
    if (mainFolderResult.alreadyExists) output.initSkipped(`${DEFAULT_ROOT_FOLDER_NAME}/`);
    else output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/`);

    if (fileExists(configFilePath)) {
      output.initSkipped(`${DEFAULT_ROOT_FOLDER_NAME}/${CONFIG_FILE_NAME}`);
    } else {
      writeFile(configFilePath, configTemplate);
      output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${CONFIG_FILE_NAME}`);
    }

    const tasksFolderResult = createFolder(path.join(mainFolderPath, TASKS_FOLDER_NAME));
    if (tasksFolderResult.alreadyExists)
      output.initSkipped(`${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/`);
    else output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/`);

    const flowsFolderResult = createFolder(path.join(mainFolderPath, FLOWS_FOLDER_NAME));
    if (flowsFolderResult.alreadyExists)
      output.initSkipped(`${DEFAULT_ROOT_FOLDER_NAME}/${FLOWS_FOLDER_NAME}/`);
    else output.initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${FLOWS_FOLDER_NAME}/`);

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
          // Optional skill selection
          const optionalSkills = await checkbox<string>({
            message: "Select optional skills to install:",
            choices: [
              {
                name: `agentflow-optimize — Analyzes completed step artifacts and suggests instruction improvements, reducing revision cycles on future runs`,
                value: OPTIMIZE_SKILL_NAME,
                checked: true,
              },
              {
                name: `agentflow-flow — Conversational tool for creating and modifying flows; design new workflows or add steps through natural language`,
                value: FLOW_SKILL_NAME,
                checked: true,
              },
            ],
          });

          // Skill injection
          await copySkill(SKILL_NAME, currentDir, toolRoot, confirmFn);
          if (optionalSkills.includes(OPTIMIZE_SKILL_NAME)) {
            await copySkill(OPTIMIZE_SKILL_NAME, currentDir, toolRoot, confirmFn);
          }
          if (optionalSkills.includes(FLOW_SKILL_NAME)) {
            await copySkill(FLOW_SKILL_NAME, currentDir, toolRoot, confirmFn);
          }

          // Permissions — add agentflow Bash rules to ~/.claude/settings.json (Claude Code only)
          if (aiToolChoice === "claude-code") {
            const { result, filePath } = writeClaudeCodePermissions();
            outputForResult(result, `${filePath} (permissions)`);

            // Local project settings — .claude/settings.local.json
            output.initSection("Claude Code project settings");
            output.initDescription(
              "Writes .claude/settings.local.json with recommended settings for agentflow workflows.",
            );

            const existingLocalSettings = readClaudeCodeLocalSettings(currentDir);

            let defaultMode = existingLocalSettings.defaultMode ?? "acceptEdits";
            let bashTimeoutMs = existingLocalSettings.bashTimeoutMs ?? "300000";
            let autocompactPct = existingLocalSettings.autocompactPct ?? "80";

            if (!options.default) {
              output.initSettingDescription(
                "defaultMode: How Claude handles permission requests during workflow steps. Claude Code defaults to \"default\" (prompts for approval on each action).",
              );
              defaultMode = await select<string>({
                message: `Default permission mode [${existingLocalSettings.defaultMode !== undefined ? `current: ${existingLocalSettings.defaultMode}` : "agentflow default: acceptEdits"}]:`,
                default: defaultMode,
                choices: [
                  {
                    name: "acceptEdits  (recommended) — auto-approve file edits for autonomous step execution",
                    value: "acceptEdits",
                  },
                  {
                    name: "default — prompt for approval on each action",
                    value: "default",
                  },
                ],
              });
              output.info("");

              output.initSettingDescription(
                "BASH_DEFAULT_TIMEOUT_MS: How long a bash command can run before timing out. Default is 120 000 ms (2 min) — workflow steps involving builds or tests often need more.",
              );
              bashTimeoutMs = await input({
                message: `Bash timeout (ms) [${existingLocalSettings.bashTimeoutMs !== undefined ? `current: ${existingLocalSettings.bashTimeoutMs}` : "agentflow default: 300000"}]:`,
                default: bashTimeoutMs,
              });
              output.info("");

              output.initSettingDescription(
                "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: Context usage % at which auto-compaction triggers. Default is ~95% — compacting at 80% avoids mid-step interruption.",
              );
              autocompactPct = await input({
                message: `Auto-compact at (% of context) [${existingLocalSettings.autocompactPct !== undefined ? `current: ${existingLocalSettings.autocompactPct}` : "agentflow default: 80"}]:`,
                default: autocompactPct,
              });
              output.info("");
            }

            const { result: localResult, filePath: localFilePath } = writeClaudeCodeLocalSettings(
              currentDir,
              {
                defaultMode,
                bashTimeoutMs,
                autocompactPct,
              },
            );
            outputForResult(localResult, path.relative(currentDir, localFilePath));
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
