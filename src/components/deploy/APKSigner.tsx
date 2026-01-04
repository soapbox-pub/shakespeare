import { useState, useCallback, useRef, useEffect } from 'react';
import { Key, Upload, Plus, Download, Loader2, CheckCircle, AlertCircle, FileKey, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  signApk,
  generateSigningKey,
  importKeyFromPkcs12,
  exportKeyToPkcs12,
  hasSavedKey,
  getSavedKeyInfo,
  loadSavedKey,
  saveKey,
  deleteSavedKey,
  type SigningKey,
  type StoredKeyInfo,
} from '@/lib/apk';

interface APKSignerProps {
  unsignedApkUrl: string;
  appName: string;
  onComplete: (signedApkBlob: Blob) => void;
  onCancel: () => void;
}

type KeySource = 'saved' | 'upload' | 'generate' | null;
type SigningStatus = 'idle' | 'loading-apk' | 'signing' | 'complete' | 'error';

export function APKSigner({ unsignedApkUrl, appName, onComplete, onCancel }: APKSignerProps) {
  const [keySource, setKeySource] = useState<KeySource>(null);
  const [signingKey, setSigningKey] = useState<SigningKey | null>(null);
  const [status, setStatus] = useState<SigningStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  // Saved key state
  const [savedKeyInfo, setSavedKeyInfo] = useState<StoredKeyInfo | null>(null);
  const [savedKeyPassword, setSavedKeyPassword] = useState('');
  const [saveKeyAfter, setSaveKeyAfter] = useState(true);

  // Upload form state
  const [uploadPassword, setUploadPassword] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate form state
  const [generateName, setGenerateName] = useState(appName || 'My App');
  const [generateOrg, setGenerateOrg] = useState('');
  const [generatePassword, setGeneratePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check for saved key on mount
  useEffect(() => {
    if (hasSavedKey()) {
      const info = getSavedKeyInfo();
      setSavedKeyInfo(info);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setError(null);
    }
  }, []);

  const handleLoadSavedKey = useCallback(() => {
    if (!savedKeyPassword) {
      setError('Please enter the password');
      return;
    }

    try {
      const key = loadSavedKey(savedKeyPassword);
      setSigningKey(key);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved key');
    }
  }, [savedKeyPassword]);

  const handleDeleteSavedKey = useCallback(() => {
    deleteSavedKey();
    setSavedKeyInfo(null);
    setKeySource(null);
  }, []);

  const handleImportKeystore = useCallback(async () => {
    if (!uploadFile || !uploadPassword) {
      setError('Please select a file and enter the password');
      return;
    }

    try {
      setStatus('loading-apk');
      setProgress('Reading keystore...');

      const arrayBuffer = await uploadFile.arrayBuffer();
      const key = importKeyFromPkcs12(arrayBuffer, uploadPassword);

      // Save key if requested
      if (saveKeyAfter) {
        saveKey(key, uploadPassword);
        setSavedKeyInfo(getSavedKeyInfo());
      }

      setSigningKey(key);
      setError(null);
      setStatus('idle');
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import keystore');
      setStatus('error');
    }
  }, [uploadFile, uploadPassword, saveKeyAfter]);

  const handleGenerateKeystore = useCallback(() => {
    if (!generateName.trim()) {
      setError('Please enter an app/key name');
      return;
    }

    if (!generatePassword) {
      setError('Please enter a password');
      return;
    }

    if (generatePassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (generatePassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setProgress('Generating key pair...');
      const key = generateSigningKey({
        commonName: generateName.trim(),
        organizationName: generateOrg.trim() || undefined,
      });

      // Save key if requested
      if (saveKeyAfter) {
        saveKey(key, generatePassword);
        setSavedKeyInfo(getSavedKeyInfo());
      }

      setSigningKey(key);
      setError(null);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keystore');
    }
  }, [generateName, generateOrg, generatePassword, confirmPassword, saveKeyAfter]);

  const handleDownloadKeystore = useCallback(() => {
    if (!signingKey) return;

    const password = keySource === 'generate' ? generatePassword : uploadPassword;
    const p12Data = exportKeyToPkcs12(signingKey, password);
    const blob = new Blob([p12Data], { type: 'application/x-pkcs12' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${appName.replace(/[^a-zA-Z0-9]/g, '_')}_release_key.p12`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [signingKey, keySource, generatePassword, uploadPassword, appName]);

  const handleSign = useCallback(async () => {
    if (!signingKey) {
      setError('No signing key configured');
      return;
    }

    try {
      setStatus('loading-apk');
      setProgress('Downloading unsigned APK...');
      setError(null);

      // Fetch the unsigned APK
      const response = await fetch(unsignedApkUrl);
      if (!response.ok) {
        throw new Error(`Failed to download APK: ${response.status} ${response.statusText}`);
      }

      const apkData = await response.arrayBuffer();
      const sizeMB = (apkData.byteLength / 1024 / 1024).toFixed(2);
      setProgress(`Downloaded ${sizeMB} MB. Signing APK...`);
      setStatus('signing');

      // Sign the APK
      const signedApk = await signApk({
        key: signingKey,
        apkData,
      });

      setStatus('complete');
      setProgress('');
      onComplete(signedApk);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign APK');
      setStatus('error');
    }
  }, [signingKey, unsignedApkUrl, onComplete]);

  const renderKeySourceSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Configure Signing Key</span>
      </div>

      {/* Saved key option */}
      {savedKeyInfo && (
        <button
          type="button"
          onClick={() => setKeySource('saved')}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
            keySource === 'saved'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{savedKeyInfo.commonName}</p>
            <p className="text-xs text-muted-foreground">
              Saved key • Expires {new Date(savedKeyInfo.expiresAt).getFullYear()}
            </p>
          </div>
          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setKeySource('upload')}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
            keySource === 'upload'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Upload Keystore</span>
          <span className="text-xs text-muted-foreground text-center">
            Use existing .p12 or .pfx file
          </span>
        </button>

        <button
          type="button"
          onClick={() => setKeySource('generate')}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
            keySource === 'generate'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <Plus className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Generate New</span>
          <span className="text-xs text-muted-foreground text-center">
            Create a new signing key
          </span>
        </button>
      </div>
    </div>
  );

  const renderSavedKeyForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Use Saved Key</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setKeySource(null)}>
          Back
        </Button>
      </div>

      {savedKeyInfo && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{savedKeyInfo.commonName}</p>
            <p className="text-xs text-muted-foreground">
              Expires {new Date(savedKeyInfo.expiresAt).getFullYear()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteSavedKey}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="saved-key-password">Password</Label>
          <Input
            id="saved-key-password"
            type="password"
            value={savedKeyPassword}
            onChange={(e) => setSavedKeyPassword(e.target.value)}
            placeholder="Enter password to unlock key"
          />
        </div>

        <Button
          onClick={handleLoadSavedKey}
          disabled={!savedKeyPassword}
          className="w-full"
        >
          Unlock Key
        </Button>
      </div>
    </div>
  );

  const renderUploadForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Upload Keystore</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setKeySource(null)}>
          Back
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Keystore File (.p12 / .pfx)</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={uploadFile?.name || ''}
              placeholder="Select a keystore file..."
              readOnly
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".p12,.pfx,.jks,.keystore"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            PKCS#12 format (.p12 / .pfx). For JKS files, convert first using keytool.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="keystore-password">Keystore Password</Label>
          <Input
            id="keystore-password"
            type="password"
            value={uploadPassword}
            onChange={(e) => setUploadPassword(e.target.value)}
            placeholder="Enter keystore password"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="save-upload-key"
            checked={saveKeyAfter}
            onCheckedChange={(checked) => setSaveKeyAfter(checked === true)}
          />
          <Label htmlFor="save-upload-key" className="text-sm font-normal cursor-pointer">
            Remember this key for future builds
          </Label>
        </div>

        <Button
          onClick={handleImportKeystore}
          disabled={!uploadFile || !uploadPassword}
          className="w-full"
        >
          Import Keystore
        </Button>
      </div>
    </div>
  );

  const renderGenerateForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Generate New Key</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setKeySource(null)}>
          Back
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="key-name">Name (Common Name)</Label>
          <Input
            id="key-name"
            value={generateName}
            onChange={(e) => setGenerateName(e.target.value)}
            placeholder="My App"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="key-org">Organization (optional)</Label>
          <Input
            id="key-org"
            value={generateOrg}
            onChange={(e) => setGenerateOrg(e.target.value)}
            placeholder="My Company"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="key-password">Password</Label>
          <Input
            id="key-password"
            type="password"
            value={generatePassword}
            onChange={(e) => setGeneratePassword(e.target.value)}
            placeholder="Enter password (min 6 characters)"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="key-confirm">Confirm Password</Label>
          <Input
            id="key-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="save-generated-key"
            checked={saveKeyAfter}
            onCheckedChange={(checked) => setSaveKeyAfter(checked === true)}
          />
          <Label htmlFor="save-generated-key" className="text-sm font-normal cursor-pointer">
            Remember this key for future builds
          </Label>
        </div>

        <Button
          onClick={handleGenerateKeystore}
          disabled={!generateName || !generatePassword || !confirmPassword}
          className="w-full"
        >
          Generate Key
        </Button>
      </div>
    </div>
  );

  const renderKeyReady = () => (
    <div className="space-y-4">
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Signing key ready: <strong>{signingKey?.alias}</strong>
        </AlertDescription>
      </Alert>

      {keySource === 'generate' && (
        <Alert>
          <FileKey className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p><strong>Important:</strong> Save your keystore file! You'll need it for future updates.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadKeystore}
              className="mt-2"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Keystore (.p12)
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setSigningKey(null);
            setKeySource(null);
          }}
          className="flex-1"
        >
          Change Key
        </Button>
        <Button
          onClick={handleSign}
          disabled={status === 'loading-apk' || status === 'signing'}
          className="flex-1"
        >
          {status === 'loading-apk' || status === 'signing' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <Key className="h-4 w-4 mr-2" />
              Sign APK
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {progress && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      )}

      <div className="rounded-lg border p-4">
        {signingKey ? (
          renderKeyReady()
        ) : keySource === 'saved' ? (
          renderSavedKeyForm()
        ) : keySource === 'upload' ? (
          renderUploadForm()
        ) : keySource === 'generate' ? (
          renderGenerateForm()
        ) : (
          renderKeySourceSelection()
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
