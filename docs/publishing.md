# Publishing

This document describes how to publish a new version of `@samsamit/agentflow` to npm.

## Overview

Publishing is fully automated via GitHub Actions. You trigger a release manually — the pipeline handles versioning, tagging, and publishing.

```
You trigger Release workflow
        ↓
npm version bump + git tag pushed
        ↓
Publish workflow triggers on tag
        ↓
CI checks (type-check, lint, test)
        ↓
npm publish --provenance
```

## How to release

1. Make sure all changes are merged into `master` and CI is green.
2. Go to **GitHub → Actions → Release → Run workflow**.
3. Choose the bump type:
   - `patch` — bug fixes, internal changes, no API changes (1.0.3 → 1.0.4)
   - `minor` — new features, backwards-compatible (1.0.3 → 1.1.0)
   - `major` — breaking changes (1.0.3 → 2.0.0)
4. Click **Run workflow**.

The workflow will:
- Bump `package.json` version via `npm version`
- Commit the version bump as `chore: release vX.Y.Z`
- Push the commit and a `vX.Y.Z` tag to `master`
- The `publish.yml` workflow triggers automatically on the tag

## What publish.yml does

On every `v*` tag push:
1. Installs dependencies
2. Runs type-check, lint, and tests
3. Builds the package (`prepublishOnly` runs `npm run build` automatically)
4. Publishes to npm with provenance attestation

## Required secrets

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | npm publish authentication (set in GitHub repo settings) |

## Version bump guide

| Change type | Bump |
|---|---|
| Fix a bug, update docs, refactor internals | `patch` |
| Add a new command, new option, new output field | `minor` |
| Rename/remove a command, change output format, break flow YAML schema | `major` |

## Local verification (optional)

Before triggering a release, you can verify locally:

```sh
npm run validate   # type-check + lint + tests
npm run build      # make sure the build succeeds
```
