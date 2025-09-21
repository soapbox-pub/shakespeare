import React, { useState, useEffect, useMemo } from 'react';
import { Key, Download, UserPlus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from '@/hooks/useToast';
import { useLoginActions } from '@/hooks/useLoginActions';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { cn } from '@/lib/utils';

type Step = 'extension' | 'key' | 'keygen';

interface SimpleSignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const SimpleSignupDialog: React.FC<SimpleSignupDialogProps> = ({ 
  isOpen, 
  onClose, 
  onComplete 
}) => {
  const [step, setStep] = useState<Step>('key');
  const [isLoading, setIsLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  
  const login = useLoginActions();

  // Generate key once and keep it stable
  const secretKey = useMemo(() => generateSecretKey(), []);
  const nsec = useMemo(() => nip19.nsecEncode(secretKey), [secretKey]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(window.nostr ? 'extension' : 'key');
      setIsLoading(false);
      setDownloaded(false);
    }
  }, [isOpen]);

  const handleExtensionSignup = async () => {
    setIsLoading(true);

    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      await login.extension();
      onClose();
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 600);
      }
    } catch (e: unknown) {
      const error = e as Error;
      toast({
        title: 'Extension signup failed',
        description: error instanceof Error ? error.message : 'Extension signup failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([nsec], { type: 'text/plain; charset=utf-8' });
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'secret-key.txt';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setDownloaded(true);
      toast({
        title: 'Secret Key Saved!',
        description: 'Your key has been safely stored.',
      });
    } catch {
      toast({
        title: 'Download failed',
        description: 'Could not download the key file. Please copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const handleNext = async () => {
    setIsLoading(true);
    try {
      login.nsec(nsec);
      
      // Mark signup completion time for fallback welcome modal
      localStorage.setItem('signup_completed', Date.now().toString());
      
      onClose();
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 600);
      }
    } catch {
      toast({
        title: 'Login Failed',
        description: 'Failed to login with the generated key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginClick = () => {
    onClose();
    // This would typically open the login modal
    // Since we don't have direct access to the login modal state here,
    // we'll rely on the parent component to handle this
  };

  if (step === 'extension') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Sign up</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-6 py-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Welcome to Shakespeare</h3>
            </div>

            <div className="w-32 h-32 flex items-center justify-center">
              <Shield className="w-16 h-16 text-primary" />
            </div>

            <div className="flex flex-col space-y-3 w-full">
              <Button 
                size="lg" 
                onClick={handleExtensionSignup}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Signing up...' : 'Sign up with extension'}
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
                onClick={() => setStep('key')}
                className="w-full"
              >
                Don't have an extension?
              </Button>

              <div className="flex justify-center space-x-2 text-xs">
                <span className="text-muted-foreground">New on Shakespeare?</span>
                <button 
                  onClick={handleLoginClick}
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

  if (step === 'key') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Sign up</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-6 py-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">You need a key to continue</h3>
            </div>

            <div className="w-32 h-32 flex items-center justify-center">
              <Key className="w-16 h-16 text-primary" />
            </div>

            <div className="flex flex-col space-y-3 w-full">
              <Button 
                size="lg" 
                onClick={() => setStep('keygen')}
                className="w-full"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Generate key
              </Button>

              <Button 
                variant="outline" 
                onClick={handleLoginClick}
                className="w-full"
              >
                I already have a key
              </Button>
            </div>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Extension indicator */}
            <div className="rounded-lg bg-muted p-3 w-full">
              <p className="text-xs text-center">
                {window.nostr ? (
                  <button 
                    onClick={handleExtensionSignup}
                    className="text-blue-500 hover:underline"
                    disabled={isLoading}
                  >
                    Sign up with browser extension
                  </button>
                ) : (
                  'Browser extension not found.'
                )}
              </p>
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
          <DialogTitle className="text-center">Your new key</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          <div className="w-32 h-32 flex items-center justify-center">
            <Key className="w-16 h-16 text-primary" />
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Secret Key</label>
              <Input
                type="password"
                value={nsec}
                readOnly
                className="font-mono"
              />
            </div>

            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-justify">
                Back up your secret key in a secure place. If lost, your account cannot be recovered. 
                Never share your secret key with anyone.
              </p>
            </div>

            <div className="flex space-x-3 justify-center">
              <Button 
                variant="outline"
                size="lg" 
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download key
              </Button>

              <Button
                size="lg"
                onClick={handleNext}
                disabled={!downloaded || isLoading}
                className={cn(
                  "flex-1",
                  !downloaded && "opacity-50 cursor-not-allowed"
                )}
                title={!downloaded ? "Download your key to continue" : ""}
              >
                {isLoading ? 'Setting up...' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleSignupDialog;