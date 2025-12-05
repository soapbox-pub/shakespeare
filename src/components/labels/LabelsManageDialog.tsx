import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLabels, LABEL_COLORS, getLabelColor, type LabelColorName, type Label as LabelType } from '@/hooks/useLabels';
import { useProjectLabels } from '@/hooks/useProjectLabels';
import { cn } from '@/lib/utils';

interface LabelsManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SortableLabelItemProps {
  label: LabelType;
  onUpdate: (name: string, color: LabelColorName) => void;
  onDelete: () => void;
  projectCount: number;
}

function SortableLabelItem({ label, onUpdate, onDelete, projectCount }: SortableLabelItemProps) {
  const { t } = useTranslation();
  const colorConfig = getLabelColor(label.color);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<LabelColorName>(label.color);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: label.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = () => {
    if (name.trim() && (name !== label.name || color !== label.color)) {
      onUpdate(name.trim(), color);
    }
  };

  const hasChanges = name.trim() !== label.name || color !== label.color;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50")}
    >
      <AccordionItem value={label.id} className="border rounded-lg">
        <AccordionTrigger className="hover:no-underline py-3 pl-3 pr-4 [&[data-state=open]>svg]:rotate-180">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className={cn('w-3 h-3 rounded-full flex-shrink-0', colorConfig.bg)} />
            <span className="text-sm font-medium truncate text-left flex-1">{label.name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0 mx-2">
              {projectCount} {projectCount === 1 ? 'project' : 'projects'}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4 pt-2 px-3">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`label-name-${label.id}`}>{t('labelName')}</Label>
              <Input
                id={`label-name-${label.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('enterLabelName')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('labelColor')}</Label>
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.name}
                    type="button"
                    onClick={() => setColor(colorOption.name)}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all',
                      colorOption.bg,
                      color === colorOption.name && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    title={colorOption.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('delete')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!name.trim() || !hasChanges}
              >
                <Check className="h-4 w-4 mr-1" />
                {t('save')}
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}

function AddLabelItem({ onCreate }: { onCreate: (name: string, color: LabelColorName) => void }) {
  const { t } = useTranslation();

  // Function to get a random color from LABEL_COLORS
  const getRandomColor = (): LabelColorName => {
    const randomIndex = Math.floor(Math.random() * LABEL_COLORS.length);
    return LABEL_COLORS[randomIndex].name;
  };

  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColorName>(getRandomColor());

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim(), color);
      setName('');
      setColor(getRandomColor());
    }
  };

  return (
    <AccordionItem value="add-new" className="border rounded-lg">
      <AccordionTrigger className="hover:no-underline py-3 pl-3 pr-4 [&[data-state=open]>svg]:rotate-180">
        <div className="flex items-center gap-2 flex-1">
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">{t('createLabel')}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-2 px-3">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-label-name">{t('labelName')}</Label>
            <Input
              id="new-label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterLabelName')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('labelColor')}</Label>
            <div className="flex flex-wrap gap-2">
              {LABEL_COLORS.map((colorOption) => (
                <button
                  key={colorOption.name}
                  type="button"
                  onClick={() => setColor(colorOption.name)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-all',
                    colorOption.bg,
                    color === colorOption.name && 'ring-2 ring-offset-2 ring-primary'
                  )}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              <Check className="h-4 w-4 mr-1" />
              {t('create')}
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function LabelsManageDialog({ open, onOpenChange }: LabelsManageDialogProps) {
  const { t } = useTranslation();
  const { labels, createLabel, updateLabel, deleteLabel, reorderLabels } = useLabels();
  const { getProjectsByLabel, removeLabel: removeLabelFromProjects } = useProjectLabels();

  const [deletingLabel, setDeletingLabel] = useState<LabelType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = labels.findIndex((label) => label.id === active.id);
      const newIndex = labels.findIndex((label) => label.id === over.id);

      const newOrder = arrayMove(labels, oldIndex, newIndex);
      reorderLabels(newOrder.map((label) => label.id));
    }
  };

  const handleCreateLabel = (name: string, color: LabelColorName) => {
    createLabel(name, color);
  };

  const handleUpdateLabel = (labelId: string) => (name: string, color: LabelColorName) => {
    updateLabel(labelId, { name, color });
  };

  const handleConfirmDelete = () => {
    if (deletingLabel) {
      // Remove label from all projects first
      removeLabelFromProjects(deletingLabel.id);
      // Then delete the label itself
      deleteLabel(deletingLabel.id);
      setDeletingLabel(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('manageLabels')}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            <Accordion
              type="single"
              collapsible
              className="space-y-2"
              defaultValue={labels.length === 0 ? "add-new" : undefined}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={labels.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {labels.map((label) => (
                    <SortableLabelItem
                      key={label.id}
                      label={label}
                      onUpdate={handleUpdateLabel(label.id)}
                      onDelete={() => setDeletingLabel(label)}
                      projectCount={getProjectsByLabel(label.id).length}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <AddLabelItem onCreate={handleCreateLabel} />
            </Accordion>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingLabel} onOpenChange={() => setDeletingLabel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteLabel')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteLabelConfirmation', { name: deletingLabel?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
