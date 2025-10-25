import { Settings, ArrowLeft, RefreshCw, Trash2, XCircle, Loader2 } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";
import { useOffline } from "@/hooks/useOffline";
import { useToast } from "@/hooks/useToast";

export function SystemSettings() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();
  const { serviceWorkerRegistration, updateServiceWorker, clearCache } = useOffline();

  const [projectTemplateInput, setProjectTemplateInput] = useState(config.projectTemplate);
  const [esmUrlInput, setEsmUrlInput] = useState(config.esmUrl);
  const [corsProxyInput, setCorsProxyInput] = useState(config.corsProxy);
  const [faviconUrlInput, setFaviconUrlInput] = useState(config.faviconUrl);
  const [previewDomainInput, setPreviewDomainInput] = useState(config.previewDomain);
  const [showcaseModeratorInput, setShowcaseModeratorInput] = useState(config.showcaseModerator);
  const [fsPathProjectsInput, setFsPathProjectsInput] = useState(config.fsPathProjects);
  const [fsPathConfigInput, setFsPathConfigInput] = useState(config.fsPathConfig);
  const [fsPathTmpInput, setFsPathTmpInput] = useState(config.fsPathTmp);

  // Service Worker state
  const [swState, setSwState] = useState<string>('');
  const [isUpdatingSW, setIsUpdatingSW] = useState(false);
  const [isUnregisteringSW, setIsUnregisteringSW] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Monitor Service Worker state
  useEffect(() => {
    if (serviceWorkerRegistration?.active) {
      setSwState(serviceWorkerRegistration.active.state);

      const handleStateChange = () => {
        if (serviceWorkerRegistration.active) {
          setSwState(serviceWorkerRegistration.active.state);
        }
      };

      serviceWorkerRegistration.active.addEventListener('statechange', handleStateChange);

      return () => {
        serviceWorkerRegistration.active?.removeEventListener('statechange', handleStateChange);
      };
    }
  }, [serviceWorkerRegistration]);

  const handleUpdateSW = async () => {
    setIsUpdatingSW(true);
    try {
      await updateServiceWorker();
      toast({
        title: "Service Worker Updated",
        description: "The service worker has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update service worker",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSW(false);
    }
  };

  const handleUnregisterSW = async () => {
    setIsUnregisteringSW(true);
    try {
      if (serviceWorkerRegistration) {
        const success = await serviceWorkerRegistration.unregister();
        if (success) {
          toast({
            title: "Service Worker Unregistered",
            description: "The service worker has been unregistered. Refresh the page to complete the process.",
          });
        } else {
          throw new Error("Failed to unregister service worker");
        }
      }
    } catch (error) {
      toast({
        title: "Unregister Failed",
        description: error instanceof Error ? error.message : "Failed to unregister service worker",
        variant: "destructive",
      });
    } finally {
      setIsUnregisteringSW(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearCache();
      toast({
        title: "Cache Cleared",
        description: "All service worker caches have been cleared.",
      });
    } catch (error) {
      toast({
        title: "Clear Cache Failed",
        description: error instanceof Error ? error.message : "Failed to clear cache",
        variant: "destructive",
      });
    } finally {
      setIsClearingCache(false);
    }
  };

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
        {/* Service Worker Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="service-worker" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">Service Worker</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-4">
                {serviceWorkerRegistration ? (
                  <>
                    {/* Service Worker Status */}
                    <div className="space-y-2">
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="font-medium capitalize">{swState || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Scope:</span>
                          <span className="font-mono text-xs">{serviceWorkerRegistration.scope}</span>
                        </div>
                        {serviceWorkerRegistration.active && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Script URL:</span>
                            <span className="font-mono text-xs truncate max-w-[200px]" title={serviceWorkerRegistration.active.scriptURL}>
                              {serviceWorkerRegistration.active.scriptURL.split('/').pop()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Service Worker Controls */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleUpdateSW}
                        disabled={isUpdatingSW}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        {isUpdatingSW ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Update
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleClearCache}
                        disabled={isClearingCache}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        {isClearingCache ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Clearing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Clear Cache
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleUnregisterSW}
                        disabled={isUnregisteringSW}
                        variant="destructive"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        {isUnregisteringSW ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Unregistering...
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Unregister
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No service worker is currently registered. Service workers are automatically registered when you load the application.
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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

        {/* Favicon URL Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="favicon-url" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">Favicon URL</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <Input
                  id="favicon-url"
                  type="url"
                  placeholder="https://external-content.duckduckgo.com/ip3/{hostname}.ico"
                  value={faviconUrlInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFaviconUrlInput(value);
                    updateConfig((current) => ({
                      ...current,
                      faviconUrl: value,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  URL template for fetching favicons. Available variables: {'{hostname}'}, {'{origin}'}, {'{href}'}, {'{protocol}'}, {'{pathname}'}
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

        {/* Filesystem Paths Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="filesystem-paths" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h4 className="text-sm font-medium">Filesystem Paths</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fs-path-projects" className="text-sm font-medium">
                    Projects Directory
                  </Label>
                  <Input
                    id="fs-path-projects"
                    type="text"
                    placeholder="/projects"
                    value={fsPathProjectsInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFsPathProjectsInput(value);
                      updateConfig((current) => ({
                        ...current,
                        fsPathProjects: value,
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Filesystem path where projects are stored
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fs-path-config" className="text-sm font-medium">
                    Config Directory
                  </Label>
                  <Input
                    id="fs-path-config"
                    type="text"
                    placeholder="/config"
                    value={fsPathConfigInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFsPathConfigInput(value);
                      updateConfig((current) => ({
                        ...current,
                        fsPathConfig: value,
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Filesystem path where configuration files are stored
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fs-path-tmp" className="text-sm font-medium">
                    Temporary Directory
                  </Label>
                  <Input
                    id="fs-path-tmp"
                    type="text"
                    placeholder="/tmp"
                    value={fsPathTmpInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFsPathTmpInput(value);
                      updateConfig((current) => ({
                        ...current,
                        fsPathTmp: value,
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Filesystem path for temporary files
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