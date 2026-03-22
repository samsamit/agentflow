import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Merges a yaml.schemas entry into .vscode/settings.json for the VS Code YAML extension.
 * Creates the file (and parent directory) if it does not exist.
 * Returns the absolute path to the settings file.
 */
export function writeVsCodeSettings(projectRoot: string, schemaRelativePath: string): string {
  const settingsPath = path.join(projectRoot, ".vscode", "settings.json");
  const settingsDir = path.dirname(settingsPath);

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  const yamlSchemas: Record<string, unknown> = {
    [schemaRelativePath]: ["agentFlow/flows/*/.agentflow.yaml"],
  };

  const updated = {
    ...existing,
    "yaml.schemas": {
      ...(existing["yaml.schemas"] as Record<string, unknown> | undefined),
      ...yamlSchemas,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf8");
  return settingsPath;
}
