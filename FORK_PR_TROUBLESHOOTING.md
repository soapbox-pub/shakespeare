# Fork PR Workflow - Troubleshooting Guide

## Common Issues and Solutions

### "Validation Failed" Error

This error from GitHub usually means the PR can't be created. The system now shows detailed reasons:

**Common causes:**

1. **Branch doesn't exist in fork**
   - **Solution**: The system now automatically pushes your branch to the fork before creating the PR
   - If it still fails, try manually: Git Management → Branches → Push to remote

2. **No commits on the branch**
   - **Error**: "head: No commits between..."
   - **Solution**: Make sure you've committed your changes before creating a PR
   - Go to Git Management → Changes → Commit your work

3. **PR already exists**
   - **Error**: "A pull request already exists for..."
   - **Solution**: Check the upstream repository - you might already have an open PR from this branch
   - Update the existing PR instead of creating a new one

4. **Invalid branch name**
   - **Error**: "Reference does not exist"
   - **Solution**: Make sure your branch name doesn't have special characters
   - Use alphanumeric characters, hyphens, and underscores only

### "Failed to push branch to your fork"

**Causes:**

1. **Branch not committed**
   ```
   Error: Failed to push branch 'my-branch' to your fork.
   
   This usually means:
   1. The branch hasn't been committed yet
   2. Network/authentication issues
   ```
   
   **Solution**: 
   - Go to Git Management → Changes tab
   - Review your changes
   - Commit them before creating a PR

2. **Authentication issues**
   - **Solution**: Check Settings → Git → Make sure your GitHub token is valid
   - Token must have `public_repo` scope
   - Try re-authenticating if the token expired

3. **Network/CORS issues**
   - **Solution**: Check your internet connection
   - Some networks block Git operations
   - Try again or use a different network

### Fork Workflow Steps

When you create a PR and don't have push access, the system:

1. **Detects you need a fork**
   - Shows: "You don't have push access to this repository"
   - Explains: "Your changes will be pushed to your fork at username/repo"

2. **Checks for existing fork**
   - If found: Uses it
   - If not found: Creates a new fork
   - Waits for fork to be ready (GitHub takes a few seconds)

3. **Sets up remotes**
   - Checks if 'origin' points to your fork
   - If not, adds a 'fork' remote
   - Determines which remote to use for pushing

4. **Pushes your branch**
   - Pushes current branch to fork
   - Uses your GitHub credentials
   - Shows detailed error if push fails

5. **Creates PR**
   - Uses format: `yourname:branch` → `upstream:main`
   - Enables "maintainer can modify" by default
   - Returns PR URL on success

### Error Message Improvements

The system now shows much more detailed errors:

**Before:**
```
Error: Validation Failed
```

**After:**
```
Validation Failed

Details: head: No commits between master and yourname:test-branch

See: https://docs.github.com/rest/pulls/pulls#create-a-pull-request
```

**With field errors:**
```
Validation Failed

Details: base: Does not exist; 
head: Must be formatted as 'owner:branch'

See: https://docs.github.com/rest/pulls/pulls#create-a-pull-request
```

### Debug Checklist

Before creating a PR, verify:

- [ ] You've made changes to files
- [ ] Changes are committed (check Git Management → Changes)
- [ ] You're on the correct branch
- [ ] Branch has a valid name (no spaces or special chars)
- [ ] You have valid GitHub credentials (Settings → Git)
- [ ] Your token has `public_repo` scope
- [ ] The upstream repository allows forks
- [ ] The target branch exists in upstream (usually `main` or `master`)

### Manual Override

If the automatic workflow fails, you can:

1. **Fork manually** on GitHub.com
2. **Add fork as remote**:
   - Git Management → (manually configure remotes if needed)
3. **Push branch** to fork:
   - Use the existing "Create Pull Request" button
   - Or push via command line
4. **Create PR** on GitHub.com directly

### Understanding Remotes

After forking, your remotes should look like:

```
origin   → git@github.com:yourname/repo.git (your fork)
upstream → git@github.com:original/repo.git (original repo)
```

Or if system adds a fork remote:

```
origin → git@github.com:original/repo.git (original)
fork   → git@github.com:yourname/repo.git (your fork)
```

Both configurations work - the system detects which to use.

### Still Having Issues?

Check the browser console (F12 → Console) for detailed logs:

- `Detected GitHub SSH/HTTPS:` - Shows parsed repository info
- `Pushing branch X to fork Y` - Shows push operation
- `GitHub response status:` - Shows API response codes
- `GitHub API error response:` - Shows full error from GitHub

These logs will show exactly what's happening and where it's failing.

### GitHub API Rate Limits

If you see:

```
Error: API rate limit exceeded
```

**Solution:**
- Wait an hour (unauthenticated limit: 60 requests/hour)
- Or authenticate with a token (limit: 5000 requests/hour)
- Check Settings → Git to ensure token is configured

### Fork Already Exists

If you see:

```
Error: fork already exists for this repository
```

**This is normal!** The system will use your existing fork. The error is just informational.

### Repository Owner Can't Fork

If you own the repository, you can't fork it. You don't need to - you have push access!

The system should detect this and skip the fork workflow. If you see this error, please report it.

## Getting Help

If you encounter an error not covered here:

1. Check the full error message (now includes details)
2. Look at browser console logs
3. Verify your setup (credentials, branch, commits)
4. Try the manual workflow as a workaround
5. Report the issue with:
   - Full error message
   - Console logs
   - Repository URL (if public)
   - Branch name
