# Electron Filesystem Error Code Preservation Fix

## Problem

When creating projects in the Electron app, the filesystem operations were failing because error codes (like `ENOENT`) were not being preserved during IPC communication between the renderer and main processes.

### Root Cause

The Shakespeare codebase relies on checking `error.code === 'ENOENT'` in multiple places to handle file-not-found scenarios gracefully:

- `ProjectsManager.readFile()`
- `ProjectsManager.readFileBytes()`
- `ProjectsManager.listFiles()`
- `ProjectsManager.fileExists()`

When errors are thrown from Node.js filesystem operations in the Electron main process and sent via IPC to the renderer process, the `code` property was being lost during serialization. This is because error properties are typically non-enumerable and don't survive the IPC boundary.

### Symptoms

```
Error occurred in handler for 'fs:stat': Error: Failed to stat /tmp: ENOENT: no such file or directory
Error occurred in handler for 'fs:stat': Error: Failed to stat /projects/untitled: ENOENT: no such file or directory
```

The error messages contained "ENOENT", but the `error.code` property was `undefined`, causing code that checks `error.code === 'ENOENT'` to fail.

## Solution

The fix required changes in two places:

### 1. Electron Main Process (`electron/main.js`)

Updated all filesystem IPC handlers to explicitly preserve the error `code` property using `Object.defineProperty()` with `enumerable: true`:

```javascript
catch (error) {
  const err = new Error(`Failed to stat ${filePath}: ${error.message}`);
  if (error.code) {
    Object.defineProperty(err, 'code', {
      value: error.code,
      enumerable: true,  // Critical: makes property survive IPC serialization
      writable: true,
      configurable: true,
    });
  }
  throw err;
}
```

**Updated IPC Handlers:**
- `fs:readFile`
- `fs:writeFile`
- `fs:readdir`
- `fs:mkdir`
- `fs:stat`
- `fs:lstat`
- `fs:unlink`
- `fs:rmdir`
- `fs:rename`
- `fs:readlink`
- `fs:symlink`

### 2. Electron FS Adapter (`src/lib/ElectronFSAdapter.ts`)

Added error unwrapping in the renderer process to handle Electron's IPC error wrapping. When errors cross the IPC boundary, Electron wraps them in messages like "Error invoking remote method 'fs:stat': ...". The adapter now:

1. **Catches all errors** from IPC calls
2. **Extracts the error code** from either:
   - The `code` property (if preserved from main process)
   - The error message via regex matching (fallback)
3. **Re-throws a clean error** with the proper `code` property

```typescript
private unwrapElectronError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return error as Error;
  }

  // Extract error code from the error object if it exists
  const code = (error as NodeJS.ErrnoException).code;

  // If there's already a code, preserve it
  if (code) {
    const err = new Error(error.message);
    (err as NodeJS.ErrnoException).code = code;
    return err;
  }

  // If no code property, try to extract from the message
  const match = error.message.match(/:\s*(E[A-Z]+):/);
  if (match) {
    const err = new Error(error.message);
    (err as NodeJS.ErrnoException).code = match[1];
    return err;
  }

  return error;
}
```

All filesystem methods in `ElectronFSAdapter` now wrap their calls in try-catch blocks and use `unwrapElectronError()` to ensure error codes are properly preserved.

## Difference from LightningFS

**LightningFS** runs entirely in the renderer process (browser context), so errors never cross the IPC boundary. Error objects maintain all their properties, including the `code` property.

**ElectronFS** uses IPC to communicate between renderer and main processes. Without explicitly making the `code` property enumerable, it gets lost during serialization.

## Testing

After this fix, project creation in the Electron app should work identically to the browser version:

1. Creating new projects from templates
2. Importing projects from ZIP files
3. Git operations on non-existent paths
4. File existence checks

All operations that rely on `ENOENT` detection should now function correctly.
