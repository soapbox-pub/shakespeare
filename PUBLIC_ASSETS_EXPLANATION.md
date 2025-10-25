# Public Assets in Vite with Electron

## The Problem

When using `base: './'` in Vite config for Electron support, public assets need special handling.

### Why `/shakespeare.svg` Doesn't Work in Electron

```tsx
// ❌ This breaks in Electron
<img src="/shakespeare.svg" alt="Logo" />
```

**In Browser:**
- `/shakespeare.svg` → `https://example.com/shakespeare.svg` ✅

**In Electron (file:// protocol):**
- `/shakespeare.svg` → `file:///shakespeare.svg` (filesystem root) ❌

The issue is that `base: './'` only transforms paths in `index.html`, **not** runtime JavaScript strings.

## The Solution

Import the asset - Vite will handle the path transformation:

```tsx
// ✅ This works in both browser and Electron
import shakespeareLogo from '/shakespeare.svg';

<img src={shakespeareLogo} alt="Logo" />
```

### What Vite Does

With `base: './'` in config:

1. **Without import** (runtime string):
   ```tsx
   src="/shakespeare.svg"  // Not transformed, breaks in Electron
   ```

2. **With import** (build-time):
   ```tsx
   import logo from '/shakespeare.svg';
   // Vite transforms to: const logo = './shakespeare.svg';
   src={logo}  // Works in both browser and Electron ✅
   ```

## Why Not `?url`?

The `?url` suffix is a Vite-specific feature that **forces** the import to return a URL string:

```tsx
import logo from '/shakespeare.svg?url';
// Always returns a URL string
```

But this is **unnecessary** because:
1. Vite already handles SVG imports correctly
2. Without `?url`, Vite still returns the correct path
3. Using `?url` makes the code unnecessarily Vite-specific

## Best Practice

For public assets that need to work in both browser and Electron:

```tsx
// ✅ Correct - import without ?url
import logo from '/shakespeare.svg';
import badge from '/badge.svg';

export function MyComponent() {
  return (
    <div>
      <img src={logo} alt="Logo" />
      <img src={badge} alt="Badge" />
    </div>
  );
}
```

## Summary

- **Problem**: Absolute paths (`/file.svg`) don't work with Electron's `file://` protocol
- **Solution**: Import assets so Vite can transform paths at build time
- **No `?url` needed**: Plain imports work fine with `base: './'`
- **Result**: Code works in both browser and Electron without special handling
