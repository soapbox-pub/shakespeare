import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Settings, CheckCircle, Bot } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';

interface AISettingsStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export function AISettingsStep({ onNext, onPrevious, onSkip }: AISettingsStepProps) {
  const { settings, updateSettings, isConfigured } = useAISettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    updateSettings(localSettings);
    onNext();
  };

  const isValid = localSettings.apiKey.trim() && localSettings.baseUrl.trim() && localSettings.model.trim();

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Configure AI Settings
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Set up your AI provider to start building with AI assistance.
        </p>
      </div>

      <Card className="max-w-lg mx-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg">AI Provider</CardTitle>
          </div>
          <CardDescription className="text-xs">
            We recommend OpenRouter for easy setup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="apiKey" className="text-sm">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-... or your-api-key"
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                className="font-mono text-sm h-9"
              />
              <p className="text-xs text-muted-foreground">
                Stored locally, never shared
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="baseUrl" className="text-sm">Base URL *</Label>
              <Input
                id="baseUrl"
                placeholder="https://openrouter.ai/api/v1"
                value={localSettings.baseUrl}
                onChange={(e) => setLocalSettings({ ...localSettings, baseUrl: e.target.value })}
                className="text-sm h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="model" className="text-sm">Model *</Label>
              <Input
                id="model"
                placeholder="anthropic/claude-sonnet-4"
                value={localSettings.model}
                onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                className="text-sm h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-3 pt-2">
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
          className="text-muted-foreground text-xs h-7"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}