# Pull Request Troubleshooting Guide

## 🔍 Debugging PR Creation Issues

When pull request creation fails, follow these steps to diagnose and fix the issue.

---

## Step 1: Check Browser Console

Open the browser console (F12 → Console tab) and look for logs when creating a PR:

### What to Look For:

```
Parsing remote URL: <your-url>
Detected GitHub HTTPS: { owner: '...', repo: '...' }
Creating PR for: { owner, repo, platform, apiUrl }
Found credentials: Yes/No
Creating github PR...
GitHub PR URL: https://api.github.com/repos/...
```

### Common Console Messages:

**✅ Good:**
```
Detected GitHub HTTPS: { owner: 'user', repo: 'myrepo' }
Found credentials: Yes
GitHub response status: 201
GitHub PR created: https://github.com/user/myrepo/pull/123
```

**❌ Problem: Wrong Platform:**
```
Detected GitLab HTTPS: { owner: 'user', repo: 'myrepo' }
Failed to get GitLab project: 401
```
→ **Fix:** Your GitHub URL is being detected as GitLab. Check URL format.

**❌ Problem: No Credentials:**
```
Found credentials: No
Error: No credentials found for GitHub
```
→ **Fix:** Add GitHub credentials in Settings → Git

**❌ Problem: Bad Credentials:**
```
GitHub response status: 401
GitHub API error: Bad credentials
```
→ **Fix:** Your token is invalid or expired

---

## Step 2: Verify Remote URL

### Check Your Remote URL

1. Open Repository dialog
2. Look at "Git URL" field
3. Verify format matches one of these:

**GitHub (HTTPS):**
```
https://github.com/username/repository.git
https://github.com/username/repository
```

**GitHub (SSH):**
```
git@github.com:username/repository.git
```

**GitLab (HTTPS):**
```
https://gitlab.com/username/repository.git
https://gitlab.com/username/repository
```

**GitLab (SSH):**
```
git@gitlab.com:username/repository.git
```

### Common URL Issues:

❌ **Missing protocol:**
```
github.com/user/repo
```
→ Should be: `https://github.com/user/repo.git`

❌ **Wrong format:**
```
https://github.com:user/repo.git
```
→ Should be: `https://github.com/user/repo.git` (slash not colon)

❌ **Extra path components:**
```
https://github.com/user/repo/tree/main
```
→ Should be: `https://github.com/user/repo.git`

---

## Step 3: Check Credentials

### Verify Credentials Exist

1. Go to Settings → Git
2. Check "Git Credentials" section
3. Find entry matching your repository host

### GitHub Credentials

**Required Format:**
- **URL Pattern:** `github.com` or `https://github.com`
- **Token Type:** Personal Access Token (classic)

**How to Create GitHub Token:**
1. Go to GitHub.com → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. Select scopes:
   - ✅ `repo` (full repository access)
5. Copy token
6. Add to Shakespeare: Settings → Git → Add Credential

**Token Format:**
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### GitLab Credentials

**Required Format:**
- **URL Pattern:** `gitlab.com` or `https://gitlab.com`
- **Token Type:** Personal Access Token

**How to Create GitLab Token:**
1. Go to GitLab.com → Settings → Access Tokens
2. Add new token
3. Select scopes:
   - ✅ `api` (full API access)
   - ✅ `write_repository`
4. Create token
5. Copy token
6. Add to Shakespeare: Settings → Git → Add Credential

**Token Format:**
```
glpat-xxxxxxxxxxxxxxxxxxxx
```

---

## Step 4: Test Credential Matching

The credential matcher looks for:

1. **Exact domain match:** `github.com` matches `https://github.com/user/repo.git`
2. **Full URL match:** `https://github.com` matches `https://github.com/user/repo.git`

### Debug Credential Matching:

Check console for:
```
Remote URL: https://github.com/user/repo.git
Found credentials: Yes
```

If "Found credentials: No":
- Add credential with URL pattern: `github.com`
- Or use full URL: `https://github.com`

---

## Step 5: Common Error Messages

### "Failed to create pull request | Failed to get GitLab Project: 401"

**Cause:** GitHub URL detected as GitLab, or bad GitLab credentials

**Fix:**
1. Check console: What platform was detected?
2. If detected as GitLab but should be GitHub:
   - Verify URL format: `https://github.com/user/repo.git`
   - No typos in domain name
3. If correctly detected as GitLab:
   - Check GitLab token validity
   - Verify token has `api` scope

### "No credentials found for GitHub"

**Cause:** No matching credential in settings

**Fix:**
1. Go to Settings → Git
2. Add credential:
   - URL: `github.com`
   - Token: Your GitHub personal access token
3. Try PR creation again

### "GitHub API error: Bad credentials"

**Cause:** Invalid or expired token

**Fix:**
1. Generate new GitHub token
2. Update credential in Settings → Git
3. Try again

### "GitHub API error: 404 Not Found"

**Cause:** Repository doesn't exist or token doesn't have access

**Fix:**
1. Verify repository exists: `https://github.com/owner/repo`
2. Check token has access to this repository
3. Verify owner/repo names are correct

### "Validation Failed"

**Cause:** PR already exists or branch names invalid

**Fix:**
1. Check if PR already exists for this branch
2. Verify source and target branches exist
3. Ensure branches are different

---

## Step 6: Manual API Test

Test your credentials directly:

### GitHub Test:

```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO
```

**Expected:** Repository JSON data  
**If 401:** Token is invalid  
**If 404:** Repository not found or no access

### GitLab Test:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://gitlab.com/api/v4/projects/OWNER%2FREPO
```

**Expected:** Project JSON data  
**If 401:** Token is invalid  
**If 404:** Project not found or no access

---

## Best Practices

### ✅ Do This:

1. **Use HTTPS URLs** - More compatible than SSH in browser
2. **Include .git suffix** - Clearer repo identification
3. **Test credentials first** - Use API test before PR creation
4. **Check token scopes** - Ensure proper permissions
5. **Keep tokens secure** - Don't share or commit them

### ❌ Avoid This:

1. **SSH URLs in browser** - May not work consistently
2. **Expired tokens** - Regenerate regularly
3. **Minimal scopes** - Ensure `repo`/`api` access
4. **Wrong platform** - Don't use GitHub token for GitLab
5. **Typos in URLs** - Double-check owner/repo names

---

## Quick Checklist

Before creating a PR, verify:

- [ ] Remote URL is correct format
- [ ] Platform detected correctly (check console)
- [ ] Credentials exist in Settings → Git
- [ ] Token is valid and not expired
- [ ] Token has correct scopes (`repo` for GitHub, `api` for GitLab)
- [ ] Source and target branches exist
- [ ] No existing PR for these branches
- [ ] Branch has been pushed to remote

---

## Still Having Issues?

1. **Clear browser cache** - Sometimes helps with stale data
2. **Try different browser** - Rule out browser-specific issues
3. **Check GitHub/GitLab status** - Verify services are operational
4. **Regenerate token** - Create fresh token with correct scopes
5. **Test in terminal** - Verify Git operations work outside Shakespeare

---

## Getting Help

When asking for help, provide:

1. **Console output** - Copy relevant logs
2. **Remote URL** - Sanitize personal info first
3. **Platform** - GitHub or GitLab
4. **Error message** - Exact error text
5. **Token scopes** - What permissions are granted
6. **Browser** - Chrome, Firefox, Safari, etc.

---

*Last Updated: October 14, 2025*  
*Version: 1.0*
