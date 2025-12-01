import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode2, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppContext } from '@/hooks/useAppContext';
import { useToast } from '@/hooks/useToast';

interface ProjectTemplate {
  name: string;
  description: string;
  url: string;
}

export function ProjectTemplatesSection() {
  const { t } = useTranslation();
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateUrl, setNewTemplateUrl] = useState('');

  const templates = config.templates || [];

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

  return (
    <div className="space-y-4">
      {/* Divider */}
      <Separator className="my-6" />

      {/* Project Templates Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('projectTemplates')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('projectTemplatesDescription')}
        </p>
      </div>

      {/* Configured Templates List */}
      {templates.length > 0 ? (
        <div className="space-y-2">
          {templates.map((template, index) => (
            <Accordion key={index} type="single" collapsible className="w-full">
              <AccordionItem value={`template-${index}`} className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2 w-full mr-3">
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
                        onChange={(e) => handleUpdateTemplate(index, { ...template, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`template-description-${index}`}>{t('templateDescription')}</Label>
                      <Textarea
                        id={`template-description-${index}`}
                        placeholder="Build Nostr clients with React."
                        value={template.description}
                        onChange={(e) => handleUpdateTemplate(index, { ...template, description: e.target.value })}
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
                        onChange={(e) => handleUpdateTemplate(index, { ...template, url: e.target.value })}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveTemplate(index)}
                      disabled={templates.length === 1}
                      title={templates.length === 1 ? t('atLeastOneTemplateRequired') : t('delete')}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete')}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      ) : (
        <Alert>
          <AlertDescription className="text-sm">
            {t('noTemplatesConfigured')}
          </AlertDescription>
        </Alert>
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
