import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useLabels, getLabelColor, LABEL_COLORS, type Label, type LabelColorName } from '@/hooks/useLabels';
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
  const { labels, createLabel } = useLabels();
  const { getProjectLabels, addLabelToProject, removeLabelFromProject } = useProjectLabels();
  const [open, setOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState<LabelColorName>('blue');

  const projectLabelIds = getProjectLabels(projectId);
  const projectLabels = labels.filter(label => projectLabelIds.includes(label.id));

  const handleToggleLabel = (label: Label) => {
    if (projectLabelIds.includes(label.id)) {
      removeLabelFromProject(projectId, label.id);
    } else {
      addLabelToProject(projectId, label.id);
    }
  };

  const handleCreateLabel = () => {
    if (!newLabelName.trim()) return;

    const newLabel = createLabel(newLabelName.trim(), selectedColor);
    addLabelToProject(projectId, newLabel.id);

    // Reset form
    setNewLabelName('');
    setSelectedColor('blue');
    setShowCreateForm(false);
  };

  const handleCancelCreate = () => {
    setNewLabelName('');
    setSelectedColor('blue');
    setShowCreateForm(false);
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
            {showCreateForm ? (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('labelName')}
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateLabel();
                      } else if (e.key === 'Escape') {
                        handleCancelCreate();
                      }
                    }}
                    className="flex-1 h-8"
                    autoFocus
                  />
                  <button
                    onClick={handleCancelCreate}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color.name)}
                      className={cn(
                        'w-6 h-6 rounded-full transition-all',
                        color.bg,
                        selectedColor === color.name && 'ring-2 ring-offset-2 ring-primary'
                      )}
                      title={color.name}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleCreateLabel}
                  disabled={!newLabelName.trim()}
                  className="w-full h-8"
                  size="sm"
                >
                  {t('create')}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('createNewLabel')}
              </button>
            )}
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
