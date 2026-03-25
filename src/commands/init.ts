import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { checkbox, select } from "@inquirer/prompts";
import {
  AGENTS_FOLDER_NAME,
  AI_TOOL_ROOTS,
  CONFIG_FILE_NAME,
  DEFAULT_ROOT_FOLDER_NAME,
  FLOWS_FOLDER_NAME,
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
import {
  copyDirRecursive,
  createFolder,
  fileExists,
  listDirs,
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

/** Resolves the absolute path to the bundled skill file (skills/agentflow/SKILL.md at package root). */
function getBundledSkillFile(): string {
  const __filename = fileURLToPath(import.meta.url);
  const candidates = [
    path.resolve(path.dirname(__filename), "..", SKILLS_FOLDER_NAME, SKILL_NAME, SKILL_FILE_NAME),
    path.resolve(
      path.dirname(__filename),
      "..",
      "..",
      SKILLS_FOLDER_NAME,
      SKILL_NAME,
      SKILL_FILE_NAME,
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[candidates.length - 1] ?? "";
}

export async function init() {
  try {
    const currentDir = process.cwd();
    const mainFolderPath = path.join(currentDir, DEFAULT_ROOT_FOLDER_NAME);
    const configFilePath = path.join(mainFolderPath, CONFIG_FILE_NAME);

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
    if (bundledFlowsDir !== "" && fileExists(bundledFlowsDir)) {
      const bundledFlowNames = listDirs(bundledFlowsDir);
      if (bundledFlowNames.length > 0) {
        output.initSection("Bundled flows");
        selectedFlows = await checkbox<string>({
          message: "Select flows to copy into your project:",
          choices: bundledFlowNames.map((name) => ({ name, value: name, checked: true })),
        });

        if (selectedFlows.length > 0) {
          for (const flowName of selectedFlows) {
            const src = path.join(bundledFlowsDir, flowName);
            const dest = path.join(mainFolderPath, FLOWS_FOLDER_NAME, flowName);
            copyDirRecursive(src, dest, [AGENTS_FOLDER_NAME]);
            output.initCreated(`flows/${flowName}/`);
          }
        } else {
          output.initSkipped("No flows selected");
        }
      }
    }

    // --- IDE config ---
    output.initSection("IDE integration");

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
      const settingsPath = writeVsCodeSettings(currentDir, SCHEMA_CDN_URL);
      output.initCreated(path.relative(currentDir, settingsPath));
    } else if (ideChoice === "jetbrains") {
      const xmlPath = writeJetBrainsSchema(currentDir, SCHEMA_CDN_URL);
      output.initCreated(path.relative(currentDir, xmlPath));
    } else if (ideChoice === "zed") {
      const settingsPath = writeZedSettings(currentDir, SCHEMA_CDN_URL);
      output.initCreated(path.relative(currentDir, settingsPath));
    } else {
      output.initSkipped("IDE configuration skipped");
    }

    // --- AI tool skill + agent injection ---
    output.initSection("AI tool integration");
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
        const bundledSkillFile = getBundledSkillFile();
        if (fileExists(bundledSkillFile)) {
          const skillDestDir = path.join(currentDir, toolRoot, SKILLS_FOLDER_NAME, SKILL_NAME);
          const skillDestPath = path.join(skillDestDir, SKILL_FILE_NAME);
          createFolder(skillDestDir);
          fs.copyFileSync(bundledSkillFile, skillDestPath);
          output.initCreated(path.relative(currentDir, skillDestPath));
        } else {
          output.initWarning("Bundled skill file not found — skipping");
        }

        // Permissions — add agentflow Bash rules to ~/.claude/settings.json (Claude Code only)
        if (aiToolChoice === "claude-code") {
          const claudeSettingsPath = writeClaudeCodePermissions();
          output.initCreated(`${claudeSettingsPath} (permissions)`);
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
                fs.copyFileSync(agentSrc, agentDest);
                output.initCreated(path.relative(currentDir, agentDest));
              }
            }
          }
        }
      }
    } else {
      output.initSkipped("AI tool integration skipped");
    }

    output.initSuccess();
  } catch (err) {
    output.error(err);
    process.exit(1);
  }
}
