# OPFS Git Compatibility Test

## Issue Fixed

The main issue was that isomorphic-git was calling `fs.readFile()` on Git pack index files (`.idx`) with an options object as the encoding parameter, but the OPFS adapter was incorrectly interpreting this as a string encoding and returning text data instead of binary data.

## Debug Output Analysis

```
[OPFSAdapter] readFile called: path="/projects/untitled-1/.git/objects/pack/pack-be5dbf750d545d214e0191ae909d83915c6beb6a.idx", encoding="[object Object]"
[OPFSAdapter] File found: size=5328, type="", lastModified=1758521210388
[OPFSAdapter] Returning text content for encoding "[object Object]", length=5138
```

**Problem**: The `.idx` file is a binary Git pack index file, but it was being returned as text because `encoding="[object Object]"` was being treated as a truthy string value.

**Solution**: Modified the encoding detection logic to:
1. Always return binary data for Git pack files and object files
2. Only return text for explicit `encoding === 'utf8'` on non-Git binary files
3. Handle cases where isomorphic-git passes options objects as encoding

## Code Changes

### Before (Broken)
```typescript
if (encoding === 'utf8') {
  return await file.text();
} else if (encoding) {
  // BUG: This treated "[object Object]" as truthy and returned text
  return await file.text();
} else {
  // Binary data
  return new Uint8Array(arrayBuffer);
}
```

### After (Fixed)
```typescript
// Git pack files (.pack, .idx) and object files should always be binary
const isGitBinaryFile = path.includes('.git/objects/pack/') || 
                       (path.includes('.git/objects/') && !path.includes('.git/objects/info/')) ||
                       path.endsWith('.pack') || 
                       path.endsWith('.idx') ||
                       path.includes('.git/index');

// Only return text for explicit 'utf8' encoding on non-Git binary files
const shouldReturnText = !isGitBinaryFile && 
                        encoding === 'utf8' && 
                        typeof encoding === 'string';

if (shouldReturnText) {
  return await file.text();
} else {
  // Return binary data (Uint8Array)
  return new Uint8Array(arrayBuffer);
}
```

## Expected Result

With this fix, Git pack index files will be correctly returned as `Uint8Array` binary data, which should resolve the `Cannot read properties of undefined (reading 'error')` error in isomorphic-git's `readObjectPacked` function.

## Testing

To test this fix:
1. Try creating a new project with OPFS enabled
2. The Git clone operation should now succeed
3. Debug logs should show: `Returning binary content: X bytes` for `.idx` files instead of `Returning text content`