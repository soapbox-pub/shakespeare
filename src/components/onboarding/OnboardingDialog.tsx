import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { WelcomeStep } from './WelcomeStep';
import { AISettingsStep } from './AISettingsStep';
import { ProjectStep } from './ProjectStep';

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (projectId: string) => void;
  onComplete: () => void;
  currentStep: number;
  onNextStep: () => void;
  onPreviousStep: () => void;
  initialPrompt?: string;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'ai-settings', title: 'AI Settings' },
  { id: 'project', title: 'Create Project' },
];

export function OnboardingDialog({
  open,
  onOpenChange,
  onProjectCreated,
  onComplete,
  currentStep: propCurrentStep,
  onNextStep,
  onPreviousStep,
  initialPrompt = ''
}: OnboardingDialogProps) {
  const [localStep, setLocalStep] = useState(propCurrentStep);

  // Sync local step with prop when it changes
  useEffect(() => {
    setLocalStep(propCurrentStep);
  }, [propCurrentStep]);

  const currentStep = Math.min(localStep, STEPS.length - 1);
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setLocalStep(prev => prev + 1);
      onNextStep();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setLocalStep(prev => prev - 1);
      onPreviousStep();
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (STEPS[currentStep]?.id) {
      case 'welcome':
        return (
          <WelcomeStep
            onNext={handleNext}
            onSkip={handleSkip}
          />
        );
      case 'ai-settings':
        return (
          <AISettingsStep
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
          />
        );
      case 'project':
        return (
          <ProjectStep
            onNext={handleSkip} // Skip to complete
            onPrevious={handlePrevious}
            onComplete={handleComplete}
            onProjectCreated={onProjectCreated}
            initialPrompt={initialPrompt}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl md:max-w-4xl">
        <div className="sticky top-0 bg-background border-b p-4 sm:p-5 pb-3 z-10">
          <DialogTitle className="sr-only">Getting Started Onboarding</DialogTitle>
          <DialogDescription className="sr-only">Complete the onboarding process to get started with Shakespeare</DialogDescription>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold">Getting Started</h2>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {currentStep + 1} / {STEPS.length}
              </span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-1.5" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs text-muted-foreground">
              {STEPS.map((step, index) => (
                <span
                  key={step.id}
                  className={`text-center ${index <= currentStep ? 'text-primary font-medium' : ''} truncate`}
                >
                  {step.title}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-2 sm:p-6">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}