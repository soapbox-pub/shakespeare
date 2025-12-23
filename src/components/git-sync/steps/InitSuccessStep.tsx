import { CheckCircle2 } from 'lucide-react';
import type { StepProps } from '../types';

export function InitSuccessStep(_props: StepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="relative">
        <CheckCircle2 className="h-20 w-20 text-green-500 animate-in zoom-in duration-300" />
        <div className="absolute inset-0 h-20 w-20 rounded-full bg-green-500/20 animate-ping" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="font-semibold text-lg">Successfully Synced!</h3>
        <p className="text-sm text-muted-foreground">
          Your code has been synced to the remote repository.
        </p>
      </div>
    </div>
  );
}
