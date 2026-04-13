import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfirmFn, WriteResult } from "../types.js";

/**
 * Merges a yaml.schemas entry into .vscode/settings.json for the VS Code YAML extension.
 * - If the entry already exists with the same value: skips silently.
 * - If the entry is absent: writes silently.
 * - If the entry exists with a different value: prompts via confirmFn before writing.
 * Creates the file and directory if they do not exist.
 */
export async function writeVsCodeSettings(
  projectRoot: string,
  schemaUrl: string,
  confirmFn: ConfirmFn,
): Promise<{ result: WriteResult; filePath: string }> {
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

  const existingSchemas = existing["yaml.schemas"] as Record<string, unknown> | undefined;
  const existingEntry = existingSchemas?.[schemaUrl];
  const newEntry = ["agentFlow/flows/*/.agentflow.yaml"];

  if (existingEntry !== undefined) {
    if (JSON.stringify(existingEntry) === JSON.stringify(newEntry)) {
      return { result: "skipped", filePath: settingsPath };
    }
    const ok = await confirmFn("Update yaml.schemas entry in .vscode/settings.json?");
    if (!ok) {
      return { result: "declined", filePath: settingsPath };
    }
  }

  const updated = {
    ...existing,
    "yaml.schemas": {
      ...existingSchemas,
      [schemaUrl]: newEntry,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf8");
  return { result: "written", filePath: settingsPath };
}
