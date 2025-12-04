import { useState, useMemo } from "react";
import { Settings2, ArrowLeft, ChevronDown, Edit, RotateCcw } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemePicker } from "@/components/ThemePicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";

// Default system prompt for global chat
const DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant. You're here to have a friendly conversation and help answer questions on any topic.

Keep your responses concise but informative. Be friendly and conversational.`;

export function Preferences() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { config, defaultConfig, updateConfig } = useAppContext();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [chatSystemPromptInput, setChatSystemPromptInput] = useState(
    config.globalChatSystemPrompt || DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT
  );

  // Check if chat system prompt differs from default
  const isChatSystemPromptModified = useMemo(() =>
    (config.globalChatSystemPrompt || DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT) !== DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT,
  [config.globalChatSystemPrompt]);

  const restoreChatSystemPrompt = () => {
    setChatSystemPromptInput(DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT);
    updateConfig((current) => {
      const { globalChatSystemPrompt, ...rest } = current;
      return rest;
    });
  };

  return (
    <div className="p-6 space-y-6">
      {isMobile && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-8 w-auto px-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSettings')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-primary" />
              {t('preferences')}
            </h1>
            <p className="text-muted-foreground">
              {t('preferencesDescription')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings2 className="h-6 w-6 text-primary" />
            {t('preferences')}
          </h1>
          <p className="text-muted-foreground">
            {t('preferencesDescription')}
          </p>
        </div>
      )}

      <Card className="max-w-md">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="theme-picker">{t('theme')}</Label>
              <div className="w-full">
                <ThemePicker />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('themeDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language-picker">{t('language')}</Label>
              <div className="w-full">
                <LanguagePicker />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('languageDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sentry-enabled" className="text-sm font-medium">
                    {t('shareErrorReports')}
                  </Label>
                </div>
                <Switch
                  id="sentry-enabled"
                  checked={config.sentryEnabled}
                  onCheckedChange={(checked) => {
                    updateConfig((current) => ({
                      ...current,
                      sentryEnabled: checked,
                    }));
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('shareErrorReportsDescription')}
              </p>
            </div>

            <Separator className="my-4" />

            {/* Global Chat Settings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="global-chat-enabled" className="text-sm font-medium">
                    {t('globalChatEnabled')}
                  </Label>
                </div>
                <Switch
                  id="global-chat-enabled"
                  checked={config.globalChatEnabled !== false}
                  onCheckedChange={(checked) => {
                    updateConfig((current) => ({
                      ...current,
                      globalChatEnabled: checked,
                    }));
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('globalChatEnabledDescription')}
              </p>
            </div>

            {/* Advanced Global Chat Settings */}
            {config.globalChatEnabled !== false && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{t('advanced')}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  />
                </button>

                {showAdvanced && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">{t('globalChatSystemPrompt')}</Label>
                        {isChatSystemPromptModified && (
                          <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                        )}
                      </div>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="chat-system-prompt" className="border rounded-lg">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Edit className="h-3.5 w-3.5" />
                              <span className="text-sm">{t('globalChatSystemPrompt')}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Enter system prompt..."
                                value={chatSystemPromptInput}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setChatSystemPromptInput(value);
                                  updateConfig((current) => ({
                                    ...current,
                                    globalChatSystemPrompt: value,
                                  }));
                                }}
                                className="font-mono text-xs min-h-[150px]"
                              />
                              {isChatSystemPromptModified && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={restoreChatSystemPrompt}
                                  className="w-full"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                  {t('restoreToDefault')}
                                </Button>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {t('globalChatSystemPromptDescription')}
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Preferences;