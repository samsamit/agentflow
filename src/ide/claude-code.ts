import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const AGENTFLOW_PERMISSIONS = ["Bash(npx agentflow:*)", "Bash(agentflow:*)"];

/**
 * Merges agentflow Bash permission rules into ~/.claude/settings.json.
 * Creates the file if it doesn't exist. Skips rules already present.
 * Returns the absolute path of the settings file written.
 */
export function writeClaudeCodePermissions(): string {
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

  for (const rule of AGENTFLOW_PERMISSIONS) {
    if (!allow.includes(rule)) {
      allow.push(rule);
    }
  }

  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  return settingsPath;
}
