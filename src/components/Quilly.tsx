import OpenAI from 'openai';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuillySVG } from '@/components/ui/QuillySVG';
import { useAISettings } from '@/hooks/useAISettings';
import { parseProviderModel } from '@/lib/parseProviderModel';
import { useAICredits } from '@/hooks/useAICredits';
import { CreditsDialog } from './CreditsDialog';
import { ProjectPreviewConsoleError } from '@/lib/tools/ReadConsoleMessagesTool';
import { useState } from 'react';

export interface QuillyProps {
  error: Error;
  onDismiss: () => void;
  onNewChat: () => void;
  onOpenModelSelector: () => void;
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

export function Quilly({ error, onDismiss, onNewChat, onOpenModelSelector, onRequestConsoleErrorHelp, providerModel }: QuillyProps) {
  const navigate = useNavigate();
  const { settings } = useAISettings();

  // Handle empty provider model gracefully
  let provider;
  try {
    provider = parseProviderModel(providerModel, settings.providers).provider;
  } catch {
    // If no valid provider model, use a default or undefined
    provider = undefined;
  }

  const credits = useAICredits(provider || { id: '', name: '', apiKey: '', nostr: false });
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  const renderBody = (error: Error): ErrorBody => {
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

    // Handle OpenAI API errors with specific error codes
    if (error instanceof OpenAI.APIError) {
      switch (error.code) {
        case 'invalid_api_key':
        case 'invalid_request_error':
          return {
            message: 'Authentication error: Please check your API key in AI settings.',
            actions: [{
              label: 'Check API key',
              onClick: () => navigate('/settings/ai'),
            }],
          };

        case 'insufficient_quota': {
          if (credits.data) {
            return {
              message: `Your account has $${credits.data.amount.toFixed(2)} credits. Please add credits to keep creating.`,
              actions: [{
                label: 'Add credits',
                onClick: () => setShowCreditsDialog(true),
              }],
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

        case 'rate_limit_exceeded':
          return {
            message: 'Rate limit exceeded. Please wait a moment before trying again.',
            actions: [],
          };

        case 'model_not_found':
          return {
            message: 'The selected AI model is not available. Please choose a different model.',
            actions: [{
              label: 'Choose model',
              onClick: onOpenModelSelector,
            }],
          };

        case 'context_length_exceeded':
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

        case 'bad_request':
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

        case 'unprocessable_entity':
          return {
            message: 'Request rejected by AI provider. Try a different model.',
            actions: [{
              label: 'Choose model',
              onClick: onOpenModelSelector,
            }],
          };

        case 'server_error':
        case 'service_unavailable':
          return {
            message: 'The AI service is temporarily unavailable. Please try again in a moment.',
            actions: [],
          };

        default:
          return {
            message: `AI service error: ${error.message}`,
            actions: [],
          };
      }
    }

    // Default fallback
    return {
      message: error.message
        ? `AI service error: ${error.message}`
        : 'Sorry, I encountered an unexpected error. Please try again.',
      actions: [],
    };
  };

  const { message, actions = [] } = renderBody(error);

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

      <CreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        provider={provider}
      />
    </div>
  );
}