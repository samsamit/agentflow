// Shared TypeScript types — populated by later implementation slices

export type WriteResult = "written" | "skipped" | "declined";
export type ConfirmFn = (message: string) => Promise<boolean>;
