import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, AlertTriangle, Loader2, Database, Info, ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppContext } from '@/hooks/useAppContext';
import JSZip from 'jszip';

interface StorageUsageDetails {
  indexedDB?: number;
  caches?: number;
  serviceWorkerRegistrations?: number;
  [key: string]: number | undefined;
}

interface StorageInfo {
  quota: number;
  usage: number;
  usageDetails?: StorageUsageDetails;
}

export function DataSettings() {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const { toast } = useToast();
  const { fs } = useFS();
  const { config, updateConfig } = useAppContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [deployServer, setDeployServer] = useState(config.deployServer);
  const [filesystemType, setFilesystemType] = useState(config.filesystemType);
  const [opfsAvailable, setOpfsAvailable] = useState(false);

  // Check OPFS availability on mount
  useEffect(() => {
    const checkOPFSAvailability = () => {
      const available = 'storage' in navigator && !!((navigator.storage as unknown as { getDirectory: () => FileSystemDirectoryHandle }).getDirectory);
      setOpfsAvailable(available);
    };

    checkOPFSAvailability();
  }, []);

  // Format bytes to human readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Load storage information
  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        // Check if StorageManager API is available
        if (!('storage' in navigator)) {
          setStorageError('StorageManager API is not available in this browser');
          return;
        }

        // Get storage estimate
        const estimate = await navigator.storage.estimate();

        // Extract usage details safely
        const usageDetails: StorageUsageDetails | undefined = (estimate as StorageEstimate & { usageDetails?: StorageUsageDetails }).usageDetails;

        setStorageInfo({
          quota: estimate.quota || 0,
          usage: estimate.usage || 0,
          usageDetails,
        });
      } catch (error) {
        console.error('Failed to get storage information:', error);
        setStorageError(error instanceof Error ? error.message : 'Failed to get storage information');
      }
    };

    loadStorageInfo();
  }, []);

  const exportFilesAsZip = async () => {
    const zip = new JSZip();

    // Recursive function to add files and directories to zip
    const addToZip = async (dirPath: string, zipFolder: JSZip) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;

          if (entry.isDirectory()) {
            // Create folder in zip and recursively add its contents
            const folder = zipFolder.folder(entry.name);
            if (folder) {
              await addToZip(fullPath, folder);
            }
          } else if (entry.isFile()) {
            // Add file to zip
            try {
              const fileContent = await fs.readFile(fullPath);
              zipFolder.file(entry.name, fileContent);
            } catch (error) {
              console.warn(`Failed to read file ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${dirPath}:`, error);
      }
    };

    // Start from root directory
    await addToZip('/', zip);

    // Generate zip file
    const content = await zip.generateAsync({ type: 'blob' });

    // Create download link
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    link.download = `shakespeare-projects-${dateStr}.zip`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportFiles = async () => {
    setIsExporting(true);
    try {
      await exportFilesAsZip();

      toast({
        title: t('filesExportedSuccessfully'),
        description: t('filesExportedDescription'),
      });
    } catch (error) {
      console.error('Failed to export files:', error);
      toast({
        title: t('failedToExportFiles'),
        description: error instanceof Error ? error.message : t('error'),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      // Clear localStorage
      localStorage.clear();

      // Clear IndexedDB databases
      const databases = await indexedDB.databases();
      const deletePromises = databases.map(db => {
        if (db.name) {
          return new Promise<void>((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(db.name!);
            deleteReq.onsuccess = () => resolve();
            deleteReq.onerror = () => reject(deleteReq.error);
            deleteReq.onblocked = () => {
              console.warn(`Delete blocked for database: ${db.name}`);
              // Still resolve to continue with the process
              resolve();
            };
          });
        }
        return Promise.resolve();
      });

      await Promise.all(deletePromises);

      toast({
        title: t('dataClearedSuccessfully'),
        description: t('dataClearedDescription'),
      });

      // Small delay to show the toast, then redirect
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast({
        title: t('failedToClearData'),
        description: error instanceof Error ? error.message : t('error'),
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleSaveSettings = () => {
    // Validate deploy server
    if (!deployServer.trim()) {
      toast({
        title: "Invalid deploy server",
        description: "Deploy server cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    // Validate filesystem type
    if (filesystemType === 'opfs' && !opfsAvailable) {
      toast({
        title: "OPFS not available",
        description: "OPFS is not supported in your browser. Please use LightningFS instead.",
        variant: "destructive",
      });
      return;
    }

    // Remove protocol if present
    const cleanDeployServer = deployServer.replace(/^https?:\/\//, '');

    updateConfig((current) => ({
      ...current,
      deployServer: cleanDeployServer,
      filesystemType,
    }));

    toast({
      title: "Settings saved",
      description: "Your settings have been updated. The page will refresh to apply the new filesystem.",
    });

    // Refresh the page to apply filesystem changes
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleCancelSettings = () => {
    // Reset to current config
    setDeployServer(config.deployServer);
    setFilesystemType(config.filesystemType);
  };

  return (
    <div className="p-6 space-y-6">
      {isMobile && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-8 w-auto px-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSettings')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              {t('dataSettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('dataSettingsDescriptionLong')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            {t('dataSettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('dataSettingsDescriptionLong')}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Storage Information */}
        {storageError ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            <span className="text-sm">{storageError}</span>
          </div>
        ) : storageInfo ? (
          <div className="space-y-4">
            {/* Usage Progress */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>{t('used')}: {formatBytes(storageInfo.usage)}</span>
                <span>{t('available')}: {formatBytes(storageInfo.quota)}</span>
              </div>
              <Progress
                value={storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0}
                className="h-2"
              />
              <div className="text-xs text-muted-foreground text-center">
                {storageInfo.quota > 0
                  ? t('usagePercentage', { percentage: ((storageInfo.usage / storageInfo.quota) * 100).toFixed(1) })
                  : t('usageUnavailable')
                }
              </div>
            </div>

          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('loadingStorageInfo')}</span>
          </div>
        )}

        {/* Filesystem Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('filesystem')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('filesystemType')}</Label>
              <RadioGroup
                value={filesystemType}
                onValueChange={(value) => setFilesystemType(value as 'lightningfs' | 'opfs')}
                className="grid grid-cols-1 gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lightningfs" id="lightningfs" />
                  <Label htmlFor="lightningfs" className="cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">LightningFS (IndexedDB)</span>
                      <span className="text-sm text-muted-foreground">
                        Uses IndexedDB for storage. Works in all modern browsers.
                      </span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="opfs"
                    id="opfs"
                    disabled={!opfsAvailable}
                  />
                  <Label htmlFor="opfs" className={`cursor-pointer ${!opfsAvailable ? 'opacity-50' : ''}`}>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-2">
                        OPFS (Origin Private File System)
                        {!opfsAvailable && (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {opfsAvailable
                          ? "Modern browser API with better performance and larger storage limits. Note: May have compatibility issues with Git operations."
                          : "Not available in this browser. Use Chrome, Edge, or Firefox 111+."
                        }
                      </span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {!opfsAvailable && filesystemType === 'opfs' && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-800 dark:text-orange-200">
                  OPFS is not available in your browser. Please use LightningFS or upgrade to a modern browser.
                </span>
              </div>
            )}

            {opfsAvailable && filesystemType === 'opfs' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p><strong>Git Compatibility Note:</strong> OPFS may have compatibility issues with Git clone operations. If you experience problems creating projects, switch to LightningFS for better Git support.</p>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <p><strong>Note:</strong> Changing filesystem type will refresh the page and may cause data loss if not properly exported first.</p>
            </div>
          </CardContent>
        </Card>

        {/* Deployment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('deployment')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deployServer">{t('deployServer')}</Label>
              <Input
                id="deployServer"
                value={deployServer}
                onChange={(e) => setDeployServer(e.target.value)}
                placeholder="shakespeare.wtf"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {t('deployServerDescription')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Export Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('exportFiles')}
            </CardTitle>
            <CardDescription>
              {t('exportFilesDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExportFiles}
              disabled={isExporting}
              className="w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('exporting')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t('exportAllFiles')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Clear All Data */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('clearAllData')}
            </CardTitle>
            <CardDescription>
              {t('clearAllDataDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isClearing}
                  className="w-full sm:w-auto"
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('clearing')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('clearAllData')}
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    {t('areYouSure')}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      {t('clearDataWarning')}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>{t('allProjects')}</li>
                      <li>{t('aiSettingsAndKeys')}</li>
                      <li>{t('gitCredentialsSettings')}</li>
                      <li>{t('userPreferences')}</li>
                      <li>{t('cachedData')}</li>
                    </ul>
                    <p className="font-medium text-destructive">
                      {t('actionCannotBeUndone')}
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('yesClearAllData')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Save/Cancel Buttons */}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancelSettings}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSaveSettings}>
            <Download className="h-4 w-4 mr-2" />
            {t('saveSettings')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DataSettings;