import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ActionStatus, type ActionStatusProps } from './ActionStatus';

export interface ActionCardProps extends Omit<ActionStatusProps, 'status'> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  result?: string;
  children?: React.ReactNode;
  className?: string;
  showResult?: boolean;
  status?: ActionStatusProps['status'];
}

export function ActionCard({
  title,
  description,
  icon,
  result,
  children,
  className,
  showResult = true,
  ...statusProps
}: ActionCardProps) {
  const { Badge, Icon, ResultClass, BorderClass } = ActionStatus({
    _result: result,
    ...statusProps,
    status: statusProps.status
  });

  return (
    <Card className={cn("mt-2", BorderClass(), className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex items-center gap-2">
                {Icon('md')}
                {icon}
              </div>
            )}
            <div>
              <div className="font-mono text-sm font-medium">{title}</div>
              {description && (
                <div className="text-xs text-muted-foreground">{description}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge />
          </div>
        </div>
      </CardHeader>

      {(children || (showResult && result)) && (
        <CardContent className="pt-0">
          {children}

          {showResult && result && (
            <div className={ResultClass()}>
              <pre className="whitespace-pre-wrap break-words">{result}</pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}