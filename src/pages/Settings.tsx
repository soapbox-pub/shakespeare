import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getSettingsCategories } from '@/lib/settingsItems';
import { SettingsItemMobile } from '@/components/SettingsItemMobile';

export function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const settingsCategories = getSettingsCategories(t);

  if (isMobile) {
    return (
      <div className="p-4 space-y-8">
        {settingsCategories.map((category) => (
          <div key={category.id}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              {category.title}
            </h3>
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              {category.items.map((item, index) => (
                <SettingsItemMobile
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  onClick={() => navigate(item.href)}
                  isFirst={index === 0}
                  isLast={index === category.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
        {import.meta.env.VERSION && (
          <div className="text-center text-xs text-muted-foreground/60 pt-4">
            v{import.meta.env.VERSION}
          </div>
        )}
      </div>
    );
  }

  // On desktop, redirect to preferences
  return <Navigate to="/settings/preferences" replace />;
}

export default Settings;
