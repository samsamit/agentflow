import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateFlowSchema } from "./index.js";

describe("generateFlowSchema", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-schema-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a JSON file at the given output path", () => {
    const outputPath = path.join(tmpDir, "flow.schema.json");
    generateFlowSchema(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it("generates valid JSON", () => {
    const outputPath = path.join(tmpDir, "flow.schema.json");
    generateFlowSchema(outputPath);
    const content = fs.readFileSync(outputPath, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("generated schema has type object at the root", () => {
    const outputPath = path.join(tmpDir, "flow.schema.json");
    generateFlowSchema(outputPath);
    const schema = JSON.parse(fs.readFileSync(outputPath, "utf8")) as Record<string, unknown>;
    expect(schema["type"]).toBe("object");
  });

  it("generated schema includes 'name' and 'steps' in required properties", () => {
    const outputPath = path.join(tmpDir, "flow.schema.json");
    generateFlowSchema(outputPath);
    const schema = JSON.parse(fs.readFileSync(outputPath, "utf8")) as Record<string, unknown>;
    const required = schema["required"] as string[] | undefined;
    expect(required).toContain("name");
    expect(required).toContain("steps");
  });

  it("creates parent directories if they do not exist", () => {
    const outputPath = path.join(tmpDir, "nested", "dir", "flow.schema.json");
    generateFlowSchema(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});
