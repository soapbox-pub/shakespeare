import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, FileArchive, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';

interface ZipImportDialogProps {
  onImport: (file: File, overwrite?: boolean, projectId?: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ZipImportDialog({ onImport, disabled = false, className, open, onOpenChange }: ZipImportDialogProps) {
  // Use controlled state if props are provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedId, setGeneratedId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [existingProject, setExistingProject] = useState<{ id: string; name: string } | null>(null);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: projects = [] } = useProjects();

  const handleFileSelect = (file: File) => {
    // Only accept zip files
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a ZIP file');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Auto-generate ID from file name
    const baseName = file.name.replace(/\.zip$/i, '');
    const id = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setGeneratedId(id);
  };

  // Check for existing project when generated ID changes
  useEffect(() => {
    if (generatedId && projects.length > 0) {
      const existing = projects.find(project => project.id === generatedId);
      setExistingProject(existing || null);
    } else {
      setExistingProject(null);
    }
  }, [generatedId, projects]);

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
  }, []);

  const handleDragOverDialog = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeaveDialog = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDropDialog = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setGeneratedId('');
    setError(null);
  };

  const handleImport = async (overwrite = false) => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await onImport(selectedFile, overwrite, generatedId);

      clearInterval(progressInterval);
      setImportProgress(100);

      // Close dialog after a short delay
      setTimeout(() => {
        setIsOpen(false);
        setSelectedFile(null);
        setGeneratedId('');
        setImportProgress(0);
        setExistingProject(null);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import project');
      setImportProgress(0);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportWithOverwriteCheck = async () => {
    if (!selectedFile || !generatedId) return;

    // Check if project with this ID already exists
    try {
      // This would ideally be passed as a prop or through context
      // For now, we'll assume the parent will handle the check and pass existing project info
      if (existingProject) {
        setShowOverwriteDialog(true);
      } else {
        await handleImport(false);
      }
    } catch (error) {
      console.error('Error checking existing project:', error);
      await handleImport(false);
    }
  };

  const confirmOverwrite = async () => {
    setShowOverwriteDialog(false);
    await handleImport(true);
  };

  const handleClose = () => {
    if (!isImporting) {
      setIsOpen(false);
      setSelectedFile(null);
      setGeneratedId('');
      setError(null);
      setImportProgress(0);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn("gap-2", className)}
          >
            <FileArchive className="h-4 w-4" />
            Import ZIP
          </Button>
        </DialogTrigger>

        <DialogContent
          className="sm:max-w-md"
          onDragOver={handleDragOverDialog}
          onDragLeave={handleDragLeaveDialog}
          onDrop={handleDropDialog}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Project from ZIP
            </DialogTitle>
            <DialogDescription>
              Upload a ZIP file containing your project source code to import it into Shakespeare.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!isImporting && (
              <>
                {/* Drag and Drop Area */}
                <div
                  className={cn(
                    "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
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
                    disabled={isImporting}
                  />

                  <div className="space-y-3">
                    <div className="flex justify-center">
                      {selectedFile ? (
                        <FileText className="h-8 w-8 text-green-600" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
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
                            Supports ZIP files up to 50MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {/* Overwrite Warning */}
                {existingProject && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                    <AlertCircle className="h-3 w-3" />
                    A project with this ID already exists. You can choose to overwrite it.
                  </div>
                )}

                {/* Import Button */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportWithOverwriteCheck}
                    disabled={!selectedFile || !generatedId || isImporting}
                    className={existingProject ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    {existingProject ? (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Overwrite Project
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Project
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Importing project...
                </div>
                <Progress value={importProgress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">
                  Extracting files and setting up project...
                </p>
              </div>
            )}

            {/* Success State */}
            {!isImporting && importProgress === 100 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Project imported successfully!
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
              Overwrite Existing Project
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                A project with the ID "<strong>{generatedId}</strong>" already exists.
                Overwriting it will:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li><strong>Delete all existing files</strong> in the project</li>
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
              Yes, Overwrite Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}