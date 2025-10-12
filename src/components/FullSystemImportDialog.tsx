import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, CheckCircle, Loader2, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import { cn } from '@/lib/utils';
import { importFullSystem, validateExportFile, type ImportProgress, type ImportValidation } from '@/lib/fullSystemImport';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUploadArea } from '@/components/ui/file-upload-area';

interface FullSystemImportDialogProps {
  onImport?: () => void;
  disabled?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ImportState {
  selectedFile: File | null;
  validation: ImportValidation | null;
  isImporting: boolean;
  importProgress: ImportProgress | null;
  error: string | null;
  isDragOver: boolean;
  showWarningDialog: boolean;
  importComplete: boolean;
}

export function FullSystemImportDialog({
  onImport,
  disabled = false,
  className,
  open,
  onOpenChange
}: FullSystemImportDialogProps) {
  // Use controlled state if props are provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  // Consolidated state management
  const [state, setState] = useState<ImportState>({
    selectedFile: null,
    validation: null,
    isImporting: false,
    importProgress: null,
    error: null,
    isDragOver: false,
    showWarningDialog: false,
    importComplete: false
  });


  const { toast } = useToast();
  const { fs } = useFS();

  const updateState = (updates: Partial<ImportState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      updateState({ error: 'Please select a ZIP file', selectedFile: file, validation: null, importComplete: false });
      return;
    }

    updateState({ selectedFile: file, error: null, validation: null, importComplete: false });

    try {
      const validationResult = await validateExportFile(file);
      updateState({ validation: validationResult });

      if (!validationResult.isValid) {
        updateState({ error: `Invalid export: ${validationResult.errors.slice(0, 2).join(', ')}` });
      }
    } catch (err) {
      updateState({ error: err instanceof Error ? err.message : 'Failed to validate file' });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    updateState({ isDragOver: true });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    updateState({ isDragOver: false });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    updateState({ isDragOver: false });

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        updateState({ error: 'Please select a ZIP file', selectedFile: file, validation: null, importComplete: false });
        return;
      }

      updateState({ selectedFile: file, error: null, validation: null, importComplete: false });

      validateExportFile(file).then(validationResult => {
        updateState({ validation: validationResult });
        if (!validationResult.isValid) {
          updateState({ error: `Invalid export: ${validationResult.errors.slice(0, 2).join(', ')}` });
        }
      }).catch(err => {
        updateState({ error: err instanceof Error ? err.message : 'Failed to validate file' });
      });
    }
  }, []);

  const handleFileRemove = () => {
    updateState({ selectedFile: null, validation: null, error: null, importComplete: false });
  };

  const handleImportStart = () => {
    if (!state.selectedFile || !state.validation?.isValid) return;
    updateState({ showWarningDialog: true });
  };

  const handleImportConfirm = async () => {
    if (!state.selectedFile) return;

    updateState({ showWarningDialog: false, isImporting: true, importProgress: null, error: null });

    try {
      await importFullSystem(state.selectedFile, fs, (progress) => {
        updateState({ importProgress: progress });
      });

      updateState({ importComplete: true });

      toast({
        title: 'Import Successful',
        description: 'Your workspace has been completely restored.',
      });

      if (onImport) onImport();

      setTimeout(() => {
        setIsOpen(false);
        window.location.reload();
      }, 2000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      updateState({ error: errorMsg, importProgress: null, isImporting: false });

      toast({
        title: 'Import Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (!state.isImporting) {
      setIsOpen(false);
      updateState({
        selectedFile: null,
        validation: null,
        error: null,
        importProgress: null,
        importComplete: false
      });
    }
  };

  const getStageDescription = (stage: ImportProgress['stage']): string => {
    const descriptions = {
      extracting: 'Extracting ZIP file...',
      validating: 'Validating export...',
      creating_temp: 'Setting up workspace...',
      importing: 'Importing files...',
      replacing: 'Replacing system...',
      cleanup: 'Cleaning up...',
      complete: 'Import completed!'
    };
    return descriptions[stage] || 'Processing...';
  };

  const isControlled = open !== undefined && onOpenChange !== undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {!isControlled && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn("gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground", className)}
            >
              <HardDrive className="h-4 w-4" />
              Import System
            </Button>
          </DialogTrigger>
        )}

        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-destructive" />
              Import System
            </DialogTitle>
            <DialogDescription>
              Select a Shakespeare export file to replace your entire workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!state.isImporting && (
              <Alert className="border-destructive/50 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>Warning:</strong> This action will <strong>completely replace</strong> your Shakespeare workspace with the imported data.
                  All current projects, AI settings, Git credentials, and preferences will be <strong>permanently deleted</strong>.
                </AlertDescription>
              </Alert>
            )}

            {!state.isImporting && !state.importComplete && (
              <>
                <FileUploadArea
                  selectedFile={state.selectedFile}
                  isDragOver={state.isDragOver}
                  isValid={state.validation?.isValid ?? false}
                  onFileSelect={handleFileSelect}
                  onFileRemove={handleFileRemove}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  disabled={state.isImporting}
                  accept=".zip"
                  className="mb-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      {state.selectedFile ? (
                        state.validation?.isValid ? (
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        ) : (
                          <Trash2 className="h-8 w-8 text-destructive" />
                        )
                      ) : (
                        <HardDrive className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    <div>
                      {state.selectedFile ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{state.selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(state.selectedFile.size / 1024 / 1024).toFixed(2)} MB
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
                            Drop ZIP file here or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Only Shakespeare export ZIP files
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </FileUploadArea>

                {state.validation && (
                  <div className="text-sm space-y-2 p-3 bg-muted rounded">
                    <div className="flex justify-between">
                      <span>Projects:</span>
                      <span className="font-medium">{state.validation.projectCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Files:</span>
                      <span className="font-medium">{state.validation.totalFiles}</span>
                    </div>
                    {state.validation.errors.length > 0 && (
                      <div className="text-xs text-destructive">
                        {state.validation.errors.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {state.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportStart}
                    disabled={!state.selectedFile || !state.validation?.isValid}
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Replace Entire System
                  </Button>
                </div>
              </>
            )}

            {state.isImporting && state.importProgress && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {getStageDescription(state.importProgress.stage)}
                  </div>
                  <Progress value={state.importProgress.progress} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{state.importProgress.message}</span>
                    <span>{Math.round(state.importProgress.progress)}%</span>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please do not close this window during import.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {state.importComplete && (
              <Alert className="border-green-500/50 bg-green-500/5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-600">
                  Import completed successfully! Reloading page...
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={state.showWarningDialog} onOpenChange={(open) => updateState({ showWarningDialog: open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Complete System Replacement
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to <strong>completely replace</strong> your workspace with imported data.
              </p>

              <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                <p className="text-sm font-medium text-destructive mb-2">This will permanently delete:</p>
                <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                  <li>All current projects and their files</li>
                  <li>AI provider settings and API keys</li>
                  <li>Git credentials and repository settings</li>
                  <li>User preferences and theme settings</li>
                  <li>All cached data and temporary files</li>
                </ul>
              </div>

              {state.validation && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Import will restore:</p>
                  <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>{state.validation.projectCount} projects</li>
                    <li>{state.validation.totalFiles} total files</li>
                    {state.validation.hasConfig && <li>Settings, themes, and preferences</li>}
                  </ul>
                </div>
              )}

              <p className="text-destructive font-medium">
                This action cannot be undone. Are you absolutely sure?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImportConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Replace Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}