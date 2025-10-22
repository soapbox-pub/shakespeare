import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getSettingsItems } from '@/lib/settingsItems';

export function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const settingsItems = getSettingsItems(t);

  if (isMobile) {
    return (
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{t('settings')}</h2>
          <p className="text-muted-foreground">
            {t('settingsDescription')}
          </p>
        </div>
        <div className="space-y-3">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 rounded-lg border hover:border-primary/20 hover:bg-primary/5 cursor-pointer transition-colors"
                onClick={() => navigate(item.href)}
              >
                <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
        {import.meta.env.VERSION && (
          <div className="text-center text-xs text-muted-foreground/60 pt-4">
            v{import.meta.env.VERSION}
          </div>
        )}
      </div>
    );
  }
}

export default Settings;