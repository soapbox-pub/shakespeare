# Full System Import Feature

Shakespeare now includes a comprehensive **Full System Import** feature that allows users to completely replace their entire workspace with a previously exported backup. This is like loading a physical disk into the hardware of Shakespeare.

## Overview

The Full System Import feature provides:

- **Complete workspace replacement** - All current data is wiped and replaced
- **Settings restoration** - Restores themes, preferences, and all localStorage data
- **Temporary import workspace** - Uses a separate IndexedDB database for safe processing
- **Security validation** - Prevents directory traversal and malicious file paths
- **Progress tracking** - Real-time feedback during the import process
- **Atomic operation** - Either succeeds completely or fails safely with cleanup

## How It Works

### 1. **Export Structure Validation**

Before any import begins, the system validates that the ZIP file contains a valid Shakespeare export:

- **Required directories**: `projects/`, `config/`, `tmp/` (or localStorage data)
- **Settings data**: `localStorage.json` containing all browser settings
- **Security checks**: No directory traversal (`../`) or unsafe paths
- **File validation**: Only files in allowed directories are accepted
- **Structure verification**: Ensures the export matches Shakespeare's filesystem layout

### 2. **Temporary Import Processing**

The import process uses a temporary IndexedDB database to safely process the import:

```
Temporary Database: shakespeare-import-{timestamp}
├── Extracted ZIP contents
├── Path validation
├── Structure verification
└── Data integrity checks
```

### 3. **Atomic Replacement**

Once validation is complete, the system performs an atomic replacement:

1. **Clear current system** - All existing data is deleted
2. **Copy from temporary** - Validated data is copied to the main filesystem
3. **Cleanup temporary** - The temporary database is deleted
4. **Page reload** - The interface refreshes to show the new data

## Import Process Stages

The import process goes through several stages with progress reporting:

1. **Extracting** (0-10%) - Reading and extracting the ZIP file
2. **Validating** (10-20%) - Validating export structure and security
3. **Creating Temp** (20-30%) - Setting up temporary import workspace
4. **Importing** (30-70%) - Extracting files to temporary storage
5. **Replacing** (70-90%) - Replacing current system with imported data
6. **Restoring Settings** (90-95%) - Restoring themes, preferences, and localStorage
7. **Cleanup** (95-100%) - Removing temporary files and finalizing

## Security Features

### Path Validation

The system prevents malicious imports through comprehensive path validation:

```typescript
// Blocked patterns
../../../etc/passwd          // Directory traversal
projects/../../../system/     // Traversal within allowed directories
/absolute/path/outside/       // Absolute paths outside structure
```

### Allowed File Locations

Only files in these directories and specific root files are accepted:

- `projects/` - User projects and source code
- `config/` - AI settings, Git credentials, preferences
- `tmp/` - Temporary files and scratch space
- `localStorage.json` - Browser settings and preferences (root level)

### Structure Validation

The import validates the complete directory structure:

```
Valid Shakespeare Export:
├── projects/
│   └── {project-id}/
│       ├── package.json
│       ├── src/
│       └── ...
├── config/
│   ├── ai.json
│   ├── git.json
│   └── ...
├── tmp/
│   └── ...
└── localStorage.json  # Settings and preferences
```

## User Interface

### Data Settings Integration

The Full System Import feature is integrated into the **Data Settings** page (`/settings/data`):

- **Warning alerts** about data loss
- **File upload interface** with drag-and-drop support
- **Validation results** showing project count, file count, and any errors
- **Progress tracking** during the import process
- **Confirmation dialogs** for destructive operations

### Import Dialog Features

- **Drag & Drop**: Drop ZIP files directly onto the dialog
- **File Validation**: Real-time validation with detailed feedback
- **Progress Display**: Stage-by-stage progress with file counts
- **Error Handling**: Clear error messages and safe failure handling
- **Confirmation**: Multi-step confirmation for destructive operations

## API Usage

### Programmatic Import

```typescript
import { importFullSystem, validateExportFile } from '@/lib/fullSystemImport';

// Validate before importing
const validation = await validateExportFile(zipFile);
if (!validation.isValid) {
  console.error('Invalid export:', validation.errors);
  return;
}

// Import with progress tracking
await importFullSystem(zipFile, fs, (progress) => {
  console.log(`${progress.stage}: ${progress.progress}% - ${progress.message}`);
});
```

### Validation Results

```typescript
interface ImportValidation {
  isValid: boolean;
  hasProjects: boolean;
  hasConfig: boolean;
  projectCount: number;
  totalFiles: number;
  errors: string[];
  warnings: string[];
}
```

## Error Handling

The system handles various error scenarios gracefully:

### Import Errors

- **Invalid ZIP format** - File is not a valid ZIP archive
- **Missing structure** - Required directories are missing
- **Security violations** - Unsafe file paths detected
- **Corruption** - Files cannot be extracted or are corrupted

### Recovery

- **Automatic cleanup** - Temporary databases are always cleaned up
- **Safe failure** - Original data remains intact if import fails
- **Error reporting** - Detailed error messages help diagnose issues
- **Rollback** - No partial imports; either succeeds completely or fails safely

## Technical Implementation

### Core Classes

- **`FullSystemImporter`** - Main import orchestration class
- **`LightningFSAdapter`** - Filesystem interface adapter
- **`JSRuntimeFS`** - Unified filesystem interface

### Key Methods

- **`validateExport()`** - Validates ZIP file structure and security
- **`importFullSystem()`** - Orchestrates the complete import process
- **`createTempFilesystem()`** - Sets up temporary import workspace
- **`directImport()`** - Direct import for test environments

### Browser Compatibility

- **IndexedDB required** - Uses IndexedDB for temporary storage
- **File API support** - Requires modern File API with `arrayBuffer()`
- **ZIP processing** - Uses JSZip library for archive handling
- **Progress tracking** - Real-time progress updates via callbacks

## Use Cases

### Complete Workspace Migration

- **Device switching** - Move entire workspace to new device
- **Backup restoration** - Restore from complete backup
- **Environment setup** - Set up identical development environment

### Data Recovery

- **Corruption recovery** - Restore from known good backup
- **Accidental deletion** - Recover lost projects and settings
- **Version rollback** - Return to previous workspace state

### Team Collaboration

- **Workspace sharing** - Share complete project setups
- **Template distribution** - Distribute configured environments
- **Onboarding** - Set up new team members with standard workspace

## What Gets Exported/Imported

The Full System Export/Import includes:

### Virtual Filesystem Data
- **All projects** - Complete project files and directories
- **Configuration** - AI settings, Git credentials, user preferences
- **Temporary files** - Any files in the `/tmp` directory

### Browser Storage Data (localStorage.json)
- **Theme settings** - Light/dark/system theme preferences
- **Language preferences** - Interface language selection
- **Project favorites** - Starred/favorited projects
- **AI provider configurations** - API keys and provider settings
- **Git credentials** - Repository access credentials
- **Nostr login data** - Authentication and relay preferences
- **Application preferences** - All other localStorage-stored settings
- **Session data** - Temporary application state

## Limitations

- **Complete replacement only** - Cannot merge with existing data
- **Browser storage limits** - Limited by IndexedDB quota
- **Single ZIP format** - Only accepts ZIP files from Shakespeare exports
- **No selective import** - Imports everything or nothing

## Best Practices

### Before Importing

1. **Export current data** - Always backup before importing
2. **Validate the import** - Check validation results carefully
3. **Verify source** - Ensure the ZIP is from a trusted source
4. **Check storage space** - Ensure sufficient browser storage

### After Importing

1. **Verify data integrity** - Check that all projects loaded correctly
2. **Test functionality** - Ensure all features work as expected
3. **Update settings** - Reconfigure any environment-specific settings
4. **Create new backup** - Export the imported data as a new backup

## Troubleshooting

### Common Issues

- **"Invalid export format"** - ZIP doesn't contain Shakespeare structure
- **"Unsafe file path"** - ZIP contains directory traversal attempts
- **"Storage quota exceeded"** - Not enough browser storage space
- **"Import failed"** - General import error, check browser console

### Solutions

- **Re-export from source** - Create a fresh export from the source
- **Clear browser storage** - Free up space by clearing old data
- **Check browser support** - Ensure browser supports required APIs
- **Use smaller exports** - Break large workspaces into smaller pieces

## Future Enhancements

Potential future improvements to the Full System Import feature:

- **Selective import** - Choose which parts to import
- **Merge capabilities** - Merge with existing data instead of replacing
- **Compression options** - Support for different archive formats
- **Cloud storage** - Direct import from cloud storage services
- **Incremental imports** - Import only changed files
- **Backup scheduling** - Automatic export and import scheduling

---

The Full System Import feature provides a robust, secure way to completely replace a Shakespeare workspace, making it easy to migrate between devices, restore from backups, or set up identical development environments.