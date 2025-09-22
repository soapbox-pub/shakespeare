# OPFS Debugging Instructions

## Current Issue
Project creation fails with OPFS due to isomorphic-git compatibility issues.

## Debug Steps

1. **Enable OPFS in browser**:
   - Go to Shakespeare app
   - Settings → Data Settings → Filesystem Type → OPFS
   - Save and refresh

2. **Try to create a project**:
   - Enter a description like "test project"
   - Select a model
   - Click "Create Project"

3. **Check browser console**:
   - Open DevTools (F12)
   - Look for debug logs starting with `OPFSAdapter.readFile called with path:`
   - Look for `OPFSAdapter.mkdir called with path:`
   - Look for `OPFSAdapter.stat called with path:`

## Expected Debug Output

If our fixes work, you should see logs like:
```
OPFSAdapter.readFile called with path: /projects/test-project/.git/config encoding: utf8
OPFSAdapter.stat called with path: /projects/test-project
OPFSAdapter.mkdir called with path: /projects/test-project options: { recursive: true }
```

## Current Problems

1. **Undefined paths**: isomorphic-git calls our adapter with `undefined` paths
2. **Git config parsing**: "text.split is not a function" error suggests Git is trying to parse error messages as config files
3. **Directory creation**: Git directory structure creation fails

## Next Steps

Based on what we see in debug logs, we can:
1. Identify exactly which paths are being called as undefined
2. Fix the specific filesystem contract issues
3. Ensure proper error handling that doesn't break Git operations