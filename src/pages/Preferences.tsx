import { Settings2, ArrowLeft } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/ThemePicker";
import { LanguagePicker } from "@/components/LanguagePicker";

import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";

export function Preferences() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="theme-picker">{t('theme')}</Label>
          <div className="w-full max-w-xs">
            <ThemePicker />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('themeDescription')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="language-picker">{t('language')}</Label>
          <div className="w-full max-w-xs">
            <LanguagePicker />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('languageDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Preferences;