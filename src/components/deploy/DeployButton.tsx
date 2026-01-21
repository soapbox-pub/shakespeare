import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DeploySteps } from './DeploySteps';
import { useTranslation } from 'react-i18next';

interface DeployButtonProps {
  projectId: string;
  projectName: string;
  className?: string;
  disabled?: boolean;
}

export function DeployButton({ projectId, projectName, className, disabled }: DeployButtonProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("size-8 p-0 group", className)}
          aria-label="Deploy project"
          disabled={disabled}
          title={t('deployButtonTooltip')}
        >
          <Rocket className={cn("size-5 group-hover:text-foreground", open ? "text-foreground" : "text-muted-foreground")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-96"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DeploySteps
          projectId={projectId}
          projectName={projectName}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
