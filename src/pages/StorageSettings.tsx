import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, AlertTriangle, Loader2, Database, Info, ArrowLeft, Shield, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  isPersistentStorageSupported,
  isPersistentStorageGranted,
  requestPersistentStorage,
  getStorageInfo
} from '@/lib/persistentStorage';
import { FullSystemImportDialog } from '@/components/FullSystemImportDialog';
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

export function StorageSettings() {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRequestingPersistent, setIsRequestingPersistent] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { fs } = useFS();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Format bytes to human readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Load storage information and persistent status
  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        // Check if StorageManager API is available
        if (!isPersistentStorageSupported()) {
          setStorageError('StorageManager API is not available in this browser');
          return;
        }

        // Get storage estimate
        const info = await getStorageInfo();
        if (info) {
          setStorageInfo({
            quota: info.quota,
            usage: info.usage,
            usageDetails: info.usageDetails as StorageUsageDetails,
          });
        }

        // Check if storage is persistent
        const persistent = await isPersistentStorageGranted();
        setIsPersistent(persistent);
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

    // Export localStorage data
    const localStorageData: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          localStorageData[key] = value;
        }
      }
    }

    // Add localStorage data to zip
    zip.file('localStorage.json', JSON.stringify(localStorageData, null, 2));

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

  const handlePersistentStorageToggle = async (checked: boolean) => {
    // If trying to turn off, we can't actually do that - just ignore
    if (!checked) {
      return;
    }

    setIsRequestingPersistent(true);
    try {
      // Check if persist method is available
      if (!isPersistentStorageSupported()) {
        toast({
          title: t('persistentStorageNotSupported'),
          description: t('persistentStorageNotSupportedDescription'),
          variant: "destructive",
        });
        return;
      }

      // Check if already persistent
      const alreadyPersistent = await isPersistentStorageGranted();
      if (alreadyPersistent) {
        setIsPersistent(true);
        toast({
          title: t('persistentStorageAlreadyGranted'),
          description: t('persistentStorageAlreadyGrantedDescription'),
        });
        return;
      }

      // Request persistent storage
      const granted = await requestPersistentStorage();

      if (granted) {
        setIsPersistent(true);
        toast({
          title: t('persistentStorageGranted'),
          description: t('persistentStorageGrantedDescription'),
        });
      } else {
        toast({
          title: t('persistentStorageDenied'),
          description: t('persistentStorageDeniedDescription'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
      toast({
        title: t('failedToRequestPersistentStorage'),
        description: error instanceof Error ? error.message : t('error'),
        variant: "destructive",
      });
    } finally {
      setIsRequestingPersistent(false);
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
              {t('storageSettings')}
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
            {t('storageSettings')}
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

        {/* Persist Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('persistData')}
            </CardTitle>
            <CardDescription>
              {t('persistDataDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-start">
              <Switch
                id="persistent-storage"
                checked={isPersistent === true}
                onCheckedChange={handlePersistentStorageToggle}
                disabled={isRequestingPersistent || isPersistent === null}
              />
            </div>
          </CardContent>
        </Card>

        {/* Export Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('exportSystem')}
            </CardTitle>
            <CardDescription>
              {t('exportSystemDescription')}
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

        {/* Import Full System */}
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <HardDrive className="h-5 w-5" />
              {t('importSystem')}
            </CardTitle>
            <CardDescription>
              {t('importSystemDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FullSystemImportDialog
              onImport={() => {
                // The dialog will handle page reload, but we can add any additional logic here
                console.log('Full system import completed');
              }}
              className="w-full sm:w-auto"
            />
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
      </div>
    </div>
  );
}

export default StorageSettings;