import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/hooks/useAppContext';
import type { Language } from '@/contexts/AppContext';

interface LanguagePickerProps {
  className?: string;
}

export function LanguagePicker({ className }: LanguagePickerProps) {
  const { t } = useTranslation();
  const { config, updateConfig } = useAppContext();

  const handleLanguageChange = (language: Language) => {
    updateConfig((prev) => ({ ...prev, language }));
  };

  return (
    <Select value={config.language} onValueChange={handleLanguageChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇺🇸</span>
            {t('english')}
          </div>
        </SelectItem>
        <SelectItem value="pt">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇧🇷</span>
            {t('portuguese')}
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}