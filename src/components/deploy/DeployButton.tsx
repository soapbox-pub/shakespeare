import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DeploySteps } from './DeploySteps';

interface DeployButtonProps {
  projectId: string;
  projectName: string;
  className?: string;
  disabled?: boolean;
}

export function DeployButton({ projectId, projectName, className, disabled }: DeployButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", className)}
          aria-label="Deploy project"
          disabled={disabled}
        >
          <Rocket className="size-5 text-muted-foreground" />
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
