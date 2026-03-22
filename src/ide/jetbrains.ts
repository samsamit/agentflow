import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Writes .idea/jsonSchemas.xml with a schema mapping for agentflow flow configs.
 * Creates the .idea directory if it does not exist.
 * Returns the absolute path to the XML file.
 */
export function writeJetBrainsSchema(projectRoot: string, schemaRelativePath: string): string {
  const ideaDir = path.join(projectRoot, ".idea");
  const xmlPath = path.join(ideaDir, "jsonSchemas.xml");

  if (!fs.existsSync(ideaDir)) {
    fs.mkdirSync(ideaDir, { recursive: true });
  }

  const schemaPathForXml = schemaRelativePath.replace(/\\/g, "/");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

  fs.writeFileSync(xmlPath, xml, "utf8");
  return xmlPath;
}
