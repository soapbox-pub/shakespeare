# Contributing to Open Source Projects from Shakespeare

Shakespeare now includes a complete contribution workflow that allows anyone to propose changes to open source projects without needing to understand Git, forks, or pull requests.

## Overview

The contribution system handles the entire process of submitting changes to upstream repositories:

1. **Authentication** - Connect to GitHub, GitLab, or Gitea/Codeberg
2. **Review Changes** - See what files you've modified
3. **Branch & Commit** - Describe your changes
4. **Validation** - Automatic build and type checks
5. **Fork & Push** - Automatic forking and pushing (if needed)
6. **Pull Request** - Create or update PRs with one click

## For Users: How to Contribute

### Step 1: Make Your Changes

Edit any project in Shakespeare that was cloned from a Git repository. Make your changes using the AI assistant or code editor.

### Step 2: Click "Propose Changes"

When you're ready to submit your changes:

1. Look for the **"Propose Changes"** button in the project header
2. Click it to open the contribution wizard
3. The system will detect which Git host you're using (GitHub, GitLab, etc.)

### Step 3: Connect Your Account

**Option A: Quick Connect (GitHub only)**
- Click "Connect with GitHub"
- Authorize Shakespeare to access your GitHub account
- You'll be redirected back automatically

**Option B: Personal Access Token**
- Click the link to create a token on the Git host
- Follow the instructions to generate a token with the right permissions
- Paste the token into Shakespeare
- Click "Connect"

Required permissions:
- **GitHub**: `public_repo` scope
- **GitLab**: `api` or `write_repository` scope
- **Codeberg/Gitea**: `repo` permission

### Step 4: Review Your Changes

The wizard shows you all files that have been:
- ✅ Added (new files)
- ✏️ Modified (changed files)
- ❌ Deleted (removed files)

Review the list and click "Continue" when ready.

### Step 5: Describe Your Changes

Fill in the contribution details:

- **Branch Name**: A unique name for your changes (e.g., `fix-typo` or `add-feature`)
- **Commit Message**: Brief description of what you changed
- **PR Title**: Clear summary of your contribution
- **Description**: Detailed explanation of the changes and why they're needed
- **Allow maintainers to edit**: ✓ Recommended (lets project maintainers make small adjustments)

Click "Run Checks" to continue.

### Step 6: Validation

Shakespeare automatically:
- ✅ Type checks your code
- ✅ Builds the project
- ✅ Ensures everything compiles

If checks fail, you'll see specific errors to fix.

### Step 7: Submit

Click "Submit Pull Request" and Shakespeare will:

1. **Check permissions** - See if you can push directly to the repo
2. **Create a fork** (if needed) - Automatically fork the repository to your account
3. **Create a branch** - Make a new branch with your chosen name
4. **Commit changes** - Save all your changes with your commit message
5. **Push to your fork** - Upload the changes to GitHub/GitLab/etc.
6. **Open a pull request** - Create a PR from your fork to the upstream repository

You'll see a success message with a link to your pull request!

### Updating an Existing PR

If you're on a branch that already has an open PR:

1. Make additional changes
2. The **"Update PR"** option will appear
3. Click it to push new commits to the existing PR
4. The PR is automatically updated with your latest changes

## For Developers: Architecture

### Git Host Abstraction

The system uses a provider pattern to support multiple Git hosting platforms:

```typescript
// lib/git-hosts/types.ts
interface GitHostProvider {
  getRepository(owner: string, repo: string): Promise<GitRepository>;
  canUserPush(owner: string, repo: string): Promise<boolean>;
  createFork(owner: string, repo: string): Promise<GitFork>;
  getFork(upstreamOwner: string, upstreamRepo: string, username: string): Promise<GitFork | null>;
  createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest>;
  // ... and more
}
```

Implemented providers:
- `GitHubProvider` - GitHub REST API v3
- `GitLabProvider` - GitLab REST API v4
- `GiteaProvider` - Gitea/Forgejo/Codeberg API v1

### Component Structure

**ContributeButton** (`components/contribute/ContributeButton.tsx`)
- Detects if contribution is available for the current project
- Opens the ContributeWizard when clicked

**ContributeWizard** (`components/contribute/ContributeWizard.tsx`)
- Multi-step wizard component
- Handles the entire contribution flow
- Progress bar shows current step
- Error handling and validation

**AuthStep** (`components/contribute/AuthStep.tsx`)
- Authentication with Git hosts
- Supports OAuth (GitHub) and Personal Access Tokens
- Clear instructions for token generation

**DiffView** (`components/contribute/DiffView.tsx`)
- Shows all changed files
- Color-coded by change type (added/modified/deleted)
- File statistics

**PRStatusBadge** (`components/contribute/PRStatusBadge.tsx`)
- Shows existing PR status for current branch
- Displays PR state (open/merged/closed)
- Shows CI check status
- Links to the PR on the Git host

### Hook: useContribute

The main hook that orchestrates the contribution process:

```typescript
const {
  needsAuth,      // Check if user needs to authenticate
  authenticate,   // Add authentication token
  contribute,     // Execute full contribution workflow
  updatePR,       // Push new commits to existing PR
  isLoading,      // Loading state
  error,          // Error message
  step,           // Current workflow step
  pr,             // Created/updated pull request
} = useContribute();
```

### Token Storage

Tokens are stored in two places for compatibility:

1. **Git Credentials** (`settings.credentials`) - For Git push/pull operations
2. **Host Tokens** (`settings.hostTokens`) - For API operations (fork, PR creation, etc.)

```typescript
// GitSettingsContext
interface GitSettings {
  credentials: Record<string, GitCredential>; // For Git auth
  hostTokens: Record<string, GitHostToken>;   // For API auth
  // ...
}
```

### Remote Configuration

The system automatically manages Git remotes:

**Before Forking:**
```
origin  -> https://github.com/original/repo.git
```

**After Forking:**
```
upstream -> https://github.com/original/repo.git  (read-only)
origin   -> https://github.com/yourname/repo.git   (your fork)
```

This allows users to:
- Pull updates from upstream
- Push changes to their fork
- Keep their fork in sync

### Security

- **Tokens stored locally**: All authentication tokens are stored in browser IndexedDB, never sent to Shakespeare servers
- **Minimal scopes**: Instructions guide users to grant only necessary permissions
- **PKCE for OAuth**: GitHub OAuth uses PKCE (Proof Key for Code Exchange) for enhanced security
- **Token revocation**: Users can remove tokens anytime from Git settings

### API Rate Limiting

The system handles rate limiting gracefully:
- Caches Git host API responses where possible
- Shows clear error messages when rate limited
- Provides fallback to manual PR creation via compare URLs

## Supported Git Hosts

### GitHub
- ✅ OAuth login (PKCE)
- ✅ Personal Access Token
- ✅ Fork creation
- ✅ Pull request creation
- ✅ PR status and checks
- ✅ PR updates

### GitLab
- ✅ Personal Access Token
- ✅ Fork creation (project forking)
- ✅ Merge request creation
- ✅ MR status and pipeline checks
- ✅ MR updates

### Gitea/Forgejo/Codeberg
- ✅ Personal Access Token
- ✅ Fork creation
- ✅ Pull request creation
- ✅ PR status
- ✅ PR updates

### Self-Hosted Git
For self-hosted Gitea/Forgejo instances:
- API URL is auto-detected from repository URL
- Uses same token authentication
- Full PR workflow support

## Extending the System

### Adding a New Git Host

1. Create a new provider in `lib/git-hosts/`:

```typescript
export class NewHostProvider implements GitHostProvider {
  readonly name = 'NewHost';
  readonly apiBaseUrl = 'https://api.newhost.com';
  
  // Implement all GitHostProvider methods
  // ...
}
```

2. Add detection logic in `lib/git-hosts/types.ts`:

```typescript
export function detectGitHost(url: string): HostType {
  // ... existing logic
  if (hostname.includes('newhost.com')) return 'newhost';
  // ...
}
```

3. Update factory in `lib/git-hosts/index.ts`:

```typescript
export function createGitHostProvider(url: string, config: GitHostConfig) {
  // ... existing cases
  case 'newhost':
    return new NewHostProvider(config, corsProxy);
  // ...
}
```

### Customizing the Workflow

The `ContributeWizard` component is designed to be extensible:

- Add new validation steps in `handleBranchNext()`
- Add custom checks in the "checks" step
- Modify the UI for specific use cases
- Add custom metadata to PRs

### Error Handling

The system provides fallbacks at every step:

1. **No API access** → Manual token entry
2. **Fork fails** → Direct push if user has permissions
3. **Rate limited** → Show compare URL for manual PR creation
4. **Build fails** → Show specific error, allow override with warning

## Troubleshooting

### "Not authenticated with github.com"

**Solution**: Connect your GitHub account:
1. Click "Propose Changes"
2. Follow the OAuth or token flow
3. Your token is saved for future contributions

### "Build failed. Please fix errors before submitting."

**Solution**: Fix the TypeScript/build errors:
1. Check the error message in the wizard
2. Fix the issues in your code
3. Click "Run Checks" again

### "Timeout waiting for fork to be created"

**Solution**: The Git host is slow to create your fork:
1. Wait a moment and try again
2. Check if the fork exists on the Git host website
3. If it exists, the next attempt should succeed

### "Failed to push"

**Solution**: Check your permissions:
1. Verify your token has write access
2. Make sure the token hasn't expired
3. Try disconnecting and reconnecting your account

### "No remote repository found"

**Solution**: This project isn't connected to Git:
1. Clone a project from GitHub/GitLab
2. Or initialize the project with a Git remote
3. Then you can propose changes

## Privacy & Data

- **Local storage only**: All tokens and settings are stored in your browser's IndexedDB
- **No tracking**: Shakespeare doesn't track your contributions or activity
- **No server storage**: Your code and tokens never touch Shakespeare servers
- **Revocable**: Delete tokens anytime from Settings → Git

## Future Enhancements

Planned features:
- [ ] Draft PRs
- [ ] PR templates
- [ ] Custom branch naming patterns
- [ ] Conflict resolution UI
- [ ] Multi-commit PRs
- [ ] Review request suggestions
- [ ] Automated changelog generation
- [ ] Integration with CI/CD status
