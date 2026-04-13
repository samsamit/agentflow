---
name: release
description: Create a new versioned release with AI-generated release notes and a GitHub release. Invoke this skill whenever the user mentions releasing, publishing, shipping, cutting a release, bumping the version, creating release notes, or publishing a new version of their package — even if they phrase it casually like "let's ship" or "time to release".
---

# Release Skill

Guide the user through creating a new release: analyze commits since the last tag, generate release notes, confirm the version bump, tag, push, and create a GitHub release.

## Step 1 — Check working tree

First ensure there's nothing uncommitted:
```bash
git status --short
```

If the working tree is dirty, warn the user and ask them to commit or stash before continuing. Do not proceed until it's clean.

## Step 2 — Gather commit history and diff

Find the last release tag:
```bash
git describe --tags --abbrev=0 2>/dev/null
```

If no tags exist yet, this is the first release — use all commits and the full diff:
```bash
git log --oneline --no-merges
git diff --stat
```

Otherwise, get commits and the diff since the last tag:
```bash
git log <last-tag>..HEAD --oneline --no-merges
git diff <last-tag>..HEAD --stat
```

If there are no commits since the last tag, tell the user there is nothing to release and stop.

Also read the current version from `package.json`.

## Step 3 — Generate release notes

Use **both** the commit messages and the diff stat to write release notes. Commits tell you the intent; the diff tells you what actually changed — use both to produce notes that are accurate and meaningful.

- If a commit message is vague (e.g. "updates", "wip", "fix") but the diff reveals a concrete change, describe the actual change instead
- If the diff shows files changed that no commit message mentions, include them
- If a commit message overstates something the diff doesn't support, tone it down

Write structured release notes in this format:

```
## What's Changed

### New Features
- ...

### Bug Fixes
- ...

### Internal
- ...
```

Guidelines:
- Group by type: `feat`/`add` → New Features, `fix` → Bug Fixes, `chore`/`refactor`/`docs`/`build`/`ci` → Internal
- Rewrite each item as a clear human-readable sentence — not a raw commit message
- Omit sections with no items
- Skip merge commits and version bump commits
- Keep it concise — changelog entries, not prose

## Step 4 — Confirm with the user

Present:
1. The generated release notes
2. Your suggested version bump (patch / minor / major) with a one-line explanation

Bump logic:
- Breaking changes or removed/renamed APIs → `major`
- New features or new commands → `minor`
- Only bug fixes, docs, chores → `patch`

Ask the user to confirm the notes and bump type before doing anything. Offer to edit the notes if they want changes.

## Step 5 — Bump version, commit, and tag

Once the user confirms, bump the version without auto-tagging:
```bash
npm version <patch|minor|major> --no-git-tag-version
```

Read the new version from `package.json`, then commit and tag:
```bash
git add package.json package-lock.json
git commit -m "chore: release v<new-version>"
git tag v<new-version>
```

## Step 6 — Push and create GitHub release

Push the commit and tag:
```bash
git push --follow-tags
```

Create the GitHub release (the tag triggers `publish.yml` automatically):
```bash
gh release create v<new-version> \
  --title "v<new-version>" \
  --notes "<release-notes>"
```

Report the GitHub release URL to the user.

## Error handling

- **`gh` not installed**: skip the GitHub release step, push the tag only, and tell the user the publish workflow will handle npm publishing via the tag
- **No `package.json`**: this skill assumes an npm project — if missing, ask the user how versioning works before proceeding
- **Push fails**: show the error and stop — do not force-push
