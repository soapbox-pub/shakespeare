import React, { useState, useEffect } from 'react';
import { Shield, Key, Cloud, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/hooks/useLoginActions';
import { cn } from '@/lib/utils';

type Step = 'extension' | 'key-add';

interface SimpleLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

const validateNsec = (nsec: string) => {
  return /^nsec1[a-zA-Z0-9]{58}$/.test(nsec);
};

const validateBunkerUri = (uri: string) => {
  return uri.startsWith('bunker://');
};

const SimpleLoginDialog: React.FC<SimpleLoginDialogProps> = ({ 
  isOpen, 
  onClose, 
  onLogin, 
  onSignup 
}) => {
  const [step, setStep] = useState<Step>('extension');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [activeTab, setActiveTab] = useState<'nsec' | 'bunker'>('nsec');
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    extension?: string;
  }>({});
  
  const login = useLoginActions();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(window.nostr ? 'extension' : 'key-add');
      setIsLoading(false);
      setNsec('');
      setBunkerUri('');
      setActiveTab('nsec');
      setErrors({});
    }
  }, [isOpen]);

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setErrors(prev => ({ ...prev, extension: undefined }));

    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      await login.extension();
      onLogin();
      onClose();
    } catch (e: unknown) {
      const error = e as Error;
      setErrors(prev => ({
        ...prev,
        extension: error instanceof Error ? error.message : 'Extension login failed'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setErrors(prev => ({ ...prev, nsec: 'Please enter your secret key' }));
      return;
    }

    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: 'Invalid secret key format. Must be a valid nsec starting with nsec1.' }));
      return;
    }

    setIsLoading(true);
    setErrors({});

    setTimeout(() => {
      try {
        login.nsec(nsec);
        onLogin();
        onClose();
      } catch {
        setErrors({ nsec: "Failed to login with this key. Please check that it's correct." });
        setIsLoading(false);
      }
    }, 50);
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setErrors(prev => ({ ...prev, bunker: 'Please enter a bunker URI' }));
      return;
    }

    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: 'Invalid bunker URI format. Must start with bunker://' }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, bunker: undefined }));

    try {
      await login.bunker(bunkerUri);
      onLogin();
      onClose();
      setBunkerUri('');
    } catch {
      setErrors(prev => ({
        ...prev,
        bunker: 'Failed to connect to bunker. Please check the URI.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupClick = () => {
    onClose();
    if (onSignup) {
      onSignup();
    }
  };

  if (step === 'extension') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Log in</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-6 py-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Welcome to Shakespeare</h3>
            </div>

            <div className="w-32 h-32 flex items-center justify-center">
              <Shield className="w-16 h-16 text-primary" />
            </div>

            {errors.extension && (
              <Alert variant="destructive" className="w-full">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errors.extension}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col space-y-3 w-full">
              <Button 
                size="lg" 
                onClick={handleExtensionLogin}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Logging in...' : 'Log in with extension'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setStep('key-add')}
                className="w-full"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Log in with key
              </Button>

              <div className="flex justify-center space-x-2 text-xs">
                <span className="text-muted-foreground">New on Shakespeare?</span>
                <button 
                  onClick={handleSignupClick}
                  className="text-blue-500 hover:underline"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Import Key</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          <div className="w-32 h-32 flex items-center justify-center">
            <Key className="w-16 h-16 text-primary" />
          </div>

          <div className="w-full space-y-4">
            {/* Tab selector */}
            <div className="flex space-x-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveTab('nsec')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'nsec' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Secret Key
              </button>
              <button
                onClick={() => setActiveTab('bunker')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'bunker' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Bunker
              </button>
            </div>

            {activeTab === 'nsec' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="password"
                    value={nsec}
                    onChange={(e) => {
                      setNsec(e.target.value);
                      if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                    }}
                    placeholder="nsec1..."
                    className={errors.nsec ? 'border-red-500' : ''}
                  />
                  {errors.nsec && (
                    <p className="text-sm text-red-500">{errors.nsec}</p>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={handleKeyLogin}
                  disabled={isLoading || !nsec.trim()}
                  className="w-full"
                >
                  {isLoading ? 'Verifying...' : 'Add Key'}
                </Button>
              </div>
            )}

            {activeTab === 'bunker' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    value={bunkerUri}
                    onChange={(e) => {
                      setBunkerUri(e.target.value);
                      if (errors.bunker) setErrors(prev => ({ ...prev, bunker: undefined }));
                    }}
                    placeholder="bunker://"
                    className={errors.bunker ? 'border-red-500' : ''}
                  />
                  {errors.bunker && (
                    <p className="text-sm text-red-500">{errors.bunker}</p>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={handleBunkerLogin}
                  disabled={isLoading || !bunkerUri.trim()}
                  className="w-full"
                >
                  <Cloud className="w-4 h-4 mr-2" />
                  {isLoading ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Extension indicator */}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-center">
                {window.nostr ? (
                  <button 
                    onClick={handleExtensionLogin}
                    className="text-blue-500 hover:underline"
                    disabled={isLoading}
                  >
                    Sign in with browser extension
                  </button>
                ) : (
                  'Browser extension not found.'
                )}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleLoginDialog;