/**
 * Build-time script: generates schema/agentflow-flow.schema.json
 * from the Zod FlowConfig schema.
 *
 * Run via: node dist/generate-schema.mjs
 * Called automatically by the build script.
 */
import * as path from "path";
import { fileURLToPath } from "url";
import { generateFlowSchema } from "../schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/generate-schema.mjs → package root is one level up
const outputPath = path.join(__dirname, "..", "schema", "agentflow-flow.schema.json");

generateFlowSchema(outputPath);
console.log("Generated: schema/agentflow-flow.schema.json");
