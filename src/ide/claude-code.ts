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
