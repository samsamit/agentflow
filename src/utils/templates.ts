import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getTemplatePath = (templateFile: string): string => {
    return path.join(__dirname, `../templates/${templateFile}`);
}

