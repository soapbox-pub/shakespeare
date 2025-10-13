import { Settings, ArrowLeft } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";

export function SystemSettings() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { config, updateConfig } = useAppContext();
  const [projectTemplateInput, setProjectTemplateInput] = useState(config.projectTemplate);
  const [esmUrlInput, setEsmUrlInput] = useState(config.esmUrl);
  const [corsProxyInput, setCorsProxyInput] = useState(config.corsProxy);
  const [previewDomainInput, setPreviewDomainInput] = useState(config.previewDomain);
  const [deployServerInput, setDeployServerInput] = useState(config.deployServer);
  const [showcaseModeratorInput, setShowcaseModeratorInput] = useState(config.showcaseModerator);

  return (
    <div className="p-6 space-y-6">
      {isMobile && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-8 w-auto px-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSettings')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              {t('systemSettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('systemSettingsDescription')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            {t('systemSettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('systemSettingsDescription')}
          </p>
        </div>
      )}

      <div className="space-y-3 max-w-xl">
        {/* Project Template Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="project-template" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">{t('projectTemplate')}</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <Input
                  id="project-template"
                  type="url"
                  placeholder="https://gitlab.com/soapbox-pub/mkstack.git"
                  value={projectTemplateInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProjectTemplateInput(value);
                    updateConfig((current) => ({
                      ...current,
                      projectTemplate: value,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('projectTemplateDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* CORS Proxy Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="cors-proxy" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">{t('corsProxy')}</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <Input
                  id="cors-proxy"
                  type="url"
                  placeholder="https://proxy.shakespeare.diy/?url={href}"
                  value={corsProxyInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCorsProxyInput(value);
                    updateConfig((current) => ({
                      ...current,
                      corsProxy: value,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('corsProxyDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* JavaScript CDN Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="esm-url" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">{t('esmUrl')}</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <Input
                  id="esm-url"
                  type="url"
                  placeholder="https://esm.shakespeare.diy"
                  value={esmUrlInput}
                  onChange={(e) => {
                    // Strip trailing slash on save.
                    const value = e.target.value;
                    setEsmUrlInput(value);
                    updateConfig((current) => ({
                      ...current,
                      esmUrl: value.replace(/\/+$/, ''),
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('esmUrlDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Preview Domain Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="preview-domain" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">{t('previewDomain')}</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <Input
                  id="preview-domain"
                  type="text"
                  placeholder="local-shakespeare.dev"
                  value={previewDomainInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPreviewDomainInput(value);
                    updateConfig((current) => ({
                      ...current,
                      previewDomain: value,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('previewDomainDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Deploy Server Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="deploy-server" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">{t('deployServer')}</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <Input
                  id="deploy-server"
                  type="text"
                  placeholder="shakespeare.wtf"
                  value={deployServerInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDeployServerInput(value);
                    updateConfig((current) => ({
                      ...current,
                      deployServer: value,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('deployServerDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Showcase Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="showcase" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">Showcase</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showcase-enabled" className="text-sm font-medium">
                    Showcase Enabled
                  </Label>
                  <Switch
                    id="showcase-enabled"
                    checked={config.showcaseEnabled}
                    onCheckedChange={(checked) => {
                      updateConfig((current) => ({
                        ...current,
                        showcaseEnabled: checked,
                      }));
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Display the app showcase section on the home page
                </p>

                <div className="space-y-2">
                  <Label htmlFor="showcase-moderator" className="text-sm font-medium">
                    Showcase Moderator
                  </Label>
                  <Input
                    id="showcase-moderator"
                    type="text"
                    placeholder="npub1..."
                    value={showcaseModeratorInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setShowcaseModeratorInput(value);
                      updateConfig((current) => ({
                        ...current,
                        showcaseModerator: value,
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nostr public key (npub) of the user who can moderate showcase submissions
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

export default SystemSettings;