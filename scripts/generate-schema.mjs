// Script to generate schema/agentflow-flow.schema.json
// Run with: node scripts/generate-schema.mjs

import { toJSONSchema } from "zod";
import { flowConfigSchema } from "../src/flow/schema.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const outputPath = path.join(projectRoot, "schema", "agentflow-flow.schema.json");

const schema = toJSONSchema(flowConfigSchema);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), "utf8");

console.log(`Generated schema at: ${outputPath}`);
