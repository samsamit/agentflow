import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getTemplatePath = (templateFile: string): string => {
  return path.join(__dirname, `../templates/${templateFile}`);
};
