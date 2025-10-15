# Contributing to Upstream Projects

Shakespeare's Git management system now supports contributing to upstream open source projects through automatic forking, even if you don't have push access to the repository.

## How It Works

When you try to create a pull request to a repository where you don't have push permissions, Shakespeare automatically:

1. **Detects your permissions** via the Git host API (GitHub/GitLab)
2. **Checks for an existing fork** under your account
3. **Creates a fork** if one doesn't exist
4. **Configures the PR** to use your fork as the source
5. **Creates the pull request** from `your-fork:branch` → `upstream:main`

This all happens transparently - you just fill out the PR form and click create.

## User Experience

### For Repository Owners (Have Push Access)

If you have push access to the repository:
- Create branches normally
- Push changes directly
- Create PRs within the same repository
- Standard workflow - nothing changes

### For Contributors (No Push Access)

If you don't have push access:
- Make your changes (on any branch, even main/master)
- Open Git Management → Pull Request tab
- Fill out title/description
- Click "Fork & Create PR"
- Shakespeare automatically:
  - Creates a feature branch (if you're on main/master)
  - Forks the repo (if needed)
  - Pushes your branch
  - Creates the PR

You'll see a message like:
> "You don't have push access to this repository. Your changes will be pushed to your fork at **username/repo** and a pull request will be created from there."

## Step-by-Step Guide

### 1. Clone an Upstream Repository

```bash
# Clone any open source project in Shakespeare
git clone https://github.com/upstream-org/project.git
```

### 2. Make Your Changes

- Edit files in Shakespeare
- Use AI assistance or manual code editing
- Test your changes

### 3. Commit Your Changes (Optional)

> **Note:** You can skip this step! If you're on the main/master branch, a feature branch will be created automatically when you create the PR.

If you want to create a branch manually:

- Open Git Management → "Branches" tab
- Click "Create Branch"
- Name it something descriptive (e.g., `fix-typo`)

### 4. Create Pull Request

- Go to "Pull Request" tab
- Select target branch (usually `main` or `master`)
- Enter PR title and description
- If you're on main/master: You'll see "A feature branch will be automatically created from your PR title"
- Click "Fork & Create PR" (or just "Create Pull Request" if you have access)

### 5. Done!

- Your fork is created automatically
- Changes are pushed to your fork
- PR is opened from fork to upstream
- You get a link to view the PR

## Automatic Feature Branch Creation

### Why?

Most users will make changes directly on the `main` or `master` branch without realizing they should create a feature branch first. To make contributing easier, Shakespeare automatically creates a feature branch for you when needed.

### When Does This Happen?

When you create a PR and you're currently on `main` or `master`, the system:

1. **Generates a branch name** from your PR title
   - Converts to lowercase
   - Replaces spaces with hyphens
   - Removes special characters
   - Adds a unique suffix (timestamp-based)

2. **Creates the branch** from your current position

3. **Checks it out** automatically

4. **Continues with PR creation** on the new branch

### Example

**Your PR title:** "Fix login button styling"

**Generated branch:** `fix-login-button-styling-k7m2`

**What happens:**
```
Before: You're on 'main' with uncommitted changes
After:  You're on 'fix-login-button-styling-k7m2' with the same changes
Result: PR created from the feature branch → upstream/main
```

### UI Indicators

You'll see these messages when on main/master:

**Alert Box:**
> You're on the **main** branch. A feature branch will be automatically created from your PR title for this contribution.

**Branch Comparison:**
```
upstream/repo:main ← main
Note: A new branch will be created automatically
```

**Toast Notification:**
> Feature branch created
> Created branch 'fix-login-button-styling-k7m2' for your changes

### What If You Want to Use Your Own Branch?

Simple! Just create a branch manually first:

1. Git Management → Branches tab
2. Click "Create Branch"
3. Name it whatever you want
4. Now create your PR - no auto-branch will be created

### Benefits

- **No Git knowledge needed** - Users don't need to understand branching
- **Best practices enforced** - Never commit directly to main
- **Clean history** - Each PR gets its own branch
- **Easy to understand** - Branch names match PR titles
- **Safe** - Your main branch stays clean

## Behind the Scenes

### Permission Detection

```typescript
// Checks via API if user can push
const canPush = await checkPushPermissions(repo, token);

if (!canPush) {
  // Fork workflow
  const fork = await ensureFork(repo, token);
  // Use fork_owner:branch as head ref
}
```

### Fork Management

- **Checks existing forks first** - doesn't create duplicates
- **Waits for fork to be ready** - GitHub/GitLab need time to fork
- **Configures head ref properly** - `username:branch` format for cross-repo PRs

### API Calls

**GitHub:**
- `GET /repos/{owner}/{repo}` - Check permissions
- `GET /repos/{username}/{repo}` - Check if fork exists
- `POST /repos/{owner}/{repo}/forks` - Create fork
- `POST /repos/{owner}/{repo}/pulls` - Create PR with cross-fork head

**GitLab:**
- `GET /projects/{id}` - Check permissions (access_level >= 30)
- `GET /projects/{username}/{repo}` - Check if fork exists
- `POST /projects/{id}/fork` - Create fork
- `POST /projects/{id}/merge_requests` - Create MR

## Supported Platforms

| Platform | Fork Detection | Fork Creation | Cross-Fork PR | Status |
|----------|---------------|---------------|---------------|--------|
| GitHub   | ✅            | ✅            | ✅            | Full   |
| GitLab   | ✅            | ✅            | ✅            | Full   |
| Codeberg | ✅            | ✅            | ✅            | Full   |
| Gitea    | ✅            | ✅            | ✅            | Full   |

## UI Indicators

The system provides clear visual feedback:

### Permission Check
```
⏳ Checking repository permissions...
```

### Fork Notice
```
ℹ️ You don't have push access to this repository.
   Your changes will be pushed to your fork at username/repo
   and a pull request will be created from there.
```

### Branch Comparison
Shows the full fork relationship:
```
upstream/repo:main ← username/repo:feature-branch
```

### Create Button
Changes based on permissions:
- **Direct access**: "Create Pull Request" with PR icon
- **Fork needed**: "Fork & Create PR" with fork icon

## Authentication

Uses existing Shakespeare Git credentials:

1. **GitHub OAuth** - One-click authentication (Settings → Git)
2. **Personal Access Tokens** - Manual token entry for any platform

Required token scopes:
- **GitHub**: `public_repo` (for public repositories)
- **GitLab**: `api` or `write_repository`

Tokens are stored locally in browser IndexedDB and never sent to Shakespeare servers.

## Troubleshooting

### "No credentials found"
- Add your Git credentials in Settings → Git
- Make sure the token has the right scopes
- Verify the token hasn't expired

### "Failed to create fork"
- Check if you already have a fork (only one fork per user)
- Ensure your token has fork permissions
- Some organizations disable forking - check repo settings

### "Permission denied"
- Your token may have expired or been revoked
- Re-authenticate in Settings → Git
- Check token scopes include repository write access

### Fork exists but PR fails
- Make sure your fork is up to date
- Try pushing your branch manually first
- Check if the branch name conflicts with upstream

## Example Workflow

Contributing a bug fix to an open source project (the easy way):

1. **Clone**: Clone `facebook/react` in Shakespeare
2. **Edit**: Make your fixes (don't worry about branches!)
3. **PR Tab**: Open Git Management → Pull Request
4. **Fill form**:
   - Title: "Fix useEffect memory leak in concurrent mode"
   - Description: Detailed explanation of the bug and fix
   - Target: `main`
5. **Submit**: Click "Fork & Create PR"
6. **Automatic magic**:
   - Creates branch: `fix-useeffect-memory-leak-in-concurrent-mode-x7k2`
   - Checks out the new branch
   - Forks to `yourusername/react`
   - Pushes branch to your fork
   - Creates PR: `facebook/react:main` ← `yourusername:react:fix-useeffect-memory-leak-in-concurrent-mode-x7k2`

**Total steps for you:** 3 (clone, edit, submit)
**Total steps Shakespeare handles:** 6 (branch, fork, push, configure remotes, create PR)

## Integration with Existing Features

This fork workflow integrates seamlessly with existing Git features:

- **Branch Management** - Create/switch/delete branches as usual
- **Diff Viewer** - Review changes before creating PR
- **Compare View** - Compare branches and commits
- **Git Credentials** - Uses existing auth system
- **Remote Management** - Works with origin/upstream remotes

No new settings or configuration needed - it just works when you try to contribute to repos where you don't have push access.

## Privacy & Security

- **No server involvement** - All Git operations happen in your browser
- **Local token storage** - Tokens stored in IndexedDB, never sent to Shakespeare
- **Minimal API calls** - Only checks permissions when needed
- **Read-only checks** - Permission detection doesn't modify anything
- **User confirmation** - Always shows what will happen before forking

## Future Enhancements

Potential improvements:
- Conflict resolution UI when upstream has changed
- Sync fork with upstream (rebase/merge)
- Multi-commit PRs with better history
- Draft PR support
- PR templates
- Reviewer/assignee selection
