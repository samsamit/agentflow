import { z } from "zod";

export const stepStateSchema = z.object({
  state: z.enum(["ready", "done", "blocked", "revision"]),
  revisionCount: z.number().int().nonnegative().optional(),
  revisedBy: z.string().optional(),
});

export const taskStateSchema = z.object({
  active: z.boolean(),
  flow: z.string(),
  pausedAfterStep: z.string().optional(),
  steps: z.record(z.string(), stepStateSchema),
});

export type StepState = z.infer<typeof stepStateSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
