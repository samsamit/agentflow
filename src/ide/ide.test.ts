import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

// ---------------------------------------------------------------------------
// VS Code
// ---------------------------------------------------------------------------

describe("writeVsCodeSettings", () => {
  it("creates .vscode/settings.json if it does not exist", () => {
    writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json");
    const settingsPath = path.join(tmpDir, ".vscode", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
  });

  it("writes yaml.schemas entry with the correct key and value", () => {
    writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json");
    const settings = readJson(path.join(tmpDir, ".vscode", "settings.json"));
    const yamlSchemas = settings["yaml.schemas"] as Record<string, unknown>;
    expect(yamlSchemas).toBeDefined();
    expect(Object.keys(yamlSchemas)).toHaveLength(1);
    const [key] = Object.keys(yamlSchemas);
    expect(key).toContain("agentflow-flow.schema.json");
    expect(yamlSchemas[key]).toEqual(["agentFlow/flows/*/.agentflow.yaml"]);
  });

  it("merges into existing settings.json without overwriting other keys", () => {
    const settingsPath = path.join(tmpDir, ".vscode", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ "editor.tabSize": 2 }, null, 2));

    writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json");
    const settings = readJson(settingsPath);
    expect(settings["editor.tabSize"]).toBe(2);
    expect(settings["yaml.schemas"]).toBeDefined();
  });

  it("returns the path to the settings file", () => {
    const result = writeVsCodeSettings(tmpDir, "schema/agentflow-flow.schema.json");
    expect(result).toBe(path.join(tmpDir, ".vscode", "settings.json"));
  });
});

// ---------------------------------------------------------------------------
// JetBrains
// ---------------------------------------------------------------------------

describe("writeJetBrainsSchema", () => {
  it("creates .idea/jsonSchemas.xml", () => {
    writeJetBrainsSchema(tmpDir, "schema/agentflow-flow.schema.json");
    const xmlPath = path.join(tmpDir, ".idea", "jsonSchemas.xml");
    expect(fs.existsSync(xmlPath)).toBe(true);
  });

  it("written XML contains schema path and file pattern", () => {
    writeJetBrainsSchema(tmpDir, "schema/agentflow-flow.schema.json");
    const content = fs.readFileSync(path.join(tmpDir, ".idea", "jsonSchemas.xml"), "utf8");
    expect(content).toContain("agentflow-flow.schema.json");
    expect(content).toContain(".agentflow.yaml");
  });

  it("returns the path to the XML file", () => {
    const result = writeJetBrainsSchema(tmpDir, "schema/agentflow-flow.schema.json");
    expect(result).toBe(path.join(tmpDir, ".idea", "jsonSchemas.xml"));
  });
});

// ---------------------------------------------------------------------------
// Zed
// ---------------------------------------------------------------------------

describe("writeZedSettings", () => {
  it("creates .zed/settings.json if it does not exist", () => {
    writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json");
    const settingsPath = path.join(tmpDir, ".zed", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
  });

  it("writes file_associations entry with the correct key and value", () => {
    writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json");
    const settings = readJson(path.join(tmpDir, ".zed", "settings.json"));
    const fileAssociations = settings["file_associations"] as Record<string, unknown>;
    expect(fileAssociations).toBeDefined();
    const pattern = "**/agentFlow/flows/*/.agentflow.yaml";
    expect(fileAssociations[pattern]).toContain("agentflow-flow.schema.json");
  });

  it("merges into existing settings.json without overwriting other keys", () => {
    const settingsPath = path.join(tmpDir, ".zed", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ "tab_size": 4 }, null, 2));

    writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json");
    const settings = readJson(settingsPath);
    expect(settings["tab_size"]).toBe(4);
    expect(settings["file_associations"]).toBeDefined();
  });

  it("returns the path to the settings file", () => {
    const result = writeZedSettings(tmpDir, "schema/agentflow-flow.schema.json");
    expect(result).toBe(path.join(tmpDir, ".zed", "settings.json"));
  });
});
