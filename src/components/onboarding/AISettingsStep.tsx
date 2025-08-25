import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Settings, Bot } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import type { AIConnection } from '@/contexts/AISettingsContext';

interface AISettingsStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export function AISettingsStep({ onNext, onPrevious, onSkip }: AISettingsStepProps) {
  const { settings, updateProvider } = useAISettings();
  const [localProvider, setLocalProvider] = useState<AIConnection>(
    settings.providers.openrouter || { baseURL: 'https://openrouter.ai/api/v1', apiKey: '' }
  );

  const handleSave = () => {
    updateProvider('openrouter', localProvider);
    onNext();
  };

  const isValid = localProvider.apiKey.trim() && localProvider.baseURL.trim();

  return (
    <div className="space-y-2 sm:space-y-4 mb-3 sm:mb-0">
      <div className="text-center space-y-1 sm:space-y-1.5">
        <div className="flex justify-center mb-0.5 sm:mb-1">
          <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
          Configure AI Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto px-2">
          Set up your AI provider to start building with AI assistance.
        </p>
      </div>

      <Card className="max-w-md sm:max-w-lg md:max-w-lg mx-auto">
        <CardHeader className="pb-2 sm:pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">OpenRouter Provider</CardTitle>
          </div>
          <CardDescription className="text-[10px] sm:text-xs">
            We recommend OpenRouter for easy setup with multiple models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          <div className="space-y-2 sm:space-y-3">
            <div className="space-y-1">
              <Label htmlFor="apiKey" className="text-xs sm:text-sm">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-... or your-api-key"
                value={localProvider.apiKey}
                onChange={(e) => setLocalProvider({ ...localProvider, apiKey: e.target.value })}
                className="font-mono text-xs sm:text-sm h-8 sm:h-9"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Stored locally, never shared
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="baseURL" className="text-xs sm:text-sm">Base URL *</Label>
              <Input
                id="baseURL"
                placeholder="https://openrouter.ai/api/v1"
                value={localProvider.baseURL}
                onChange={(e) => setLocalProvider({ ...localProvider, baseURL: e.target.value })}
                className="text-xs sm:text-sm h-8 sm:h-9"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-2 space-y-1">
            <p className="text-[10px] sm:text-xs font-medium">Usage in chat:</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Use <code className="bg-background px-1 rounded">openrouter/anthropic/claude-sonnet-4</code> to specify model
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2 sm:gap-3 pt-1 sm:pt-2">
        <Button
          onClick={onPrevious}
          variant="outline"
          size="sm"
          className="gap-1 h-8 text-sm"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isValid}
          size="sm"
          className="gap-1 h-8 text-sm bg-gradient-to-r from-primary to-primary/90"
        >
          Continue
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="text-center">
        <Button
          onClick={onSkip}
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-[10px] sm:text-xs h-6 sm:h-7"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}