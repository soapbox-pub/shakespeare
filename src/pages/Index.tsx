import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useAIProjectId } from '@/hooks/useAIProjectId';
import { useFS } from '@/hooks/useFS';
import { useAISettings } from '@/hooks/useAISettings';
import { useAppContext } from '@/hooks/useAppContext';
import { AppLayout } from '@/components/AppLayout';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { Act1Dialog } from '@/components/Act1Dialog';
import { GiftCardRedeemDialog } from '@/components/GiftCardRedeemDialog';
import { Quilly } from '@/components/Quilly';
import { DotAI } from '@/lib/DotAI';
import type { AIMessage } from '@/lib/SessionManager';
import { buildMessageContent } from '@/lib/buildMessageContent';
import { ChatInput } from '@/components/Shakespeare/ChatInput';
import { useSeoMeta } from '@unhead/react';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { AppShowcase } from '@/components/AppShowcase';
import { useToast } from '@/hooks/useToast';

export default function Index() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAct1Dialog, setShowAct1Dialog] = useState(false);
  const [showGiftCardDialog, setShowGiftCardDialog] = useState(false);
  const [giftCardBaseURL, setGiftCardBaseURL] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const projectsManager = useProjectsManager();
  const { fs } = useFS();
  const { generateProjectId, isLoading: isGeneratingId } = useAIProjectId();
  const { settings, addRecentlyUsedModel, isConfigured } = useAISettings();
  const { config } = useAppContext();
  const [providerModel, setProviderModel] = useState(() => {
    // Initialize with first recently used model if available, otherwise empty
    return settings.recentlyUsedModels?.[0] || '';
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [quillyError, setQuillyError] = useState<Error | null>(null);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);

  // Check if any providers are configured
  const hasProvidersConfigured = settings.providers.length > 0;

  useEffect(() => {
    if (!providerModel && settings.recentlyUsedModels?.length) {
      setProviderModel(settings.recentlyUsedModels[0]);
    }
  }, [providerModel, settings.recentlyUsedModels]);

  useSeoMeta({
    title: 'Shakespeare - Open Source AI Builder',
    description: 'Build custom apps with AI assistance using Shakespeare, an AI-powered development environment.',
  });


  // Check for Act 1 users and show welcome dialog
  useEffect(() => {
    if (localStorage.getItem('selectedNSPAddr')) {
      setShowAct1Dialog(true);
    }
  }, []);

  // Handle gift card redemption from URL
  useEffect(() => {
    // Check if we're on the /giftcard route
    if (location.pathname === '/giftcard') {
      // Parse hash parameters
      const hash = location.hash.slice(1); // Remove the '#'
      const params = new URLSearchParams(hash);
      const baseURL = params.get('baseURL');
      const code = params.get('code');

      if (baseURL && code) {
        // Store the gift card details
        setGiftCardBaseURL(baseURL);
        setGiftCardCode(code);
        setShowGiftCardDialog(true);

        // Rewrite URL to '/' for privacy
        navigate('/', { replace: true });
      } else {
        // Invalid gift card URL, just navigate to home
        navigate('/', { replace: true });
      }
    }
  }, [location, navigate]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only reset drag state if we're actually leaving the container
    // This prevents flickering when dragging over child elements
    const container = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;

    if (!container.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  // Handle textarea focus - show onboarding if no providers configured
  const handleTextareaFocus = () => {
    if (!hasProvidersConfigured) {
      setShowOnboarding(true);
    }
  };

  // Quilly handlers
  const handleQuillyDismiss = () => {
    setQuillyError(null);
  };

  const handleQuillyNewChat = () => {
    // Clear error - ChatInput manages its own state
    setQuillyError(null);
  };

  const handleQuillyOpenModelSelector = () => {
    // Focus on model selector or open AI settings if no providers
    if (!hasProvidersConfigured) {
      setShowOnboarding(true);
    }
    setQuillyError(null);
  };

  const handleSend = async (input: string, files: File[]) => {
    if (!input.trim() && files.length === 0) return;
    if (!providerModel.trim()) return;

    setIsCreating(true);
    try {
      // Use AI to generate project ID
      const projectId = await generateProjectId(providerModel, input.trim());

      // Add model to recently used when creating project with AI
      addRecentlyUsedModel(providerModel.trim());

      // Create project with AI-generated ID and handle template update errors
      const project = await projectsManager.createProject(
        input.trim(),
        config.projectTemplate,
        projectId,
        () => {
          // Show a toast if template update fails (non-critical)
          toast({
            title: t('templateUpdateFailed'),
            description: t('templateUpdateFailedDescription'),
            variant: 'default',
          });
        }
      );

      // Build message content from input and attached files
      // Images are converted to base64-encoded data URLs
      const messageContent = await buildMessageContent(
        input.trim(),
        files,
        fs,
        undefined
      );

      // Store the initial message in chat history using DotAI
      const dotAI = new DotAI(fs, `${config.fsPathProjects}/${project.id}`);
      const sessionName = DotAI.generateSessionName();

      const initialMessage: AIMessage = {
        role: 'user',
        content: messageContent
      };
      await dotAI.setHistory(sessionName, [initialMessage]);

      // Navigate to the project with autostart parameter and model
      const searchParams = new URLSearchParams({
        autostart: 'true',
        build: 'true',
        ...(providerModel.trim() && { model: providerModel.trim() })
      });
      navigate(`/project/${project.id}?${searchParams.toString()}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      setQuillyError(error instanceof Error ? error : new Error("An unexpected error occurred"));
    } finally {
      setIsCreating(false);
    }
  };

  const headerContent = null;

  return (
    <>
      <AppLayout headerContent={headerContent}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <div className="mb-4 md:mb-6">
              <ShakespeareLogo className="w-20 h-20 md:w-24 md:h-24 mx-auto" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('buildNostrApps')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              {t('whatToBuild')}
            </p>
          </div>

          <div className="mb-8 md:mb-12">
            {/* Quilly Helper - shows when there are errors */}
            {quillyError && (
              <div className="mb-4">
                <Quilly
                  error={quillyError}
                  onDismiss={handleQuillyDismiss}
                  onNewChat={handleQuillyNewChat}
                  onOpenModelSelector={handleQuillyOpenModelSelector}
                  providerModel={providerModel}
                />
              </div>
            )}

            {/* Chat Input */}
            <ChatInput
              isLoading={isCreating || isGeneratingId}
              isConfigured={hasProvidersConfigured}
              providerModel={providerModel}
              onProviderModelChange={setProviderModel}
              onSend={handleSend}
              onStop={() => {
                // No-op for Index page - project creation can't be stopped
              }}
              onFocus={handleTextareaFocus}
              onFirstInteraction={() => {
                // No-op for Index page
              }}
              isModelSelectorOpen={isModelSelectorOpen}
              onModelSelectorOpenChange={setIsModelSelectorOpen}
              contextUsagePercentage={0}
              totalCost={0}
              isDragOver={isDragOver}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          </div>
        </div>

        {/* App Showcase */}
        <AppShowcase />

        {/* Version Display */}
        {import.meta.env.VERSION && (
          <div className="text-center text-xs text-muted-foreground/60 pt-8 pb-4">
            v{import.meta.env.VERSION}
          </div>
        )}
      </AppLayout>

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />

      {/* Act 1 Welcome Dialog */}
      <Act1Dialog
        open={showAct1Dialog}
        onOpenChange={setShowAct1Dialog}
      />

      {/* Gift Card Redeem Dialog */}
      {giftCardBaseURL && giftCardCode && (
        <GiftCardRedeemDialog
          open={showGiftCardDialog}
          onOpenChange={setShowGiftCardDialog}
          baseURL={giftCardBaseURL}
          code={giftCardCode}
        />
      )}
    </>
  );
}