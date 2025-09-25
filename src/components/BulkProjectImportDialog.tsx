import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileArchive, AlertCircle, FileText, Trash2, FolderOpen, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  files: string[];
  isConflict: boolean;
  selected: boolean;
}

interface BulkProjectImportDialogProps {
  onImport: (projects: { id: string; files: { [path: string]: Uint8Array } }[], overwrite: boolean) => Promise<void>;
  disabled?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BulkProjectImportDialog({ onImport, disabled = false, className, open, onOpenChange }: BulkProjectImportDialogProps) {
  // Use controlled state if props are provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [discoveredProjects, setDiscoveredProjects] = useState<ProjectInfo[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [zipData, setZipData] = useState<JSZip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: existingProjects = [] } = useProjects();
  const projectsManager = useProjectsManager();

  const analyzeZipForProjects = useCallback(async (zip: JSZip): Promise<ProjectInfo[]> => {
    const projects: ProjectInfo[] = [];
    const projectPaths = new Set<string>();

    // Find all potential project directories
    // Look for directories that contain package.json, index.html, or other project indicators
    for (const [path] of Object.entries(zip.files)) {
      const pathParts = path.split('/').filter(part => part !== '');

      // Skip files in root directory - we're looking for project directories
      if (pathParts.length < 2) continue;

      // Check if this looks like a project indicator file
      if (isProjectIndicator(path)) {
        // Determine the project directory path
        let projectPath: string;

        // If the structure is projects/project-name/file, extract project-name
        if (pathParts[0] === 'projects' && pathParts.length >= 3) {
          projectPath = `projects/${pathParts[1]}`;
        } else {
          // Otherwise, assume first directory is the project
          projectPath = pathParts[0];
        }

        projectPaths.add(projectPath);
      }
    }

    // For each discovered project path, gather information
    for (const projectPath of projectPaths) {
      const files: string[] = [];

      // Collect all files in this project directory
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (path.startsWith(projectPath + '/') && !zipEntry.dir) {
          // Remove the project path prefix to get relative file path
          const relativePath = path.substring(projectPath.length + 1);
          files.push(relativePath);
        }
      }

      // Generate project ID and name from directory path
      let id: string;
      let name: string;

      if (projectPath.startsWith('projects/')) {
        // Extract just the project name from projects/project-name
        const projectName = projectPath.substring('projects/'.length);
        id = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        name = projectName;
      } else {
        // Use the full path as both ID and name
        id = projectPath
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        name = projectPath;
      }

      // Skip if no files found (empty directory)
      if (files.length === 0) continue;

      // Check if this project conflicts with existing projects
      const isConflict = existingProjects.some(existing => existing.id === id);

      projects.push({
        id,
        name,
        path: projectPath,
        files,
        isConflict,
        selected: !isConflict, // Auto-select non-conflicting projects
      });
    }

    return projects;
  }, [existingProjects]);

  const handleFileSelect = useCallback(async (file: File) => {
    // Only accept zip files
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a ZIP file');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setIsAnalyzing(true);
    setDiscoveredProjects([]);

    try {
      // Read and analyze the ZIP file
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      setZipData(zip);

      // Discover projects in the ZIP file
      const projects = await analyzeZipForProjects(zip);
      setDiscoveredProjects(projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze ZIP file');
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeZipForProjects]);

  const isProjectIndicator = (path: string): boolean => {
    const indicators = [
      'package.json',
      'index.html',
      'src/',
      'public/',
      'tsconfig.json',
      'vite.config.',
      'webpack.config.',
      'README.md',
      '.git/',
    ];

    return indicators.some(indicator => path.includes('/' + indicator));
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setDiscoveredProjects([]);
    setZipData(null);
    setError(null);
  };

  const handleProjectToggle = (projectId: string, checked: boolean) => {
    setDiscoveredProjects(prev =>
      prev.map(project =>
        project.id === projectId ? { ...project, selected: checked } : project
      )
    );
  };

  const handleSelectAll = () => {
    setDiscoveredProjects(prev =>
      prev.map(project => ({ ...project, selected: true }))
    );
  };

  const handleDeselectAll = () => {
    setDiscoveredProjects(prev =>
      prev.map(project => ({ ...project, selected: false }))
    );
  };

  const selectedProjects = discoveredProjects.filter(project => project.selected);
  const conflictingProjects = selectedProjects.filter(project => project.isConflict);

  const handleImport = async (overwrite = false) => {
    if (!zipData || selectedProjects.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      // Prepare project data for import using the ProjectsManager's extraction logic
      const projectsToImport = await Promise.all(
        selectedProjects.map(async (project) => {
          // Extract files for this project using the unified extraction method
          const files = await projectsManager.extractFilesFromZip(zipData, project.path);

          return {
            id: project.id,
            files,
          };
        })
      );

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 5, 90));
      }, 100);

      await onImport(projectsToImport, overwrite);

      clearInterval(progressInterval);
      setImportProgress(100);

      // Close dialog after a short delay
      setTimeout(() => {
        setIsOpen(false);
        setSelectedFile(null);
        setDiscoveredProjects([]);
        setZipData(null);
        setImportProgress(0);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import projects');
      setImportProgress(0);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportWithOverwriteCheck = async () => {
    if (conflictingProjects.length > 0) {
      setShowOverwriteDialog(true);
    } else {
      await handleImport(false);
    }
  };

  const confirmOverwrite = async () => {
    setShowOverwriteDialog(false);
    await handleImport(true);
  };

  const handleClose = () => {
    if (!isImporting && !isAnalyzing) {
      setIsOpen(false);
      setSelectedFile(null);
      setDiscoveredProjects([]);
      setZipData(null);
      setError(null);
      setImportProgress(0);
    }
  };

  // Only render DialogTrigger if this component is being used in uncontrolled mode
  const isControlled = open !== undefined && onOpenChange !== undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {!isControlled && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn("gap-2", className)}
            >
              <FileArchive className="h-4 w-4" />
              Import Projects
            </Button>
          </DialogTrigger>
        )}

        <DialogContent className="sm:max-w-xl h-auto max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Multiple Projects
            </DialogTitle>
            <DialogDescription>
              Upload a ZIP file containing multiple projects to import them into Shakespeare.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-4">
            {!isImporting && !isAnalyzing && (
              <>
                {/* Drag and Drop Area */}
                <div
                  className={cn(
                    "relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5",
                    selectedFile && "border-green-500/50 bg-green-500/5"
                  )}
                  onClick={handleClickUpload}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleFileSelect(files[0]);
                      }
                    }}
                    accept=".zip"
                    className="hidden"
                    disabled={isImporting || isAnalyzing}
                  />

                  <div className="space-y-2">
                    <div className="flex justify-center">
                      {selectedFile ? (
                        <FileText className="h-6 w-6 text-green-600" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div>
                      {selectedFile ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-green-600">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileRemove();
                            }}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Drop your ZIP file here or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Supports ZIP files containing exported Shakespeare projects
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive mb-4">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {/* Project List */}
                {discoveredProjects.length > 0 && (
                  <div className="space-y-3 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between flex-shrink-0">
                      <h3 className="text-sm font-medium">
                        Found {discoveredProjects.length} project{discoveredProjects.length !== 1 ? 's' : ''}
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAll}
                          className="h-8 text-xs"
                        >
                          <CheckSquare className="h-3 w-3 mr-1" />
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeselectAll}
                          className="h-8 text-xs"
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Deselect All
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <ScrollArea className="h-64">
                        <div className="p-2 space-y-1">
                        {discoveredProjects.map((project) => (
                          <div
                            key={project.id}
                            className={cn(
                              "flex items-start space-x-3 p-2 rounded-lg border transition-colors",
                              project.selected ? "bg-primary/5 border-primary/20" : "bg-background",
                              project.isConflict && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                            )}
                          >
                            <Checkbox
                              id={`project-${project.id}`}
                              checked={project.selected}
                              onCheckedChange={(checked) => handleProjectToggle(project.id, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                                <span className="font-medium text-sm truncate">{project.name}</span>
                                {/* Show conflict indicator inline on larger screens */}
                                {project.isConflict && (
                                  <div className="hidden sm:flex items-center gap-1 text-amber-600 flex-shrink-0">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span className="text-xs">Conflict</span>
                                  </div>
                                )}
                              </div>

                              {/* Mobile conflict indicator on its own line */}
                              {project.isConflict && (
                                <div className="sm:hidden flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="text-xs font-medium">Conflict - Will overwrite existing project</span>
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">
                                {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                                {/* Only show overwrite text on desktop when conflict exists */}
                                {project.isConflict && <span className="hidden sm:inline"> • Will overwrite existing project</span>}
                              </p>
                            </div>
                          </div>
                        ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                {/* Import Button */}
                {discoveredProjects.length > 0 && (
                  <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0">
                    <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImportWithOverwriteCheck}
                      disabled={selectedProjects.length === 0 || isImporting}
                      className={conflictingProjects.length > 0 ? "bg-amber-600 hover:bg-amber-700" : ""}
                    >
                      {conflictingProjects.length > 0 ? (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Import & Overwrite ({selectedProjects.length})
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Import Projects ({selectedProjects.length})
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Analysis Progress */}
            {isAnalyzing && (
              <div className="space-y-2 py-6">
                <div className="flex items-center gap-2 text-sm justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Analyzing ZIP file...
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Discovering projects and checking for conflicts...
                </p>
              </div>
            )}

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-3 py-6">
                <div className="flex items-center gap-2 text-sm justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Importing {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''}...
                </div>
                <Progress value={importProgress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">
                  Extracting files and setting up projects...
                </p>
              </div>
            )}

            {/* Success State */}
            {!isImporting && !isAnalyzing && importProgress === 100 && (
              <div className="flex items-center gap-2 text-sm text-green-600 justify-center py-3">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Projects imported successfully!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Overwrite Confirmation Dialog */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Overwrite Existing Projects
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You have selected <strong>{conflictingProjects.length}</strong> project{conflictingProjects.length !== 1 ? 's' : ''} that already exist:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2 max-h-32 overflow-y-auto">
                {conflictingProjects.map((project) => (
                  <li key={project.id}>
                    <strong>{project.name}</strong> (ID: {project.id})
                  </li>
                ))}
              </ul>
              <p>Overwriting will:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li><strong>Delete all existing files</strong> in these projects</li>
                <li><strong>Replace them with files</strong> from the ZIP archive</li>
                <li><strong>Preserve Git history</strong> if it exists</li>
                <li><strong>Keep AI chat history</strong> and session data</li>
              </ul>
              <p className="text-amber-600 font-medium">
                This action cannot be undone. Are you sure you want to continue?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmOverwrite}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Yes, Overwrite Projects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}