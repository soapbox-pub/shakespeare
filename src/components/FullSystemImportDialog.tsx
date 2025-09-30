import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, AlertTriangle, Trash2, CheckCircle, XCircle, Info, Loader2, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import { cn } from '@/lib/utils';
import { importFullSystem, validateExportFile, type ImportProgress, type ImportValidation } from '@/lib/fullSystemImport';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FullSystemImportDialogProps {
  onImport?: () => void;
  disabled?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { fs } = useFS();

  const handleFileSelect = async (file: File) => {
    // Only accept zip files
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a ZIP file');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setValidation(null);
    setImportComplete(false);

    // Validate the file
    setIsValidating(true);
    try {
      const validationResult = await validateExportFile(file);
      setValidation(validationResult);

      if (!validationResult.isValid) {
        setError(`Invalid export file: ${validationResult.errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate file');
    } finally {
      setIsValidating(false);
    }
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
  }, []);

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setValidation(null);
    setError(null);
    setImportComplete(false);
  };

  const handleImportStart = () => {
    if (!selectedFile || !validation?.isValid) return;
    setShowWarningDialog(true);
  };

  const handleImportConfirm = async () => {
    if (!selectedFile) return;

    setShowWarningDialog(false);
    setIsImporting(true);
    setImportProgress(null);
    setError(null);

    try {
      await importFullSystem(selectedFile, fs, (progress) => {
        setImportProgress(progress);
      });

      setImportComplete(true);

      toast({
        title: 'System Import Successful',
        description: 'Your Shakespeare workspace has been completely restored from the export file.',
      });

      // Call onImport callback if provided
      if (onImport) {
        onImport();
      }

      // Close dialog after a short delay to show success
      setTimeout(() => {
        setIsOpen(false);
        // Reload the page to refresh all data
        window.location.reload();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import system');
      setImportProgress(null);

      toast({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Failed to import system',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setIsOpen(false);
      setSelectedFile(null);
      setValidation(null);
      setError(null);
      setImportProgress(null);
      setImportComplete(false);
    }
  };

  const getStageDescription = (stage: ImportProgress['stage']): string => {
    switch (stage) {
      case 'extracting': return 'Extracting ZIP file...';
      case 'validating': return 'Validating export structure...';
      case 'creating_temp': return 'Setting up temporary workspace...';
      case 'importing': return 'Importing files to temporary storage...';
      case 'replacing': return 'Replacing current system and restoring settings...';
      case 'cleanup': return 'Cleaning up temporary files...';
      case 'complete': return 'Import completed successfully!';
      default: return 'Processing...';
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
              className={cn("gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground", className)}
            >
              <HardDrive className="h-4 w-4" />
              Import Full System
            </Button>
          </DialogTrigger>
        )}

        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-destructive" />
              Import Complete Shakespeare System
            </DialogTitle>
            <DialogDescription>
              Replace your entire Shakespeare workspace with a previously exported backup.
              This will permanently delete all current projects, settings, and data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Warning Alert */}
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">
                <strong>Warning:</strong> This action will completely wipe your current Shakespeare workspace and replace it with the imported data.
                All current projects, AI settings, Git credentials, and preferences will be permanently lost.
              </AlertDescription>
            </Alert>

            {!isImporting && !importComplete && (
              <>
                {/* File Upload Area */}
                <div
                  className={cn(
                    "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5",
                    selectedFile && validation?.isValid && "border-green-500/50 bg-green-500/5",
                    selectedFile && validation && !validation.isValid && "border-destructive/50 bg-destructive/5"
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
                    disabled={isImporting || isValidating}
                  />

                  <div className="space-y-3">
                    <div className="flex justify-center">
                      {isValidating ? (
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      ) : selectedFile ? (
                        validation?.isValid ? (
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        ) : (
                          <XCircle className="h-8 w-8 text-destructive" />
                        )
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    <div>
                      {selectedFile ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {isValidating && (
                            <p className="text-xs text-primary">Validating...</p>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileRemove();
                            }}
                            className="text-xs text-destructive hover:underline"
                            disabled={isValidating}
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Drop your Shakespeare export ZIP here or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Only ZIP files exported from Shakespeare Data Settings
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Validation Results */}
                {validation && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {validation.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        Export Validation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Projects:</span>
                          <Badge variant="secondary" className="ml-2">
                            {validation.projectCount}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Files:</span>
                          <Badge variant="secondary" className="ml-2">
                            {validation.totalFiles}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Has Config:</span>
                          <Badge variant={validation.hasConfig ? "default" : "secondary"} className="ml-2">
                            {validation.hasConfig ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valid:</span>
                          <Badge variant={validation.isValid ? "default" : "destructive"} className="ml-2">
                            {validation.isValid ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>

                      {validation.errors.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-destructive">Errors:</p>
                          <ul className="text-xs text-destructive space-y-1">
                            {validation.errors.map((error, index) => (
                              <li key={index} className="flex items-start gap-1">
                                <span>•</span>
                                <span>{error}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {validation.warnings.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-amber-600">Warnings:</p>
                          <ul className="text-xs text-amber-600 space-y-1">
                            {validation.warnings.map((warning, index) => (
                              <li key={index} className="flex items-start gap-1">
                                <span>•</span>
                                <span>{warning}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportStart}
                    disabled={!selectedFile || !validation?.isValid || isValidating}
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Replace Entire System
                  </Button>
                </div>
              </>
            )}

            {/* Import Progress */}
            {isImporting && importProgress && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {getStageDescription(importProgress.stage)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={importProgress.progress} className="w-full" />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{importProgress.message}</span>
                      <span>{Math.round(importProgress.progress)}%</span>
                    </div>

                    {importProgress.filesProcessed && importProgress.totalFiles && (
                      <div className="text-xs text-muted-foreground text-center">
                        Processing file {importProgress.filesProcessed} of {importProgress.totalFiles}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      <strong>Current Stage:</strong> {importProgress.stage.replace('_', ' ').toUpperCase()}
                    </div>
                  </CardContent>
                </Card>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Please do not close this window or navigate away during the import process.
                    This may take several minutes depending on the size of your data.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Success State */}
            {importComplete && (
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-green-600">
                    <CheckCircle className="h-6 w-6" />
                    <div>
                      <p className="font-medium">Import Completed Successfully!</p>
                      <p className="text-sm text-muted-foreground">
                        Your Shakespeare workspace has been restored. The page will reload automatically.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Complete System Replacement
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to <strong>completely replace</strong> your Shakespeare workspace with the imported data.
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

              {validation && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Import will restore:</p>
                  <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>{validation.projectCount} projects</li>
                    <li>{validation.totalFiles} total files</li>
                    {validation.hasConfig && <li>Settings, themes, and preferences</li>}
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