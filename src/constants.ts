export const DEFAULT_ROOT_FOLDER_NAME = "agentFlow";
export const CONFIG_FILE_NAME = ".agentflow.yaml";
export const FLOWS_FOLDER_NAME = "flows";
export const TASKS_FOLDER_NAME = "tasks";
export const TASK_STATE_FILE_NAME = ".taskState.yaml";
export const INSTRUCTIONS_FOLDER_NAME = "instructions";
export const SCHEMA_FILE_NAME = "agentflow-flow.schema.json";
export const SCHEMA_CDN_URL = `https://cdn.jsdelivr.net/npm/@samsamit/agentflow@latest/schema/${SCHEMA_FILE_NAME}`;
export const SKILLS_FOLDER_NAME = "skills";
export const SKILL_NAME = "agentflow";
export const OPTIMIZE_SKILL_NAME = "agentflow-optimize";
export const SKILL_FILE_NAME = "SKILL.md";
export const AGENTS_FOLDER_NAME = "agents";

export const AI_TOOL_ROOTS: Record<string, string> = {
  "claude-code": ".claude",
  cursor: ".cursor",
  windsurf: ".windsurf",
};
