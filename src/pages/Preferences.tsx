import { Settings2 } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Card, CardContent } from "@/components/ui/card";
import { ThemePicker } from "@/components/ThemePicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/hooks/useAppContext";

export function Preferences() {
  const { t } = useTranslation();
  const { config, updateConfig } = useAppContext();

  return (
    <SettingsPageLayout
      icon={Settings2}
      titleKey="preferences"
      descriptionKey="preferencesDescription"
    >

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
          </div>
        </CardContent>
      </Card>
    </SettingsPageLayout>
  );
}

export default Preferences;