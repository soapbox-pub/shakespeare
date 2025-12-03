import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
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
  onEdit: (label: LabelType) => void;
  onDelete: (label: LabelType) => void;
  projectCount: number;
}

function SortableLabelItem({ label, onEdit, onDelete, projectCount }: SortableLabelItemProps) {
  const colorConfig = getLabelColor(label.color);
  
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
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group bg-background",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button
        type="button"
        className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className={cn('w-3 h-3 rounded-full flex-shrink-0', colorConfig.bg)} />
      <span className="flex-1 text-sm font-medium truncate">{label.name}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0"
        onClick={() => onEdit(label)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive flex-shrink-0"
        onClick={() => onDelete(label)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface LabelFormProps {
  initialName?: string;
  initialColor?: LabelColorName;
  onSave: (name: string, color: LabelColorName) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function LabelForm({ initialName = '', initialColor = 'blue', onSave, onCancel, isEditing }: LabelFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<LabelColorName>(initialColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), color);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label htmlFor="label-name">{t('labelName')}</Label>
        <Input
          id="label-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('enterLabelName')}
          autoFocus
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!name.trim()}>
          <Check className="h-4 w-4 mr-1" />
          {isEditing ? t('save') : t('create')}
        </Button>
      </div>
    </form>
  );
}

export function LabelsManageDialog({ open, onOpenChange }: LabelsManageDialogProps) {
  const { t } = useTranslation();
  const { labels, createLabel, updateLabel, deleteLabel, reorderLabels } = useLabels();
  const { getProjectsByLabel, removeLabel: removeLabelFromProjects } = useProjectLabels();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null);
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
    setShowCreateForm(false);
  };

  const handleUpdateLabel = (name: string, color: LabelColorName) => {
    if (editingLabel) {
      updateLabel(editingLabel.id, { name, color });
      setEditingLabel(null);
    }
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

          <div className="space-y-4">
            {/* Create new label button/form */}
            {showCreateForm ? (
              <LabelForm
                onSave={handleCreateLabel}
                onCancel={() => setShowCreateForm(false)}
              />
            ) : editingLabel ? (
              <LabelForm
                initialName={editingLabel.name}
                initialColor={editingLabel.color}
                onSave={handleUpdateLabel}
                onCancel={() => setEditingLabel(null)}
                isEditing
              />
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4" />
                {t('createLabel')}
              </Button>
            )}

            {/* Labels list with drag and drop */}
            {labels.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={labels.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {labels.map((label) => (
                        <SortableLabelItem
                          key={label.id}
                          label={label}
                          onEdit={setEditingLabel}
                          onDelete={setDeletingLabel}
                          projectCount={getProjectsByLabel(label.id).length}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </ScrollArea>
            ) : !showCreateForm && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('noLabelsYet')}</p>
                <p className="text-xs mt-1">{t('createLabelToOrganize')}</p>
              </div>
            )}
          </div>
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
