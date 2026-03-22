/**
 * This test generates the checked-in schema file at schema/agentflow-flow.schema.json.
 * It runs as part of the test suite to keep the schema up to date.
 */
import { fileURLToPath } from "url";
import * as path from "path";
import { describe, it } from "vitest";
import { generateFlowSchema } from "./index.js";

describe("generate-schema (checked-in artifact)", () => {
  it("generates schema/agentflow-flow.schema.json from the Zod schema", () => {
    // __filename points to src/schema/generate-schema.test.ts
    // Project root is two directories up
    const __filename = fileURLToPath(import.meta.url);
    const projectRoot = path.resolve(path.dirname(__filename), "..", "..");
    const outputPath = path.join(projectRoot, "schema", "agentflow-flow.schema.json");
    generateFlowSchema(outputPath);
  });
});
