import { APIConnectionError, APIError } from 'openai';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuillySVG } from '@/components/ui/QuillySVG';
import { useAISettings } from '@/hooks/useAISettings';
import { parseProviderModel } from '@/lib/parseProviderModel';
import { useAICredits } from '@/hooks/useAICredits';
import { CreditsDialog } from './CreditsDialog';
import { ProjectPreviewConsoleError } from '@/lib/consoleMessages';
import { useState } from 'react';
import { MalformedToolCallError } from '@/lib/errors/MalformedToolCallError';
import { EmptyMessageError } from '@/lib/errors/EmptyMessageError';
import { AIProvider } from '@/contexts/AISettingsContext';
import { useOffline } from '@/hooks/useOffline';

export interface QuillyProps {
  error: Error;
  onDismiss: () => void;
  onNewChat: () => void;
  onOpenModelSelector: () => void;
  onTryAgain?: () => void;
  onRequestConsoleErrorHelp?: (error: ProjectPreviewConsoleError) => void;
  providerModel: string;
}

interface ErrorBody {
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface QuillyContentProps {
  error: Error;
  onDismiss: () => void;
  onNewChat: () => void;
  onOpenModelSelector: () => void;
  onTryAgain?: () => void;
  onRequestConsoleErrorHelp?: (error: ProjectPreviewConsoleError) => void;
  provider: AIProvider | undefined;
}

function QuillyContent({ error, onDismiss, onNewChat, onOpenModelSelector, onTryAgain, onRequestConsoleErrorHelp, provider }: QuillyContentProps) {
  const navigate = useNavigate();
  const { isOffline } = useOffline();

  const renderBody = (error: Error | APIError | MalformedToolCallError | ProjectPreviewConsoleError): ErrorBody & { showCreditsButton?: boolean } => {
    // Handle Project Preview Console Errors
    if (error instanceof ProjectPreviewConsoleError) {
      return {
        message: 'I noticed some console errors in your project preview. Would you like me to take a look and help fix them?',
        actions: [{
          label: 'Help fix errors',
          onClick: () => {
            onRequestConsoleErrorHelp?.(error);
            onDismiss();
          },
        }],
      };
    }

    if (error instanceof MalformedToolCallError) {
      return {
        message: 'The AI sent an incomplete response, possibly due to a network issue or provider problem. Try sending your message again, or switch to a different model if this persists.',
        actions: [{
          label: 'Change model',
          onClick: onOpenModelSelector,
        }],
      };
    }

    if (error instanceof EmptyMessageError) {
      return {
        message: 'The AI generated an empty response. This may be due to a provider issue or model configuration problem. Try generating again, or switch to a different model.',
        actions: onTryAgain ? [{
          label: 'Try again',
          onClick: () => {
            onTryAgain();
            onDismiss();
          },
        }] : [{
          label: 'Change model',
          onClick: onOpenModelSelector,
        }],
      };
    }

    // Handle OpenAI API errors with specific error codes
    if (error instanceof APIError) {
      switch (true) {
        case error.code ==='invalid_api_key':
        case error.code === 'invalid_request_error':
          return {
            message: 'Authentication error: Please check your API key in AI settings.',
            actions: [{
              label: 'Check API key',
              onClick: () => navigate('/settings/ai'),
            }],
          };

        case error.code === 'insufficient_quota': {
          // Only show credits dialog if we have a provider with nostr enabled
          if (provider?.nostr) {
            return {
              message: 'Your account is low on credits. Please add credits to keep creating.',
              showCreditsButton: true,
              actions: [],
            };
          } else {
            return {
              message: 'Your API key has reached its usage limit. Please check your billing or try a different provider.',
              actions: [{
                label: 'Check AI settings',
                onClick: () => navigate('/settings/ai'),
              }],
            };
          }
        }

        case error.code === 'rate_limit_exceeded':
          return {
            message: 'Rate limit exceeded. Please wait a moment before trying again.',
            actions: [],
          };

        case error.code === 'model_not_found':
          return {
            message: 'The selected AI model is not available. Please choose a different model.',
            actions: [{
              label: 'Choose model',
              onClick: onOpenModelSelector,
            }],
          };

        case error.code === 'context_length_exceeded':
          return {
            message: 'Your conversation is too long for this model. Try starting a new chat or switching to a model with a larger context window.',
            actions: [{
              label: 'New chat',
              onClick: onNewChat,
            }, {
              label: 'Change model',
              onClick: onOpenModelSelector,
            }],
          };

        case error.status === 403:
          return {
            message: `It seems your API key has been used up. Check your API provider's settings, or try a different API key or different provider/model combo:`,
            actions: [{
              label: 'Check API settings',
              onClick: () => navigate('/settings/ai'),
            }, {
              label: 'Change model',
              onClick: onOpenModelSelector,
            }],
          };

        case error.status === 400:
          return {
            message: 'The AI provider did not understand the message / data it got. If it persists, try stating a new conversation or using a different model.',
            actions: [{
              label: 'New chat',
              onClick: onNewChat,
            }, {
              label: 'Change model',
              onClick: onOpenModelSelector,
            }],
          };

        case error.status === 422:
          return {
            message: 'Request rejected by AI provider. Try a different model.',
            actions: [{
              label: 'Choose model',
              onClick: onOpenModelSelector,
            }],
          };

        case error.code === 'server_error':
        case error.code === 'service_unavailable':
          return {
            message: 'The AI service is temporarily unavailable. Please try again in a moment.',
            actions: [],
          };
      }
    }

    if (error instanceof APIConnectionError) {
      return {
        message: isOffline
          ? 'It appears you are offline. Have you tried connecting to the internet?'
          : 'There was a network problem between your device and the AI service.',
        actions: onTryAgain ? [{
          label: 'Try again',
          onClick: () => {
            onTryAgain();
            onDismiss();
          },
        }] : [],
      };
    }

    // Default fallback
    return {
      message: error.message
        ? `AI service error: ${error.message}`
        : 'Sorry, I encountered an unexpected error. Please try again.',
      actions: onTryAgain ? [{
        label: 'Try again',
        onClick: () => {
          onTryAgain();
          onDismiss();
        },
      }] : [],
    };
  };

  const { message, actions = [], showCreditsButton } = renderBody(error);

  return (
    <div className="py-2 px-3 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-start gap-2">
        <QuillySVG className="h-20 px-2 flex-shrink-0" fillColor="hsl(var(--primary))" />
        <div className="flex-1 min-w-0">
          <div className="space-y-1">
            <h4 className="font-semibold text-primary">
              Pardon the interruption
            </h4>
            <p className="text-sm text-muted-foreground">
              {message}
              {showCreditsButton && provider && (
                <>
                  {' '}
                  <QuillyCreditsButton provider={provider} />
                </>
              )}
              {actions.length > 0 && (
                <>
                  {' '}
                  {actions.map((action, i) => (
                    <span key={action.label}>
                      <button className="text-primary underline" onClick={action.onClick}>
                        {action.label}
                      </button>
                      {i < actions.length - 1 && <> or </>}
                    </span>
                  ))}
                </>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-5 w-5 p-0 hover:text-foreground/70 hover:bg-transparent flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface QuillyCreditsButtonProps {
  provider: AIProvider;
}

function QuillyCreditsButton({ provider }: QuillyCreditsButtonProps) {
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const credits = useAICredits(provider);

  return (
    <>
      <button className="text-primary underline" onClick={() => setShowCreditsDialog(true)}>
        {credits.data ? `Add credits (${credits.data.amount.toFixed(2)} remaining)` : 'Add credits'}
      </button>
      <CreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        provider={provider}
      />
    </>
  );
}

export function Quilly({ error, onDismiss, onNewChat, onOpenModelSelector, onTryAgain, onRequestConsoleErrorHelp, providerModel }: QuillyProps) {
  const { settings } = useAISettings();

  // Handle empty provider model gracefully
  let provider: AIProvider | undefined;
  try {
    provider = parseProviderModel(providerModel, settings.providers).provider;
  } catch {
    // If no valid provider model, use a default or undefined
    provider = undefined;
  }

  return (
    <QuillyContent
      error={error}
      onDismiss={onDismiss}
      onNewChat={onNewChat}
      onOpenModelSelector={onOpenModelSelector}
      onTryAgain={onTryAgain}
      onRequestConsoleErrorHelp={onRequestConsoleErrorHelp}
      provider={provider}
    />
  );
}