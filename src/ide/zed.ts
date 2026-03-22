import * as fs from "fs";
import * as path from "path";

/**
 * Merges a file_associations entry into .zed/settings.json for the Zed editor.
 * Creates the file (and parent directory) if it does not exist.
 * Returns the absolute path to the settings file.
 */
export function writeZedSettings(projectRoot: string, schemaRelativePath: string): string {
  const settingsPath = path.join(projectRoot, ".zed", "settings.json");
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

  const pattern = "**/agentFlow/flows/*/.agentflow.yaml";
  const schemaPathForZed = schemaRelativePath.replace(/\\/g, "/");

  const fileAssociations: Record<string, unknown> = {
    [pattern]: schemaPathForZed,
  };

  const updated = {
    ...existing,
    file_associations: {
      ...(existing["file_associations"] as Record<string, unknown> | undefined),
      ...fileAssociations,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf8");
  return settingsPath;
}
