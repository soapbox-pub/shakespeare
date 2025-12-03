import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLabels, getLabelColor, type Label } from '@/hooks/useLabels';
import { useProjectLabels } from '@/hooks/useProjectLabels';
import { LabelsManageDialog } from './LabelsManageDialog';
import { cn } from '@/lib/utils';

interface LabelSelectorProps {
  projectId: string;
  /** Render as a compact badge list (for inline display) */
  compact?: boolean;
}

export function LabelSelector({ projectId, compact }: LabelSelectorProps) {
  const { t } = useTranslation();
  const { labels } = useLabels();
  const { getProjectLabels, addLabelToProject, removeLabelFromProject } = useProjectLabels();
  const [open, setOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  const projectLabelIds = getProjectLabels(projectId);
  const projectLabels = labels.filter(label => projectLabelIds.includes(label.id));

  const handleToggleLabel = (label: Label) => {
    if (projectLabelIds.includes(label.id)) {
      removeLabelFromProject(projectId, label.id);
    } else {
      addLabelToProject(projectId, label.id);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {projectLabels.map((label) => {
          const colorConfig = getLabelColor(label.color);
          return (
            <span
              key={label.id}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                colorConfig.bg,
                'text-white'
              )}
            >
              {label.name}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2">
            <Tag className="h-4 w-4" />
            {projectLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1 flex-1">
                {projectLabels.map((label) => {
                  const colorConfig = getLabelColor(label.color);
                  return (
                    <span
                      key={label.id}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        colorConfig.bg,
                        'text-white'
                      )}
                    >
                      {label.name}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-muted-foreground">{t('addLabel')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              {t('selectLabels')}
            </p>
          </div>
          
          {labels.length > 0 ? (
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {labels.map((label) => {
                  const colorConfig = getLabelColor(label.color);
                  const isSelected = projectLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm',
                        'hover:bg-muted transition-colors',
                        isSelected && 'bg-muted'
                      )}
                    >
                      <div className={cn('w-3 h-3 rounded-full', colorConfig.bg)} />
                      <span className="flex-1 text-left">{label.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('noLabelsCreated')}
            </div>
          )}

          <Separator />
          
          <div className="p-1">
            <button
              onClick={() => {
                setOpen(false);
                setManageDialogOpen(true);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('createNewLabel')}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <LabelsManageDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
      />
    </>
  );
}
