import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsPageLayoutProps {
  /** The icon component to display next to the title */
  icon: LucideIcon;
  /** Translation key for the page title */
  titleKey: string;
  /** Translation key for the page description */
  descriptionKey: string;
  /** The main content of the settings page */
  children: ReactNode;
  /** Optional className for the content container */
  className?: string;
}

/**
 * Shared layout component for all settings pages.
 * Provides consistent header structure with mobile back button, icon, title, and description.
 */
export function SettingsPageLayout({
  icon: Icon,
  titleKey,
  descriptionKey,
  children,
  className,
}: SettingsPageLayoutProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 pb-16">
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
              <Icon className="h-6 w-6 text-primary" />
              {t(titleKey)}
            </h1>
            <p className="text-muted-foreground">
              {t(descriptionKey)}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary" />
            {t(titleKey)}
          </h1>
          <p className="text-muted-foreground">
            {t(descriptionKey)}
          </p>
        </div>
      )}

      <div className={cn('space-y-6 max-w-xl', className)}>
        {children}
      </div>
    </div>
  );
}
