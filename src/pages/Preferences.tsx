import { Settings2, ArrowLeft } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemePicker } from "@/components/ThemePicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";

export function Preferences() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { config, updateConfig } = useAppContext();

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Preferences;