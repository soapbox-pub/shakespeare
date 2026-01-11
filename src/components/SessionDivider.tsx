import { useTranslation } from 'react-i18next';

/** Visual divider between chat sessions */
export function SessionDivider() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="uppercase tracking-wide">
        {t('newChat', 'New chat')}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
