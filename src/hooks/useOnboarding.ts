import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    'shakespeare-onboarding-completed',
    false
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Check if onboarding should be shown on first load
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      setIsOnboardingOpen(true);
    }
  }, [hasCompletedOnboarding]);

  const handleNextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 2));
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleCompleteOnboarding = () => {
    setHasCompletedOnboarding(true);
    setIsOnboardingOpen(false);
    setCurrentStep(0);
  };

  const handleRestartOnboarding = () => {
    setCurrentStep(0);
    setIsOnboardingOpen(true);
  };

  return {
    hasCompletedOnboarding,
    currentStep,
    isOnboardingOpen,
    setIsOnboardingOpen,
    handleNextStep,
    handlePreviousStep,
    handleCompleteOnboarding,
    handleRestartOnboarding,
  };
}