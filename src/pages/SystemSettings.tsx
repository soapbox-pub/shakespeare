import { Settings2, ArrowLeft, Globe } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";

export function SystemSettings() {
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
              {t('systemSettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('systemSettingsDescription')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings2 className="h-6 w-6 text-primary" />
            {t('systemSettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('systemSettingsDescription')}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="esm-url" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('esmUrl')}
          </Label>
          <Input
            id="esm-url"
            type="url"
            value={config.esmUrl}
            onChange={(e) => updateConfig((current) => ({
              ...current,
              esmUrl: e.target.value,
            }))}
            className="w-full max-w-xs"
            placeholder="https://esm.shakespeare.diy"
          />
          <p className="text-sm text-muted-foreground">
            {t('esmUrlDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;