import OpenAI from 'openai';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuillySVG } from '@/components/ui/QuillySVG';
import { useAISettings } from '@/hooks/useAISettings';
import { parseProviderModel } from '@/lib/parseProviderModel';
import { useAICredits } from '@/hooks/useAICredits';
import { CreditsDialog } from './CreditsDialog';
import { useState } from 'react';

export interface QuillyProps {
  error: Error;
  onDismiss: () => void;
  onNewChat: () => void;
  onOpenModelSelector: () => void;
  providerModel: string;
}

interface ErrorBody {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Quilly({ error, onDismiss, onNewChat, onOpenModelSelector, providerModel }: QuillyProps) {
  const navigate = useNavigate();
  const { settings } = useAISettings();
  const { provider } = parseProviderModel(providerModel, settings.providers);
  const credits = useAICredits(provider);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  const renderBody = (error: Error): ErrorBody => {
    // Handle OpenAI API errors with specific error codes
    if (error instanceof OpenAI.APIError) {
      switch (error.code) {
        case 'invalid_api_key':
        case 'invalid_request_error':
          return {
            message: 'Authentication error: Please check your API key in AI settings.',
            action: {
              label: 'Check API key',
              onClick: () => navigate('/settings/ai'),
            }
          };

        case 'insufficient_quota': {
          if (credits.data) {
            return {
              message: `Your account has $${credits.data.amount.toFixed(2)} credits. Please add credits to keep creating.`,
              action: {
                label: 'Add credits',
                onClick: () => setShowCreditsDialog(true),
              }
            };
          } else {
            return {
              message: 'Your API key has reached its usage limit. Please check your billing or try a different provider.',
              action: {
                label: 'Check AI settings',
                onClick: () => navigate('/settings/ai'),
              }
            };
          }
        }

        case 'rate_limit_exceeded':
          return {
            message: 'Rate limit exceeded. Please wait a moment before trying again.',
          };

        case 'model_not_found':
          return {
            message: 'The selected AI model is not available. Please choose a different model.',
            action: {
              label: 'Choose model',
              onClick: onOpenModelSelector,
            },
          };

        case 'context_length_exceeded':
          return {
            message: 'Your conversation is too long for this model. Try starting a new chat or switching to a model with a larger context window.',
            action: {
              label: 'New chat',
              onClick: onNewChat,
            },
          };

        case 'server_error':
        case 'service_unavailable':
          return {
            message: 'The AI service is temporarily unavailable. Please try again in a moment.',
          };

        default:
          return {
            message: `AI service error: ${error.message}`,
          };
      }
    }

    // Default fallback
    return {
      message: error.message
        ? `AI service error: ${error.message}`
        : 'Sorry, I encountered an unexpected error. Please try again.',
    };
  };

  const { message, action } = renderBody(error);

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
              {' '}
              {action && (
                <button className="text-primary underline" onClick={action.onClick}>
                  {action.label}
                </button>
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