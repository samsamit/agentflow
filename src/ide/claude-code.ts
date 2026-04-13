import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { WriteResult } from "../types.js";

const AGENTFLOW_PERMISSIONS = ["Bash(npx agentflow:*)", "Bash(agentflow:*)"];

/**
 * Merges agentflow Bash permission rules into ~/.claude/settings.json.
 * Creates the file if it doesn't exist. Skips rules already present.
 * Returns the write result and absolute path.
 */
export function writeClaudeCodePermissions(): { result: WriteResult; filePath: string } {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }

  if (typeof settings.permissions !== "object" || settings.permissions === null) {
    settings.permissions = {};
  }
  const permissions = settings.permissions as Record<string, unknown>;
  if (!Array.isArray(permissions.allow)) {
    permissions.allow = [];
  }
  const allow = permissions.allow as string[];

  const missing = AGENTFLOW_PERMISSIONS.filter((rule) => !allow.includes(rule));
  if (missing.length === 0) {
    return { result: "skipped", filePath: settingsPath };
  }

  for (const rule of missing) {
    allow.push(rule);
  }

  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  return { result: "written", filePath: settingsPath };
}

export interface ExistingLocalSettings {
  defaultMode: string | undefined;
  bashTimeoutMs: string | undefined;
  autocompactPct: string | undefined;
}

/**
 * Reads existing agentflow-relevant values from .claude/settings.local.json.
 * Returns undefined for any value not yet set.
 */
export function readClaudeCodeLocalSettings(projectDir: string): ExistingLocalSettings {
  const settingsPath = path.join(projectDir, ".claude", "settings.local.json");
  if (!fs.existsSync(settingsPath)) {
    return { defaultMode: undefined, bashTimeoutMs: undefined, autocompactPct: undefined };
  }
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    const perms =
      typeof settings.permissions === "object" && settings.permissions !== null
        ? (settings.permissions as Record<string, unknown>)
        : {};
    const env =
      typeof settings.env === "object" && settings.env !== null
        ? (settings.env as Record<string, string>)
        : {};
    return {
      defaultMode: typeof perms.defaultMode === "string" ? perms.defaultMode : undefined,
      bashTimeoutMs:
        typeof env["BASH_DEFAULT_TIMEOUT_MS"] === "string"
          ? env["BASH_DEFAULT_TIMEOUT_MS"]
          : undefined,
      autocompactPct:
        typeof env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"] === "string"
          ? env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"]
          : undefined,
    };
  } catch {
    return { defaultMode: undefined, bashTimeoutMs: undefined, autocompactPct: undefined };
  }
}

const LOCAL_SETTINGS_SCHEMA = "https://json.schemastore.org/claude-code-settings.json";

const LOCAL_PERMISSION_RULES = [
  "Bash(agentflow:*)",
  "Bash(npx agentflow:*)",
  "Skill(agentflow)",
  "Skill(agentflow-optimize)",
];

export interface LocalSettingsOptions {
  defaultMode: string;
  bashTimeoutMs: string;
  autocompactPct: string;
}

/**
 * Writes agentflow-recommended settings to .claude/settings.local.json in the project.
 * Merges with any existing content. Returns "skipped" if nothing changed.
 */
export function writeClaudeCodeLocalSettings(
  projectDir: string,
  options: LocalSettingsOptions,
): { result: WriteResult; filePath: string } {
  const settingsPath = path.join(projectDir, ".claude", "settings.local.json");

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }

  const before = JSON.stringify(settings);

  settings.$schema = LOCAL_SETTINGS_SCHEMA;

  if (typeof settings.permissions !== "object" || settings.permissions === null) {
    settings.permissions = {};
  }
  const perms = settings.permissions as Record<string, unknown>;

  if (!Array.isArray(perms.allow)) {
    perms.allow = [];
  }
  const allow = perms.allow as string[];
  for (const rule of LOCAL_PERMISSION_RULES) {
    if (!allow.includes(rule)) {
      allow.push(rule);
    }
  }

  perms.defaultMode = options.defaultMode;

  if (typeof settings.env !== "object" || settings.env === null) {
    settings.env = {};
  }
  const env = settings.env as Record<string, string>;
  env["BASH_DEFAULT_TIMEOUT_MS"] = options.bashTimeoutMs;
  env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"] = options.autocompactPct;

  if (JSON.stringify(settings) === before) {
    return { result: "skipped", filePath: settingsPath };
  }

  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  return { result: "written", filePath: settingsPath };
}
