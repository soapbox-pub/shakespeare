import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Download, Upload, ExternalLink, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { useAISettings } from '@/hooks/useAISettings';
import { useAICredits } from '@/hooks/useAICredits';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface Act1DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogStep = 'welcome' | 'migration' | 'credits' | 'conclusion';

const SHAKESPEARE_PROVIDER = {
  id: "shakespeare",
  baseURL: "https://ai.shakespeare.diy/v1",
  nostr: true,
};

const MKSTACK_NSP_ADDR = '31999:4bcaa7b5606e3c14df05cd497e588f5d3fe559b4e9a425e8b418a43af1ffb015:mkstack';

export function Act1Dialog({ open, onOpenChange }: Act1DialogProps) {
  const [step, setStep] = useState<DialogStep>('welcome');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const { setProvider, updateSettings } = useAISettings();

  // Get the selectedNSPAddr from localStorage
  const [selectedNSPAddr] = useLocalStorage<string | null>('selectedNSPAddr', null);

  // Get user's credits
  const { data: creditsData } = useAICredits(SHAKESPEARE_PROVIDER);

  const handleGetStarted = async () => {
    setIsSettingUp(true);

    try {
      // Add Shakespeare provider to their config
      setProvider(SHAKESPEARE_PROVIDER);

      // Configure recently used models based on credits or NSP
      const hasCredits = creditsData?.amount && creditsData.amount > 0;
      const hasMKStackNSP = selectedNSPAddr === MKSTACK_NSP_ADDR;

      if (hasCredits || hasMKStackNSP) {
        // User has credits or MKStack NSP - set to shakespeare model
        updateSettings({ recentlyUsedModels: ['shakespeare/shakespeare'] });
      } else {
        // No credits - set to tybalt model (free)
        updateSettings({ recentlyUsedModels: ['shakespeare/tybalt'] });
      }

      // Move to migration step
      setStep('migration');
    } catch (error) {
      console.error('Failed to configure Shakespeare provider:', error);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleContinue = () => {
    setStep('credits');
  };

  const handleCreditsNext = () => {
    setStep('conclusion');
  };

  const handleFinish = () => {
    // Remove the selectedNSPAddr from localStorage
    localStorage.removeItem('selectedNSPAddr');
    onOpenChange(false);
  };

  const handleVisitAct1 = () => {
    window.open('https://act1.shakespeare.diy', '_blank');
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('welcome');
      setIsSettingUp(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'migration' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('welcome')}
                className="mr-2 p-1 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'credits' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('migration')}
                className="mr-2 p-1 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'conclusion' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('credits')}
                className="mr-2 p-1 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-xl">
              {step === 'welcome' && 'Welcome to Shakespeare: Act 2! 🎭'}
              {step === 'migration' && 'Migrating Your Projects'}
              {step === 'credits' && 'Your Credits'}
              {step === 'conclusion' && "You're All Set!"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
          <div className="space-y-6 py-4">
            {step === 'welcome' && (
              <div className="text-center space-y-6">
                <div className="text-6xl mb-4">🎭✨</div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Welcome to Act 2!
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                    We're excited to see you again! Shakespeare has been completely rebuilt
                    with new features, improved performance, and a better development experience.
                  </p>
                </div>

                <Card className="max-w-lg mx-auto text-left">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-2xl">🔄</span>
                      What's Changed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-0.5">New</Badge>
                      <div>
                        <p className="font-medium">Enhanced AI Capabilities</p>
                        <p className="text-sm text-muted-foreground">More powerful models and better code generation</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-0.5">New</Badge>
                      <div>
                        <p className="font-medium">Improved Git Integration</p>
                        <p className="text-sm text-muted-foreground">Better version control with credential management</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-0.5">New</Badge>
                      <div>
                        <p className="font-medium">Project Import/Export</p>
                        <p className="text-sm text-muted-foreground">Easily migrate your projects between versions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-w-lg mx-auto">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                    <div className="text-left">
                      <p className="font-medium text-amber-800 dark:text-amber-200">Act 2 is in Development</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        While we're working hard to make Act 2 stable, you may encounter bugs.
                        Your Act 1 projects remain safe and accessible.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleGetStarted}
                  disabled={isSettingUp}
                  size="lg"
                  className="gap-2"
                >
                  {isSettingUp ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Configure Act 2
                    </>
                  )}
                </Button>
              </div>
            )}

            {step === 'migration' && (
              <div className="space-y-6">
                <div className="text-center space-y-3">
                  <h2 className="text-xl font-bold">Your Act 1 Projects & Credits</h2>
                  <p className="text-muted-foreground max-w-lg mx-auto">
                    All your Act 1 projects and credits are safe and still accessible.
                    Here's how to work with them in Act 2.
                  </p>
                </div>

                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ExternalLink className="h-5 w-5 text-blue-500" />
                        Access Act 1
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Your original Shakespeare (Act 1) is still available with all your projects and data intact.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleVisitAct1}
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Visit Act 1
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Download className="h-5 w-5 text-green-500" />
                        Export from Act 1
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        In Act 1, you can export your projects as ZIP files using the project menu or settings.
                      </p>
                      <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                        💡 Tip: Export projects you want to continue working on in Act 2
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Upload className="h-5 w-5 text-purple-500" />
                        Import to Act 2
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        In Act 2, use the "Import Project" option in the sidebar to upload your exported ZIP files.
                      </p>
                      <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                        💡 Tip: Look for the import button in the project sidebar
                      </div>
                    </CardContent>
                  </Card>


                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleContinue}
                    className="gap-2"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'credits' && (
              <div className="text-center space-y-6">
                <div className="text-6xl mb-4">💳</div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold">Your Credits</h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    Your Act 1 credits are still available through the Shakespeare AI provider.
                  </p>
                </div>

                <Card className="max-w-md mx-auto">
                  <CardContent className="pt-6">
                    {creditsData?.amount && creditsData.amount > 0 ? (
                      <div className="text-center space-y-4">
                        <div className="space-y-2">
                          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            ${creditsData.amount.toFixed(2)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Available credits
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <p className="text-sm text-green-800 dark:text-green-200">
                            ✅ You're all set! We've configured the premium Shakespeare model for you.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="space-y-2">
                          <div className="text-2xl">🆓</div>
                          <p className="font-medium">Free Access</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            You can continue using Shakespeare for free with the Tybalt model.
                            It's perfect for learning and building amazing projects!
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleCreditsNext}
                    className="gap-2"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'conclusion' && (
              <div className="text-center space-y-6">
                <div className="text-5xl mb-4">🎉</div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold">Welcome to the Future!</h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    You're all set up with Act 2! Your AI assistant is configured
                    and ready to help you build amazing Nostr applications.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground italic">
                    "Create a decentralized social media app with custom feeds and real-time messaging..."
                  </p>
                </div>

                <div className="space-y-3">
                  <Button onClick={handleFinish} size="lg" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Start Building in Act 2
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Remember: You can always access Act 1 at{' '}
                    <button
                      onClick={handleVisitAct1}
                      className="text-primary hover:underline"
                    >
                      act1.shakespeare.diy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}