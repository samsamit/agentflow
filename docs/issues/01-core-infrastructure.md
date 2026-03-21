# Issue 1: Core Infrastructure

**Type:** AFK
**Blocked by:** None — can start immediately

## What to build

Establish the foundational infrastructure that all other slices depend on. This slice has no user-facing feature but unlocks every subsequent slice.

- Create `src/output.ts` with typed helper functions for every output pattern (task started, step complete, error, next command, etc.). No `console.log` or `console.error` anywhere else in the codebase.
- Refactor `src/utils/fileIo.ts` to throw on failure instead of returning `Try<T>`. Remove all `Try<T>` usage.
- Delete `Try<T>` from `src/types.ts`.
- Enable the four strict TypeScript flags currently commented out in `tsconfig.json`: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- Fix any TypeScript errors introduced by enabling strict flags.

Reference: `docs/prd.md` — Implementation Decisions → `output.ts`, TypeScript Strictness.

## Acceptance criteria

- [ ] `src/output.ts` exists and exports named functions for every output pattern needed by existing code
- [ ] No `console.log` or `console.error` calls exist outside `output.ts`
- [ ] `fileIo.ts` throws on failure; `Try<T>` type is deleted
- [ ] All four strict TS flags are enabled and the project compiles with zero errors
- [ ] `chainflow init` still works end-to-end after the refactor

## Blocked by

None — can start immediately

## User stories addressed

Architectural prerequisites for all user stories. No direct user stories — this is foundational.
