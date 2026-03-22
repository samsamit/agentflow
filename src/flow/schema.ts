import { z } from "zod";

export const stepConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  requires: z.array(z.string()).optional(),
  generates: z.string().optional(),
  generateStrategy: z.enum(["replace", "update", "version"]).optional(),
  subagent: z.union([z.boolean(), z.string()]).optional(),
  context: z.object({
    instructions: z.string(),
    references: z.array(z.string()).optional(),
    steps: z.array(z.string()).optional(),
  }),
  validates: z.array(z.string()).optional(),
});

export const flowConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  maxRevisions: z.number().int().positive().optional(),
  steps: z.array(stepConfigSchema),
});

export const rootConfigSchema = z.object({
  defaultFlow: z.string(),
});

export type StepConfig = z.infer<typeof stepConfigSchema>;
export type FlowConfig = z.infer<typeof flowConfigSchema>;
export type RootConfig = z.infer<typeof rootConfigSchema>;

// PascalCase aliases for consistency
export const FlowConfigSchema = flowConfigSchema;
export const StepConfigSchema = stepConfigSchema;
export const RootConfigSchema = rootConfigSchema;
