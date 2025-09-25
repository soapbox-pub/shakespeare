import { Button } from '@/components/ui/button';
import { QuillySVG } from '@/components/ui/QuillySVG';
import { X } from 'lucide-react';

export interface QuillyProps {
  error: Error;
  onDismiss: () => void;
  onNewChat?: () => void;
  onOpenModelSelector?: () => void;
  onFixConsoleErrors?: () => void;
}

export function Quilly({ error, onDismiss, onNewChat, onOpenModelSelector, onFixConsoleErrors }: QuillyProps) {
  // Generate user-friendly message from error
  const getMessage = (error: Error): string => {
    const errorMsg = error.message || '';

    if (error.name === 'TypeError' && errorMsg.includes('fetch')) {
      return 'Network error: Unable to connect to AI service. Please check your internet connection and AI settings.';
    } else if (errorMsg.includes('API key')) {
      return 'Authentication error: Please check your API key in AI settings.';
    } else if (errorMsg.includes('rate limit')) {
      return 'Rate limit exceeded. Please wait a moment before trying again.';
    } else if (errorMsg.includes('insufficient_quota')) {
      return 'Quota exceeded: Your API key has reached its usage limit. Please check your billing or try a different provider.';
    } else if (errorMsg.includes('model_not_found') || errorMsg.includes('does not exist')) {
      return 'Model not found: The selected AI model is not available. Please choose a different model.';
    } else if (errorMsg.includes('maximum context length') || errorMsg.includes('context length')) {
      return 'Your conversation is too long for this model. Try starting a new chat or switching to a model with a larger context window.';
    } else if (errorMsg.includes('422') || errorMsg.includes('Provider returned error')) {
      return 'The AI model encountered an issue. Try switching to a different model or starting a new chat.';
    } else if (errorMsg.includes('too many requests')) {
      return 'You\'re sending requests too quickly. Please wait a moment before trying again.';
    } else if (errorMsg) {
      return `AI service error: ${errorMsg}`;
    } else {
      return 'Sorry, I encountered an unexpected error. Please try again.';
    }
  };

  // Determine action based on error
  const getAction = (error: Error): { label: string; onClick: () => void } | undefined => {
    const errorMsg = error.message || '';

    // Check for console error messages first
    if (errorMsg.includes('Console') && errorMsg.includes('detected in your app') && onFixConsoleErrors) {
      const isPlural = errorMsg.includes('errors detected');
      return {
        label: `Fix ${isPlural ? 'errors' : 'error'}`,
        onClick: onFixConsoleErrors
      };
    }

    if (error.name === 'TypeError' && errorMsg.includes('fetch')) {
      return {
        label: 'Check AI settings',
        onClick: () => {
          window.location.href = '/settings/ai';
        }
      };
    } else if (errorMsg.includes('API key')) {
      return {
        label: 'Check API key',
        onClick: () => {
          window.location.href = '/settings/ai';
        }
      };
    } else if (errorMsg.includes('insufficient_quota')) {
      return {
        label: 'Check AI settings',
        onClick: () => {
          window.location.href = '/settings/ai';
        }
      };
    } else if (errorMsg.includes('model_not_found') || errorMsg.includes('does not exist')) {
      return onOpenModelSelector ? {
        label: 'Choose model',
        onClick: onOpenModelSelector
      } : undefined;
    } else if (errorMsg.includes('maximum context length') || errorMsg.includes('context length')) {
      return onNewChat ? {
        label: 'New chat',
        onClick: onNewChat
      } : undefined;
    } else if (errorMsg.includes('422') || errorMsg.includes('Provider returned error')) {
      return onOpenModelSelector ? {
        label: 'Change model',
        onClick: onOpenModelSelector
      } : undefined;
    }

    return undefined;
  };

  const message = getMessage(error);
  const action = getAction(error);

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
    </div>
  );
}