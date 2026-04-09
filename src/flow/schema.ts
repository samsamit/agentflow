import { z } from "zod";

/**
 * Validates a step reference entry: either a plain step name or a step name
 * with the ":ref" suffix (e.g. "research" or "research:ref").
 */
const stepRefSchema = z
  .string()
  .regex(/^[\w-]+(:ref)?$/, 'Must be a step name or a step name followed by ":ref" (e.g. "research:ref")');

/**
 * Parses a step reference entry into its step name and injection mode.
 * "research"     → { stepName: "research", isRef: false }
 * "research:ref" → { stepName: "research", isRef: true }
 */
export function parseStepRef(entry: string): { stepName: string; isRef: boolean } {
  if (entry.endsWith(":ref")) {
    return { stepName: entry.slice(0, -4), isRef: true };
  }
  return { stepName: entry, isRef: false };
}

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
    steps: z.array(stepRefSchema).optional(),
  }),
  validates: z.array(stepRefSchema).optional(),
  pauseAfter: z.boolean().optional(),
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
