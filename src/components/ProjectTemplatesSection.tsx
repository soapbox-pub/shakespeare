import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode2, Trash2, Plus, GripVertical, RotateCcw } from 'lucide-react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAppContext } from '@/hooks/useAppContext';
import { useToast } from '@/hooks/useToast';

interface ProjectTemplate {
  name: string;
  description: string;
  url: string;
}

interface SortableTemplateItemProps {
  template: ProjectTemplate;
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (index: number, template: ProjectTemplate) => void;
  showDragHandle: boolean;
  isOnlyTemplate: boolean;
}

function SortableTemplateItem({
  template,
  index,
  onRemove,
  onUpdate,
  showDragHandle,
  isOnlyTemplate,
}: SortableTemplateItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `template-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      style={style}
      value={`template-${index}`}
      className="border rounded-lg"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2 w-full mr-3">
          {showDragHandle && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <FileCode2 size={16} className="text-primary" />
          <span className="font-medium">{template.name}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor={`template-name-${index}`}>{t('templateName')}</Label>
            <Input
              id={`template-name-${index}`}
              placeholder="MKStack"
              value={template.name}
              onChange={(e) => onUpdate(index, { ...template, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`template-description-${index}`}>{t('templateDescription')}</Label>
            <Textarea
              id={`template-description-${index}`}
              placeholder="Build Nostr clients with React."
              value={template.description}
              onChange={(e) => onUpdate(index, { ...template, description: e.target.value })}
              className="min-h-[80px]"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`template-url-${index}`}>{t('templateGitUrl')}</Label>
            <Input
              id={`template-url-${index}`}
              type="url"
              placeholder="https://gitlab.com/soapbox-pub/mkstack.git"
              value={template.url}
              onChange={(e) => onUpdate(index, { ...template, url: e.target.value })}
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(index)}
            disabled={isOnlyTemplate}
            title={isOnlyTemplate ? t('atLeastOneTemplateRequired') : t('delete')}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('delete')}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function ProjectTemplatesSection() {
  const { t } = useTranslation();
  const { config, defaultConfig, updateConfig } = useAppContext();
  const { toast } = useToast();
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateUrl, setNewTemplateUrl] = useState('');

  const templates = config.templates || [];
  const defaultTemplates = defaultConfig.templates || [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if current templates match the default configuration
  const templatesMatchDefault = JSON.stringify(templates) === JSON.stringify(defaultTemplates);

  const handleAddTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateDescription.trim() || !newTemplateUrl.trim()) {
      return;
    }

    const newTemplate: ProjectTemplate = {
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
      url: newTemplateUrl.trim(),
    };

    updateConfig((current) => ({
      ...current,
      templates: [...(current.templates || []), newTemplate],
    }));

    toast({
      title: t('templateAdded'),
      description: t('templateAddedDescription', { name: newTemplateName.trim() }),
    });

    setNewTemplateName('');
    setNewTemplateDescription('');
    setNewTemplateUrl('');
  };

  const handleRemoveTemplate = (index: number) => {
    const templateName = templates[index]?.name || 'template';
    const newTemplates = templates.filter((_, i) => i !== index);

    updateConfig((current) => ({
      ...current,
      templates: newTemplates,
    }));

    toast({
      title: t('templateDeleted'),
      description: t('templateDeletedDescription', { name: templateName }),
    });
  };

  const handleUpdateTemplate = (index: number, updatedTemplate: ProjectTemplate) => {
    const newTemplates = [...templates];
    newTemplates[index] = updatedTemplate;

    updateConfig((current) => ({
      ...current,
      templates: newTemplates,
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = parseInt(active.id.toString().replace('template-', ''));
      const newIndex = parseInt(over?.id.toString().replace('template-', '') || '0');

      if (!isNaN(oldIndex) && !isNaN(newIndex) && oldIndex !== newIndex) {
        const newTemplates = arrayMove(templates, oldIndex, newIndex);
        updateConfig((current) => ({
          ...current,
          templates: newTemplates,
        }));
      }
    }
  };

  const handleResetToDefaults = () => {
    // Remove the templates from local config so defaults take precedence
    updateConfig((current) => {
      const { templates: _, ...rest } = current;
      return rest;
    });
  };

  return (
    <div className="space-y-4">
      {/* Project Templates Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('projectTemplates')}</h3>
          {!templatesMatchDefault && (
            <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
          )}
          {!templatesMatchDefault && (
            <button
              onClick={handleResetToDefaults}
              title={t('restoreToDefault')}
              className="ml-auto p-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('projectTemplatesDescription')}
        </p>
      </div>

      {/* Configured Templates List */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={templates.map((_, index) => `template-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              <Accordion type="multiple" className="w-full space-y-2">
                {templates.map((template, index) => (
                  <SortableTemplateItem
                    key={index}
                    template={template}
                    index={index}
                    onRemove={handleRemoveTemplate}
                    onUpdate={handleUpdateTemplate}
                    showDragHandle={templates.length > 1}
                    isOnlyTemplate={templates.length === 1}
                  />
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add New Template */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="add-template">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">{t('addProjectTemplate')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="new-template-name">{t('templateName')}</Label>
                <Input
                  id="new-template-name"
                  placeholder="MKStack"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-template-description">{t('templateDescription')}</Label>
                <Textarea
                  id="new-template-description"
                  placeholder="Build Nostr clients with React."
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-template-url">{t('templateGitUrl')}</Label>
                <Input
                  id="new-template-url"
                  type="url"
                  placeholder="https://gitlab.com/soapbox-pub/mkstack.git"
                  value={newTemplateUrl}
                  onChange={(e) => setNewTemplateUrl(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddTemplate}
                disabled={!newTemplateName.trim() || !newTemplateDescription.trim() || !newTemplateUrl.trim()}
                className="gap-2 w-full"
              >
                <Plus className="h-4 w-4" />
                {t('add')}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
