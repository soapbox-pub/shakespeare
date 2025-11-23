import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useAIProjectId } from '@/hooks/useAIProjectId';
import { useFS } from '@/hooks/useFS';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useIsMobile } from '@/hooks/useIsMobile';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ModelSelector } from '@/components/ModelSelector';
import { FileAttachment } from '@/components/ui/file-attachment';
import { ArrowUp } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { AppShowcase } from '@/components/AppShowcase';

export default function Index() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [storedPrompt, setStoredPrompt] = useLocalStorage('shakespeare-draft-prompt', '');
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
  const { settings, addRecentlyUsedModel } = useAISettings();
  const { config } = useAppContext();
  const [providerModel, setProviderModel] = useState(() => {
    // Initialize with first recently used model if available, otherwise empty
    return settings.recentlyUsedModels?.[0] || '';
  });
  const isMobile = useIsMobile();
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [quillyError, setQuillyError] = useState<Error | null>(null);

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

  // Restore prompt from local storage on mount
  useEffect(() => {
    if (storedPrompt) {
      setPrompt(storedPrompt);
    }
  }, [storedPrompt]);

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

  // Sync prompt with local storage
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    setStoredPrompt(newPrompt);
  };

  const handleFileSelect = (file: File) => {
    setAttachedFiles(prev => [...prev, file]);
  };

  const handleFileRemove = (fileToRemove: File) => {
    setAttachedFiles(prev => prev.filter(file => file !== fileToRemove));
  };

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

    if (isCreating || isGeneratingId || !providerModel.trim()) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Add all files without validation
    setAttachedFiles(prev => [...prev, ...files]);
  };

  // Handle keyboard shortcuts (physical keyboards only)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // On mobile devices, always allow Enter to create new lines
      // since there's no Shift key available for multi-line input
      if (isMobile) {
        return;
      }

      if (e.shiftKey) {
        // Shift+Enter on desktop: Allow new line (default behavior)
        return;
      }

      // Enter without Shift on desktop: Submit only if no newlines exist in prompt and model is selected
      if (!prompt.includes('\n') && providerModel.trim()) {
        e.preventDefault();
        handleCreateProject();
      }
      // If prompt contains newlines or no model selected, allow Enter to create new line (default behavior)
    }
  };

  // Handle textarea click - show onboarding if no providers configured
  const handleTextareaClick = () => {
    if (!hasProvidersConfigured) {
      setShowOnboarding(true);
    }
  };

  // Quilly handlers
  const handleQuillyDismiss = () => {
    setQuillyError(null);
  };

  const handleQuillyNewChat = () => {
    // Clear current prompt and start fresh
    setPrompt('');
    setStoredPrompt('');
    setAttachedFiles([]);
    setQuillyError(null);
  };

  const handleQuillyOpenModelSelector = () => {
    // Focus on model selector or open AI settings if no providers
    if (!hasProvidersConfigured) {
      setShowOnboarding(true);
    }
    setQuillyError(null);
  };

  const handleCreateProject = async () => {
    if (!prompt.trim() || !providerModel.trim()) return;

    // Clear stored prompt when creating project
    setStoredPrompt('');

    setIsCreating(true);
    try {
      // Use AI to generate project ID
      const projectId = await generateProjectId(providerModel, prompt.trim());

      // Add model to recently used when creating project with AI
      addRecentlyUsedModel(providerModel.trim());

      // Create project with AI-generated ID
      const project = await projectsManager.createProject(prompt.trim(), config.projectTemplate, projectId);

      // Build message content from input and attached files
      // Images are converted to base64-encoded data URLs
      const messageContent = await buildMessageContent(
        prompt.trim(),
        attachedFiles,
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

      // Clear attached files after successful creation
      setAttachedFiles([]);

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

            {/* Chat Input Container - matching the ChatPane style */}
            <div
              className={`relative rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all ${isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Textarea
                placeholder={
                  !hasProvidersConfigured
                    ? t('examplePrompt')
                    : !providerModel.trim()
                      ? t('selectModelToDescribe')
                      : t('examplePrompt')
                }
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                onClick={handleTextareaClick}
                className="min-h-[120px] max-h-64 resize-none border-0 bg-transparent px-4 py-3 pb-16 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                disabled={isCreating || isGeneratingId || (hasProvidersConfigured && !providerModel.trim())}
                rows={4}
                style={{
                  height: 'auto',
                  minHeight: '120px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 256) + 'px';
                }}
              />

              {/* Bottom Controls Row */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end gap-4 overflow-hidden">
                {/* File Attachment */}
                <FileAttachment
                  className="mr-auto"
                  onFileSelect={handleFileSelect}
                  onFileRemove={handleFileRemove}
                  selectedFiles={attachedFiles}
                  disabled={isCreating || isGeneratingId}
                  multiple={true}
                />

                {/* Model Selector - always show to allow configuration */}
                <div className="overflow-hidden">
                  <ModelSelector
                    value={providerModel}
                    onChange={setProviderModel}
                    className="w-full"
                    disabled={isCreating || isGeneratingId}
                    placeholder={t('chooseModel')}
                  />
                </div>

                {/* Create Project Button */}
                <Button
                  onClick={handleCreateProject}
                  disabled={
                    !prompt.trim() ||
                    isCreating ||
                    isGeneratingId ||
                    (hasProvidersConfigured && !providerModel.trim())
                  }
                  size="sm"
                  className="size-8 [&_svg]:size-5 rounded-full p-0"
                >
                  {isCreating || isGeneratingId ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  ) : (
                    <ArrowUp />
                  )}
                </Button>
              </div>
            </div>
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