import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useAIProjectId } from '@/hooks/useAIProjectId';
import { useFS } from '@/hooks/useFS';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAISettings } from '@/hooks/useAISettings';
import { AppLayout } from '@/components/AppLayout';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { DotAI } from '@/lib/DotAI';
import type { AIMessage } from '@/lib/SessionManager';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ModelSelector } from '@/components/ModelSelector';
import { FileAttachment } from '@/components/ui/file-attachment';
import { Plus } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';

export default function Index() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [storedPrompt, setStoredPrompt] = useLocalStorage('shakespeare-draft-prompt', '');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { fs } = useFS();
  const { generateProjectId, isLoading: isGeneratingId } = useAIProjectId();
  const { settings, addRecentlyUsedModel } = useAISettings();
  const [providerModel, setProviderModel] = useState(() => {
    // Initialize with first recently used model if available, otherwise empty
    return settings.recentlyUsedModels?.[0] || '';
  });
  const isMobile = useIsMobile();
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Check if any providers are configured
  const hasProvidersConfigured = Object.keys(settings.providers).length > 0;

  useEffect(() => {
    if (!providerModel && settings.recentlyUsedModels?.length) {
      setProviderModel(settings.recentlyUsedModels[0]);
    }
  }, [providerModel, settings.recentlyUsedModels]);

  useSeoMeta({
    title: 'Shakespeare - AI-Powered Nostr Development',
    description: 'Build custom Nostr websites with AI assistance using Shakespeare, an AI-powered development environment.',
  });

  // Restore prompt from local storage on mount
  useEffect(() => {
    if (storedPrompt) {
      setPrompt(storedPrompt);
    }
  }, [storedPrompt]);

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
      const project = await projectsManager.createProject(prompt.trim(), projectId);

      // Store the initial message in chat history using DotAI
      const dotAI = new DotAI(fs, `/projects/${project.id}`);
      const sessionName = DotAI.generateSessionName();
      // Create initial message with content parts
      const initialMessage: AIMessage = {
        role: 'user',
        content: prompt.trim()
      };
      await dotAI.setHistory(sessionName, [initialMessage]);

      // Clear attached files after successful creation
      setAttachedFiles([]);

      // Navigate to the project with autostart parameter and model
      const searchParams = new URLSearchParams({
        autostart: 'true',
        ...(providerModel.trim() && { model: providerModel.trim() })
      });
      navigate(`/project/${project.id}?${searchParams.toString()}`);
    } catch (error) {
      console.error('Failed to create project:', error);
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
            <div className="text-4xl md:text-6xl mb-4 md:mb-6">🎭</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('buildNostrApps')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              {t('whatToBuild')}
            </p>
          </div>

          <div className="mb-8 md:mb-12">
            {/* Chat Input Container - matching the ChatPane style */}
            <div
              className={`relative rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all ${
                isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''
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
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end gap-2 overflow-hidden">
                {/* File Attachment */}
                <FileAttachment
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
                  className="h-8 rounded-lg"
                >
                  {isCreating || isGeneratingId ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      {isGeneratingId ? t('generating') : t('creating')}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-3 w-3" />
                      {t('createProject')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />
    </>
  );
}