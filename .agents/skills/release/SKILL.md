---
name: release
description: Publish a new app release with versioning, changelog, and git tagging. Triggered by "publish a new release" or similar requests.
---

# Release Skill

This skill guides you through publishing a new release of the app. It handles version bumping, changelog generation, and git tagging/pushing.

## Overview

- **Version format**: Marketing version (X.Y.Z), starting from 9.9.1. **This is NOT semver.** Version numbers are chosen based on how the release looks to end users, not based on API compatibility or breaking changes. Think of it like an app store version -- the number reflects the perceived significance of the update to a regular user.
- **Version source of truth**: `package.json` `version` field
- **Changelog**: `CHANGELOG.md` in repo root, using [Keep a Changelog](https://keepachangelog.com/) format
- **Version bumping**:
  - **Patch (Z)**: Most releases. Bug fixes, tweaks, internal improvements, anything a user wouldn't specifically notice or seek out.
  - **Minor (Y)**: Releases with headline features -- things worth announcing. A user should be able to look at the minor bump and think "oh, something new happened."
  - **Major (X)**: Only when the user explicitly requests it (milestones, rebrands, major redesigns)
- **CI**: No CI job runs on version tags. ngit-ci (`.ngit/act/workflows/`) only tests every push and deploys the nsite from `main`. The Android APK/AAB build and the Zapstore publish lived in the old GitLab pipeline and have not been ported (last Zapstore release: 9.16.2).

## Release Procedure

Follow these steps in order. Do NOT skip any step.

### Step 1: Required Reading

Before writing any release notes, you MUST read these pages to understand the product context, voice, and values:

1. **https://soapbox.pub/** -- Soapbox company overview and product suite
2. **https://soapbox.pub/shakespeare/** -- Shakespeare product page

These pages define what Shakespeare is, how it's positioned, and the tone of voice to use. Changelog entries should reflect this identity: creative, empowering, user-focused, emphasizing building and self-expression. Avoid dry technical jargon -- write for people who use the app, not developers.

### Step 2: Pre-flight Checks

```bash
# Ensure working directory is clean
git status

# Ensure we're on main branch
git branch --show-current

# Run the full test suite
npm run test
```

- If the working directory has uncommitted changes, ask the user whether to commit them first or abort.
- If not on `main`, warn the user and ask whether to proceed.
- If tests fail, stop and fix the issues before continuing.

### Step 3: Determine What Changed

```bash
# Get the current version from package.json
node -p "require('./package.json').version"

# Get commits since the last version tag
git log v$(node -p "require('./package.json').version")..HEAD --oneline
```

- If there are no commits since the last tag, inform the user there is nothing to release and stop.
- Review the commit list to understand the scope of changes.

### Step 4: Decide the Version Bump

Analyze the commits from Step 3 and determine the appropriate bump level:

| Bump | When to use | Example |
|------|-------------|---------|
| **Patch** | Bug fixes, minor tweaks, dependency updates, small UI polish, internal tooling, developer-facing pages, CI/build changes, settings/admin screens | 9.9.0 -> 9.9.1 |
| **Minor** | Significant new product features that change how users interact with the app -- the kind of thing you'd highlight in an app store update or announce on social media (e.g., new template support, new AI features, new deployment options, major UI overhaul) | 9.9.1 -> 9.10.0 |
| **Major** | ONLY when the user explicitly instructs a major bump | 9.10.0 -> 10.0.0 |

**Default to patch** when in doubt. The bar for a minor bump is high -- ask yourself: "Would a regular user notice and care about this change?" If the answer is no, it's a patch. Internal pages (changelog, settings, about screens), infrastructure improvements, CI fixes, and developer tooling are always patch-level regardless of whether they technically add a new page or screen.

When bumping minor, reset patch to 0 (e.g., 9.9.3 -> 9.10.0).
When bumping major, reset minor and patch to 0 (e.g., 9.3.1 -> 10.0.0).

### Step 5: Write the Changelog Entry

Prepend a new section to `CHANGELOG.md` directly below the `# Changelog` heading.

**Format:**

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- Description of new features

### Changed
- Description of changes to existing features

### Fixed
- Description of bug fixes

### Removed
- Description of removed features
```

**Rules:**
- Only include categories that have entries (omit empty categories)
- Write **user-facing descriptions**, not raw commit messages
- Keep descriptions concise -- one line per change
- Group related commits into single entries where appropriate
- Use present tense ("Add dark mode toggle", not "Added dark mode toggle")
- Focus on what the user sees/experiences, not internal implementation details
- Use the current date in YYYY-MM-DD format
- **Collapse related work into one entry.** If a feature was added and then fixed/tweaked across multiple commits in the same release, present the finished result as a single "Added" entry. Never list something as "Added" and then also list fixes for that same thing -- the user sees the end product, not the development history.
- **Omit purely internal changes.** CI fixes, build pipeline tweaks, developer tooling, and infrastructure changes should be omitted from the changelog entirely unless they have a direct, visible impact on the user experience. The changelog is for users, not developers.
- **Compare the actual code between versions** to understand what really changed, rather than just reading commit messages. Commit messages may over- or under-represent the significance of changes.

### Step 6: Update Version in All Files

#### 6a. `package.json`

Update the `version` field:

```json
"version": "X.Y.Z"
```

### Step 7: Copy Changelog to Public Directory

The changelog is served at runtime by the app from the `public/` directory. After updating `CHANGELOG.md`, copy it:

```bash
cp CHANGELOG.md public/CHANGELOG.md
```

### Step 8: Pull Latest Changes

Before committing the release, pull the latest changes from the remote to ensure the release commit sits on top of the latest code. This **must** happen before committing and tagging.

```bash
git pull origin main
```

**CRITICAL**: Always use `git pull` (merge), NEVER `git pull --rebase`. Rebasing rewrites commit hashes, which would orphan any tag pointing to the original commit. Since version tags are often protected on the remote and cannot be deleted or updated, a broken tag cannot be easily fixed.

If there are merge conflicts with the pulled changes, resolve them before proceeding.

### Step 9: Commit the Release

```bash
git add package.json CHANGELOG.md public/CHANGELOG.md
git commit -m "release: vX.Y.Z"
```

### Step 10: Tag the Release

```bash
git tag vX.Y.Z
```

The tag format is `v` followed by the version with no suffix. Examples: `v9.9.0`, `v9.10.0`, `v10.0.0`.

### Step 11: Push

```bash
git push origin main vX.Y.Z
```

**CRITICAL**: Push only the specific tag being released. NEVER use `--tags` -- that pushes ALL local tags, including stale or deleted ones.

### Step 12: Confirm

After pushing, inform the user:
- The new version number
- A brief summary of what was released
- That CI will handle building and publishing the artifacts

## File Reference

| File | What to update | Notes |
|------|---------------|-------|
| `package.json` | `version` field | Source of truth for the version |
| `CHANGELOG.md` | Prepend new section | User-facing changelog |
| `public/CHANGELOG.md` | Copy from `CHANGELOG.md` | Served at runtime by the app |

## Troubleshooting

### "Nothing to release"
If `git log` shows no commits since the last tag, there genuinely is nothing to release.

### Tests fail
Fix the failing tests before proceeding. The release must not contain broken code.

### Wrong version bumped
If you tagged the wrong version and haven't pushed yet:
```bash
git tag -d vX.Y.Z          # delete the local tag
git reset --soft HEAD~1     # undo the commit but keep changes staged
```
Then redo steps 4-10 with the correct version.

### Already pushed a bad release
This requires manual intervention. Inform the user and suggest they delete the tag from the remote manually, then re-run the release process.
