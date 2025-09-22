# OPFS Implementation for Shakespeare

This document describes the implementation of OPFS (Origin Private File System) support as an alternative to LightningFS in the Shakespeare project.

## Overview

The project now supports two filesystem backends:
1. **LightningFS** (IndexedDB) - The original filesystem implementation
2. **OPFS** (Origin Private File System) - A modern browser API for better performance

## Implementation Details

### 1. OPFS Adapter (`src/lib/OPFSAdapter.ts`)

Created a new `OPFSAdapter` class that implements the `JSRuntimeFS` interface, making it compatible with the existing filesystem abstraction. The adapter provides:

- **File Operations**: `readFile`, `writeFile`, `stat`, `unlink`
- **Directory Operations**: `readdir`, `mkdir`, `rmdir`
- **Utility Operations**: `rename`, `copy`, `recursive operations`
- **Error Handling**: Proper error handling with fallback to LightningFS

### 2. Configuration Updates

#### AppContext (`src/contexts/AppContext.ts`)
- Added `FilesystemType` type: `"lightningfs" | "opfs"`
- Extended `AppConfig` interface to include `filesystemType` field
- Updated Zod schema for validation

#### AppProvider (`src/components/AppProvider.tsx`)
- Updated AppConfigSchema to include filesystemType validation

### 3. Dynamic Filesystem Initialization (`src/App.tsx`)

Created a new `FilesystemProvider` component that:
- Detects OPFS availability in the browser
- Dynamically selects the appropriate filesystem backend
- Provides automatic fallback to LightningFS if OPFS fails
- Shows loading states and error messages

### 4. User Interface Updates

#### AppSettingsDialog (`src/components/AppSettingsDialog.tsx`)
- Added filesystem selection UI with RadioGroup component
- Shows OPFS availability detection
- Displays warnings when OPFS is not available
- Includes educational information about each filesystem type
- Automatically refreshes the page when filesystem type changes

### 5. Type Definitions

#### Nostr Types (`src/types/nostr.d.ts`)
- Added proper TypeScript definitions for `window.nostr` object
- Fixed existing TypeScript errors related to Nostr extension access

## Features

### OPFS Advantages
- **Better Performance**: Direct filesystem access without IndexedDB overhead
- **Larger Storage Limits**: Typically higher storage quotas than IndexedDB
- **Modern API**: Uses native browser filesystem APIs
- **Atomic Operations**: Better support for atomic file operations

### LightningFS Advantages
- **Universal Support**: Works in all modern browsers
- **Mature Implementation**: Well-tested and stable
- **Symbolic Links**: Supports symbolic links (OPFS does not)
- **Proven Reliability**: Used in production for years

### User Experience
- **Automatic Detection**: UI automatically shows available options
- **Clear Warnings**: Users are informed when OPFS is not available
- **Safe Switching**: Page refresh ensures clean filesystem transition
- **Fallback Protection**: Automatic fallback prevents data loss

## Browser Compatibility

### OPFS Support
- ✅ Chrome 87+
- ✅ Edge 87+
- ✅ Firefox 111+
- ❌ Safari (limited support)
- ❌ Mobile browsers (varies)

### LightningFS Support
- ✅ All modern browsers
- ✅ Mobile browsers
- ✅ Older browsers (with polyfills)

## Usage

### For Users
1. Go to Settings → App Settings
2. Select preferred filesystem type in the Filesystem section
3. Save changes (page will refresh automatically)
4. The app will use the selected filesystem

### For Developers
- The filesystem is abstracted through the `JSRuntimeFS` interface
- All existing code continues to work without changes
- New filesystem types can be added by implementing the interface
- Use `useFS()` hook to access the filesystem

## Migration

### From LightningFS to OPFS
1. Export current projects using Data Settings → Export Files
2. Change filesystem type in settings
3. Import projects if needed
4. Verify all data is intact

### From OPFS to LightningFS
1. Export current projects using Data Settings → Export Files
2. Change filesystem type in settings
3. Import projects if needed
4. Verify all data is intact

## Error Handling

### OPFS Not Available
- UI shows warning message
- Option is disabled in settings
- Automatic fallback to LightningFS

### Initialization Failures
- Shows error message with details
- Provides browser compatibility information
- Suggests using LightningFS instead

### Runtime Errors
- Graceful error handling in adapter
- Proper error propagation to UI
- Fallback mechanisms where possible

## Testing

- All existing tests continue to pass
- TypeScript compilation successful
- Build process works correctly
- UI components properly render filesystem options
- Error states are handled appropriately

## Future Enhancements

### Potential Improvements
1. **Data Migration Tools**: Automatic migration between filesystem types
2. **Performance Metrics**: Show performance differences between backends
3. **Storage Analytics**: Display usage statistics for each filesystem
4. **Hybrid Approach**: Use different filesystems for different data types
5. **Compression**: Add compression support for better storage efficiency

### Considerations
- OPFS is still evolving; browser support may change
- LightningFS remains the safer choice for maximum compatibility
- Data portability is important for user freedom
- Performance benefits may vary by use case and browser

## Conclusion

The OPFS implementation provides users with a choice between filesystem backends, balancing modern performance advantages with broad compatibility. The implementation maintains backward compatibility while providing a path forward for users on modern browsers.