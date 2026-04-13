import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfirmFn, WriteResult } from "../types.js";

const ZED_PATTERN = "**/agentFlow/flows/*/.agentflow.yaml";

/**
 * Merges a file_associations entry into .zed/settings.json for the Zed editor.
 * - If the entry already exists with the same value: skips silently.
 * - If the entry is absent: writes silently.
 * - If the entry exists with a different value: prompts via confirmFn before writing.
 * Creates the file and directory if they do not exist.
 */
export async function writeZedSettings(
  projectRoot: string,
  schemaUrl: string,
  confirmFn: ConfirmFn,
): Promise<{ result: WriteResult; filePath: string }> {
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

  const existingAssociations = existing.file_associations as Record<string, unknown> | undefined;
  const existingEntry = existingAssociations?.[ZED_PATTERN];
  const schemaUrlForZed = schemaUrl.replace(/\\/g, "/");

  if (existingEntry !== undefined) {
    if (existingEntry === schemaUrlForZed) {
      return { result: "skipped", filePath: settingsPath };
    }
    const ok = await confirmFn("Update file_associations entry in .zed/settings.json?");
    if (!ok) {
      return { result: "declined", filePath: settingsPath };
    }
  }

  const updated = {
    ...existing,
    file_associations: {
      ...existingAssociations,
      [ZED_PATTERN]: schemaUrlForZed,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf8");
  return { result: "written", filePath: settingsPath };
}
