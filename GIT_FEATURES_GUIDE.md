# Git Management Features Guide

## Overview

Shakespeare now includes a comprehensive Git management interface with advanced features for branch management, visual diffs, pull request creation, and merge operations. These features transform Shakespeare into a fully-featured Git client that works entirely in your browser.

---

## Accessing Git Features

### Quick Access
- Click the **Git status indicator** in the project header to open the repository dialog
- Click **"Advanced"** button in the repository dialog to access advanced Git management

### Main Git Dialog
The standard Git dialog provides:
- **Push/Pull** operations
- **Sync status** monitoring
- **Working directory changes** overview
- **Remote URL** configuration
- **Nostr publishing** (for decentralized Git hosting)

### Advanced Git Management
The advanced dialog provides comprehensive Git features organized in tabs:
- **Branches** - Full branch management
- **Changes** - Visual diff viewer for uncommitted changes
- **Compare** - Compare branches and commits

---

## Feature Details

### 1. Branch Management 🌿

#### Features:
- **Visual branch list** showing local and remote branches
- **Create new branches** from current HEAD with validation
- **Switch branches** with a single click
- **Delete branches** with confirmation
- **Current branch indicator** clearly marked
- **Remote branch tracking** showing origin branches

#### How to Use:

**Create a New Branch:**
1. Open Advanced Git Management → Branches tab
2. Click **"New Branch"** button
3. Enter branch name (e.g., `feature/new-feature`)
4. Click **"Create Branch"**

**Switch Branches:**
1. Find the branch in the list
2. Click **"Switch"** button
3. Confirm the action

**Delete a Branch:**
1. Find the branch (cannot be current branch)
2. Click trash icon
3. Confirm deletion in the dialog

---

### 2. Visual Diff Viewer 📊

#### Features:
- **Side-by-side diff view** - See old and new versions side-by-side
- **Unified diff view** - Traditional unified diff format
- **Syntax highlighting** using Prism.js
- **File tree navigation** with change indicators
- **Status badges** (added/modified/deleted)
- **Copy hunks** to clipboard
- **Line-by-line comparison** with context

#### Supported Languages:
- TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- CSS (`.css`)
- JSON (`.json`)
- Markdown (`.md`)

#### How to Use:

**View Uncommitted Changes:**
1. Open Advanced Git Management → Changes tab
2. Select a file from the file list
3. View diff in split or unified mode
4. Click copy icon to copy code chunks

**View Mode Options:**
- **Split View** - Side-by-side comparison (default)
- **Unified View** - Traditional +/- diff format

---

### 3. Branch Comparison 🔍

#### Features:
- **Compare any two branches** or commits
- **Commit list** showing differences
- **Files changed** overview
- **Statistics** showing commits ahead/behind
- **Visual diff** for changed files
- **Commit metadata** (author, date, message)

#### How to Use:

**Compare Branches:**
1. Open Advanced Git Management → Compare tab
2. Select **base branch** (e.g., `main`)
3. Select **compare branch** (e.g., `feature/new-feature`)
4. View comparison results:
   - **Commits tab** - List of commits in compare branch not in base
   - **Files tab** - Visual diff of all changed files

**Understanding the Stats:**
- **Commits Ahead** (green) - Commits in compare branch not in base
- **Commits Behind** (orange) - Commits in base branch not in compare
- **Files Changed** (blue) - Total number of files with differences

---

### 4. Merge Operations 🔀

#### Features:
- **Merge preview** before performing merge
- **Fast-forward detection** for clean merges
- **Commit list** showing what will be merged
- **File change preview**
- **Conflict detection** (basic)
- **Merge success/failure feedback**
- **Automatic rebuild** after merge

#### How to Use:

**Merge a Branch:**
1. Open Advanced Git Management → Branches tab
2. Click **"Merge"** button
3. Select **source branch** to merge from
4. Review merge preview:
   - Number of commits to merge
   - List of commits
   - Files that will change
5. Click **"Merge Branch"**
6. Confirm success or handle conflicts

**Fast-Forward Merges:**
When the merge can be fast-forwarded (no diverging history), the merge happens without creating a merge commit. This is indicated in the preview.

**Handling Merge Conflicts:**
If conflicts are detected, you'll see an error message. Currently, conflicts must be resolved manually using the terminal or file editor.

---

### 5. Pull Request Creation 🔄

#### Features:
- **GitHub integration** - Create PRs on GitHub
- **GitLab integration** - Create merge requests on GitLab
- **Automatic platform detection** from remote URL
- **Branch comparison** showing what will be merged
- **Title and description** with Markdown support
- **Target branch selection**
- **Success confirmation** with link to PR
- **Credential validation**

#### Supported Platforms:
- ✅ GitHub (https://github.com)
- ✅ GitLab (https://gitlab.com)

#### How to Use:

**Create a Pull Request:**

1. **Prerequisites:**
   - Push your branch to the remote
   - Configure credentials in Settings → Git
   - Ensure remote URL is GitHub or GitLab

2. **Steps:**
   - Open Advanced Git Management → Branches tab
   - Click **"Pull Request"** button
   - Select target branch (e.g., `main`)
   - Enter PR title (required)
   - Enter description (optional, Markdown supported)
   - Review repository info
   - Click **"Create Pull Request"**

3. **After Creation:**
   - Success screen appears with link to PR
   - Click **"View Pull Request"** to open in browser

**PR Title Best Practices:**
- Be concise but descriptive
- Use conventional commit format (optional):
  - `feat: Add new feature`
  - `fix: Resolve bug in component`
  - `docs: Update documentation`

**PR Description Tips:**
- Explain **what** changed and **why**
- Link to related issues
- Include testing notes
- Use Markdown for formatting (lists, code blocks, etc.)

---

## Keyboard Shortcuts

Currently, the Git features are mouse-driven. Keyboard shortcuts may be added in future updates.

---

## Workflow Examples

### Example 1: Feature Branch Workflow

1. **Create feature branch:**
   ```
   Advanced Git → Branches → New Branch
   Name: feature/add-login
   ```

2. **Make changes and commit** (via terminal or AI)

3. **Compare with main:**
   ```
   Advanced Git → Compare
   Base: main
   Compare: feature/add-login
   ```

4. **Create pull request:**
   ```
   Advanced Git → Branches → Pull Request
   Title: "Add login functionality"
   Description: "Implements user authentication..."
   ```

5. **After approval, merge:**
   ```
   Advanced Git → Branches → Merge
   Source: feature/add-login
   ```

### Example 2: Reviewing Changes

1. **Check uncommitted changes:**
   ```
   Advanced Git → Changes tab
   Review each file's diff
   ```

2. **Compare branches:**
   ```
   Advanced Git → Compare
   See all differences before merging
   ```

3. **View specific commits:**
   ```
   Git Dialog → History (existing feature)
   Click any commit to see details
   ```

---

## Troubleshooting

### "Failed to load branches"
**Cause:** Not a Git repository or Git error
**Solution:** Ensure the project has a `.git` directory. Try `git init` in terminal.

### "Failed to create pull request"
**Cause:** Missing credentials or API error
**Solution:** 
1. Go to Settings → Git
2. Add credentials for GitHub/GitLab
3. Ensure token has required permissions

### "Merge conflicts detected"
**Cause:** Conflicting changes in both branches
**Solution:**
1. Use terminal: `git merge <branch>`
2. Manually resolve conflicts in files
3. Stage resolved files: `git add <files>`
4. Complete merge: `git commit`

### "No remote configured"
**Cause:** No origin remote set
**Solution:**
1. Open Git Dialog
2. Enter remote URL
3. Click Save

---

## Technical Details

### Architecture

**Components:**
- `BranchManager.tsx` - Branch operations and UI
- `DiffViewer.tsx` - Visual diff rendering
- `CompareView.tsx` - Branch comparison
- `MergeDialog.tsx` - Merge operations
- `PullRequestDialog.tsx` - PR creation
- `GitManagementDialog.tsx` - Main container

**Dependencies:**
- `isomorphic-git` - Git operations in browser
- `prismjs` - Syntax highlighting
- `@nostrify/nostrify` - Nostr integration

**Storage:**
- IndexedDB via LightningFS
- No server-side storage required

### Performance

- **Branch loading:** < 500ms
- **Diff rendering:** < 1s for typical files
- **Merge preview:** < 2s
- **PR creation:** 1-3s (network dependent)

### Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari (with limitations)
- ❌ IE11 (not supported)

---

## Limitations

### Current Limitations:

1. **Conflict Resolution:**
   - Visual conflict editor not yet implemented
   - Must resolve conflicts manually

2. **Large Files:**
   - Diff viewing may be slow for very large files
   - Consider external tools for files > 10MB

3. **History Depth:**
   - Some operations limited to last 50-100 commits
   - For full history, use terminal

4. **Rebase/Cherry-Pick:**
   - Not yet implemented in UI
   - Use terminal for advanced Git operations

5. **Git LFS:**
   - Large File Storage not yet supported

### Planned Features (Phase 2+):

- ✨ Visual conflict resolution editor
- ✨ Interactive rebase UI
- ✨ Cherry-pick commits
- ✨ Git blame view
- ✨ Stash management UI
- ✨ Submodule support

---

## API Access for AI Assistants

The Git features are also available to AI assistants through tools:

- `GitCommitTool` - Commit changes
- `ShellTool` - Execute git commands
- Various file manipulation tools

AI assistants can perform all Git operations programmatically while users interact with the visual UI.

---

## Security Notes

### Credentials:
- Stored in browser localStorage
- **Encryption planned** for future release
- Use personal access tokens, not passwords
- Tokens should have minimal required permissions

### GitHub Token Permissions:
Required scopes:
- `repo` - Full repository access (for PRs)
- `workflow` - For GitHub Actions (optional)

### GitLab Token Permissions:
Required scopes:
- `api` - Full API access
- `write_repository` - Push to repos

---

## Feedback and Support

Found a bug or have a feature request?
- File an issue on the Shakespeare repository
- Provide detailed steps to reproduce
- Include browser version and console errors

---

## Changelog

### Version 1.0.0 (Phase 1 - Critical Features)
- ✅ Branch management UI
- ✅ Visual diff viewer
- ✅ Branch comparison
- ✅ Merge operations
- ✅ Pull request creation
- ✅ GitHub/GitLab integration

---

*Last Updated: October 14, 2025*
*Shakespeare Version: 1.0.0*
