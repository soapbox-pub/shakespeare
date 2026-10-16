import { Link, Navigate, useNavigate } from 'react-router';
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
          <Link to="/changelog" className="block text-center text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors select-none pt-4 pb-2">
            v{import.meta.env.VERSION}{import.meta.env.COMMIT_TAG ? '' : '+'} ({new Date(import.meta.env.BUILD_DATE).toLocaleDateString()})
          </Link>
        )}
      </div>
    );
  }

  // On desktop, redirect to preferences
  return <Navigate to="/settings/preferences" replace />;
}

export default Settings;
