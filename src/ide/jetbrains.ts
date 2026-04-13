import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfirmFn, WriteResult } from "../types.js";

function buildXml(schemaUrl: string): string {
  const schemaPathForXml = schemaUrl.replace(/\\/g, "/");
  return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="JsonSchemaMappingsProjectConfiguration">
    <state>
      <map>
        <entry key="agentflow-flow">
          <value>
            <SchemaInfo>
              <option name="name" value="agentflow-flow" />
              <option name="relativePathToSchema" value="${schemaPathForXml}" />
              <option name="patterns">
                <list>
                  <Item value="agentFlow/flows/*/.agentflow.yaml" />
                </list>
              </option>
            </SchemaInfo>
          </value>
        </entry>
      </map>
    </state>
  </component>
</project>
`;
}

/**
 * Writes .idea/jsonSchemas.xml with a schema mapping for agentflow flow configs.
 * - If file does not exist: writes silently.
 * - If file exists and content is identical: skips silently.
 * - If file exists and content differs: prompts via confirmFn before writing.
 * Creates the .idea directory if it does not exist.
 */
export async function writeJetBrainsSchema(
  projectRoot: string,
  schemaUrl: string,
  confirmFn: ConfirmFn,
): Promise<{ result: WriteResult; filePath: string }> {
  const ideaDir = path.join(projectRoot, ".idea");
  const xmlPath = path.join(ideaDir, "jsonSchemas.xml");

  if (!fs.existsSync(ideaDir)) {
    fs.mkdirSync(ideaDir, { recursive: true });
  }

  const newContent = buildXml(schemaUrl);

  if (fs.existsSync(xmlPath)) {
    const existing = fs.readFileSync(xmlPath, "utf8");
    if (existing === newContent) {
      return { result: "skipped", filePath: xmlPath };
    }
    const ok = await confirmFn("Replace .idea/jsonSchemas.xml with updated schema config?");
    if (!ok) {
      return { result: "declined", filePath: xmlPath };
    }
  }

  fs.writeFileSync(xmlPath, newContent, "utf8");
  return { result: "written", filePath: xmlPath };
}
