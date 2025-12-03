import { useState } from "react";
import { Settings2, ArrowLeft, Tag } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemePicker } from "@/components/ThemePicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";
import { useLabels } from "@/hooks/useLabels";
import { LabelsManageDialog } from "@/components/labels/LabelsManageDialog";

export function Preferences() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { config, updateConfig } = useAppContext();
  const { labels, displaySettings, updateDisplaySettings } = useLabels();
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);

  // Settings are disabled until user creates at least one label
  const hasLabels = labels.length > 0;

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
          </div>
        </CardContent>
      </Card>

      {/* Labels Settings */}
      <Card className="max-w-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="h-5 w-5 text-primary" />
            {t('projectLabels')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className={!hasLabels ? "opacity-50" : undefined}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="colored-icons" className="text-sm font-medium">
                      {t('showColoredIcons')}
                    </Label>
                  </div>
                  <Switch
                    id="colored-icons"
                    checked={displaySettings.showColoredIcons}
                    onCheckedChange={(checked) => {
                      updateDisplaySettings({ showColoredIcons: checked });
                    }}
                    disabled={!hasLabels}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('showColoredIconsDescription')}
                </p>
              </div>
            </div>

            <div className={!hasLabels ? "opacity-50" : undefined}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="group-by-label" className="text-sm font-medium">
                      {t('groupByLabel')}
                    </Label>
                  </div>
                  <Switch
                    id="group-by-label"
                    checked={displaySettings.groupByLabel}
                    onCheckedChange={(checked) => {
                      updateDisplaySettings({ groupByLabel: checked });
                    }}
                    disabled={!hasLabels}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('groupByLabelDescription')}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLabelsDialogOpen(true)}
              >
                {t('manageLabels')}
              </Button>
              {!hasLabels && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {t('createLabelToEnableSettings')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <LabelsManageDialog
        open={labelsDialogOpen}
        onOpenChange={setLabelsDialogOpen}
      />
    </div>
  );
}

export default Preferences;