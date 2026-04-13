import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConfirmFn } from "../types.js";
import { writeJetBrainsSchema } from "./jetbrains.js";
import { writeVsCodeSettings } from "./vscode.js";
import { writeZedSettings } from "./zed.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-ide-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

/** Always approves — simulates --default or user saying yes */
const approve: ConfirmFn = async () => true;
/** Always declines — simulates user saying no */
const decline: ConfirmFn = async () => false;

// ---------------------------------------------------------------------------
// VS Code
// ---------------------------------------------------------------------------

describe("writeVsCodeSettings", () => {
  it("creates .vscode/settings.json if it does not exist", async () => {
    await writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const settingsPath = path.join(tmpDir, ".vscode", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
  });

  it("writes yaml.schemas entry with the correct key and value", async () => {
    await writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const settings = readJson(path.join(tmpDir, ".vscode", "settings.json"));
    const yamlSchemas = settings["yaml.schemas"] as Record<string, unknown>;
    expect(yamlSchemas).toBeDefined();
    expect(Object.keys(yamlSchemas)).toHaveLength(1);
    const [key] = Object.keys(yamlSchemas);
    expect(key).toContain("agentflow-flow.schema.json");
    if (key === undefined) throw new Error("Expected at least one key in yaml.schemas");
    expect(yamlSchemas[key]).toEqual(["agentFlow/flows/*/.agentflow.yaml"]);
  });

  it("merges into existing settings.json without overwriting other keys", async () => {
    const settingsPath = path.join(tmpDir, ".vscode", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ "editor.tabSize": 2 }, null, 2));

    await writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const settings = readJson(settingsPath);
    expect(settings["editor.tabSize"]).toBe(2);
    expect(settings["yaml.schemas"]).toBeDefined();
  });

  it("returns written result and the path to the settings file", async () => {
    const { result, filePath } = await writeVsCodeSettings(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      approve,
    );
    expect(result).toBe("written");
    expect(filePath).toBe(path.join(tmpDir, ".vscode", "settings.json"));
  });

  it("returns skipped when entry already exists with same value", async () => {
    await writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const { result } = await writeVsCodeSettings(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      approve,
    );
    expect(result).toBe("skipped");
  });

  it("returns declined and does not write when entry differs and user declines", async () => {
    const settingsPath = path.join(tmpDir, ".vscode", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        { "yaml.schemas": { "schema/agentflow-flow.schema.json": ["other/*.yaml"] } },
        null,
        2,
      ),
    );

    const { result } = await writeVsCodeSettings(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      decline,
    );
    expect(result).toBe("declined");
    const settings = readJson(settingsPath);
    const schemas = settings["yaml.schemas"] as Record<string, unknown>;
    expect(schemas["schema/agentflow-flow.schema.json"]).toEqual(["other/*.yaml"]);
  });
});

// ---------------------------------------------------------------------------
// JetBrains
// ---------------------------------------------------------------------------

describe("writeJetBrainsSchema", () => {
  it("creates .idea/jsonSchemas.xml", async () => {
    await writeJetBrainsSchema(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const xmlPath = path.join(tmpDir, ".idea", "jsonSchemas.xml");
    expect(fs.existsSync(xmlPath)).toBe(true);
  });

  it("written XML contains schema path and file pattern", async () => {
    await writeJetBrainsSchema(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const content = fs.readFileSync(path.join(tmpDir, ".idea", "jsonSchemas.xml"), "utf8");
    expect(content).toContain("agentflow-flow.schema.json");
    expect(content).toContain(".agentflow.yaml");
  });

  it("returns written result and the path to the XML file", async () => {
    const { result, filePath } = await writeJetBrainsSchema(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      approve,
    );
    expect(result).toBe("written");
    expect(filePath).toBe(path.join(tmpDir, ".idea", "jsonSchemas.xml"));
  });

  it("returns skipped when file already exists with identical content", async () => {
    await writeJetBrainsSchema(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const { result } = await writeJetBrainsSchema(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      approve,
    );
    expect(result).toBe("skipped");
  });

  it("returns declined and does not overwrite when content differs and user declines", async () => {
    const xmlPath = path.join(tmpDir, ".idea", "jsonSchemas.xml");
    fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
    fs.writeFileSync(xmlPath, "<project>old</project>", "utf8");

    const { result } = await writeJetBrainsSchema(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      decline,
    );
    expect(result).toBe("declined");
    expect(fs.readFileSync(xmlPath, "utf8")).toBe("<project>old</project>");
  });
});

// ---------------------------------------------------------------------------
// Zed
// ---------------------------------------------------------------------------

describe("writeZedSettings", () => {
  it("creates .zed/settings.json if it does not exist", async () => {
    await writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const settingsPath = path.join(tmpDir, ".zed", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
  });

  it("writes file_associations entry with the correct key and value", async () => {
    await writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const settings = readJson(path.join(tmpDir, ".zed", "settings.json"));
    const fileAssociations = settings.file_associations as Record<string, unknown>;
    expect(fileAssociations).toBeDefined();
    const pattern = "**/agentFlow/flows/*/.agentflow.yaml";
    expect(fileAssociations[pattern]).toContain("agentflow-flow.schema.json");
  });

  it("merges into existing settings.json without overwriting other keys", async () => {
    const settingsPath = path.join(tmpDir, ".zed", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ tab_size: 4 }, null, 2));

    await writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const settings = readJson(settingsPath);
    expect(settings.tab_size).toBe(4);
    expect(settings.file_associations).toBeDefined();
  });

  it("returns written result and the path to the settings file", async () => {
    const { result, filePath } = await writeZedSettings(
      tmpDir,
      "schema/agentflow-flow.schema.json",
      approve,
    );
    expect(result).toBe("written");
    expect(filePath).toBe(path.join(tmpDir, ".zed", "settings.json"));
  });

  it("returns skipped when entry already exists with same value", async () => {
    await writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    const { result } = await writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json", approve);
    expect(result).toBe("skipped");
  });

  it("returns declined and does not write when entry differs and user declines", async () => {
    const settingsPath = path.join(tmpDir, ".zed", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    const pattern = "**/agentFlow/flows/*/.agentflow.yaml";
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ file_associations: { [pattern]: "other-schema.json" } }, null, 2),
    );

    const { result } = await writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json", decline);
    expect(result).toBe("declined");
    const settings = readJson(settingsPath);
    const assoc = settings.file_associations as Record<string, unknown>;
    expect(assoc[pattern]).toBe("other-schema.json");
  });
});
