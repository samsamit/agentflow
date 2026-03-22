import * as fs from "node:fs";
import * as path from "node:path";
import { toJSONSchema } from "zod";
import { FlowConfigSchema } from "../flow/schema.js";

/**
 * Generates a JSON Schema from the FlowConfig Zod schema and writes it to the
 * specified output path. Parent directories are created if they do not exist.
 */
export function generateFlowSchema(outputPath: string): void {
  const schema = toJSONSchema(FlowConfigSchema);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), "utf8");
}
