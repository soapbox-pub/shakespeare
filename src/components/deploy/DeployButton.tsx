import { useState } from 'react';
import { Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DeploySteps } from './DeploySteps';
import { useTranslation } from 'react-i18next';
import { useDeployJob } from '@/hooks/useDeployJob';
import { clearDeployJob } from '@/lib/deploy/deployJobs';

interface DeployButtonProps {
  projectId: string;
  projectName: string;
  className?: string;
  disabled?: boolean;
}

export function DeployButton({ projectId, projectName, className, disabled }: DeployButtonProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const job = useDeployJob(projectId);
  const isDeploying = job?.status === 'running';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A finished deploy has been seen once the popover closes on it.
        if (!next) clearDeployJob(projectId);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("size-8 p-0 group", className)}
          aria-label={isDeploying ? 'Deploying project' : 'Deploy project'}
          // A deploy in progress stays reachable, so it can be watched or cancelled.
          disabled={disabled && !isDeploying}
          title={isDeploying ? job.progress?.stage ?? 'Deploying' : t('deployButtonTooltip')}
        >
          {isDeploying ? (
            <Loader2 className="size-5 animate-spin text-foreground" />
          ) : (
            <Rocket className={cn("size-5 group-hover:text-foreground", open ? "text-foreground" : "text-muted-foreground")} />
          )}
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
