import { Settings, ArrowLeft, RefreshCw, Trash2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/hooks/useAppContext";
import { useOffline } from "@/hooks/useOffline";
import { useToast } from "@/hooks/useToast";
import { defaultSystemPrompt } from "@/lib/system";

export function SystemSettings() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { config, defaultConfig, updateConfig } = useAppContext();
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
  const [fsPathPluginsInput, setFsPathPluginsInput] = useState(config.fsPathPlugins);
  const [sentryDsnInput, setSentryDsnInput] = useState(config.sentryDsn);
  const [systemPromptInput, setSystemPromptInput] = useState(config.systemPrompt || defaultSystemPrompt);

  // Check which settings differ from defaults
  const isModified = useMemo(() => ({
    projectTemplate: config.projectTemplate !== defaultConfig.projectTemplate,
    esmUrl: config.esmUrl !== defaultConfig.esmUrl,
    corsProxy: config.corsProxy !== defaultConfig.corsProxy,
    faviconUrl: config.faviconUrl !== defaultConfig.faviconUrl,
    previewDomain: config.previewDomain !== defaultConfig.previewDomain,
    showcaseEnabled: config.showcaseEnabled !== defaultConfig.showcaseEnabled,
    showcaseModerator: config.showcaseModerator !== defaultConfig.showcaseModerator,
    fsPathProjects: config.fsPathProjects !== defaultConfig.fsPathProjects,
    fsPathConfig: config.fsPathConfig !== defaultConfig.fsPathConfig,
    fsPathTmp: config.fsPathTmp !== defaultConfig.fsPathTmp,
    fsPathPlugins: config.fsPathPlugins !== defaultConfig.fsPathPlugins,
    sentryDsn: config.sentryDsn !== defaultConfig.sentryDsn,
    systemPrompt: (config.systemPrompt || defaultSystemPrompt) !== (defaultConfig.systemPrompt || defaultSystemPrompt),
  }), [config, defaultConfig]);

  // Restore functions
  const restoreProjectTemplate = () => {
    const defaultValue = defaultConfig.projectTemplate;
    setProjectTemplateInput(defaultValue);
    updateConfig((current) => ({ ...current, projectTemplate: defaultValue }));
  };

  const restoreEsmUrl = () => {
    const defaultValue = defaultConfig.esmUrl;
    setEsmUrlInput(defaultValue);
    updateConfig((current) => ({ ...current, esmUrl: defaultValue }));
  };

  const restoreCorsProxy = () => {
    const defaultValue = defaultConfig.corsProxy;
    setCorsProxyInput(defaultValue);
    updateConfig((current) => ({ ...current, corsProxy: defaultValue }));
  };

  const restoreFaviconUrl = () => {
    const defaultValue = defaultConfig.faviconUrl;
    setFaviconUrlInput(defaultValue);
    updateConfig((current) => ({ ...current, faviconUrl: defaultValue }));
  };

  const restorePreviewDomain = () => {
    const defaultValue = defaultConfig.previewDomain;
    setPreviewDomainInput(defaultValue);
    updateConfig((current) => ({ ...current, previewDomain: defaultValue }));
  };

  const restoreShowcaseEnabled = () => {
    const defaultValue = defaultConfig.showcaseEnabled;
    updateConfig((current) => ({ ...current, showcaseEnabled: defaultValue }));
  };

  const restoreShowcaseModerator = () => {
    const defaultValue = defaultConfig.showcaseModerator;
    setShowcaseModeratorInput(defaultValue);
    updateConfig((current) => ({ ...current, showcaseModerator: defaultValue }));
  };

  const restoreFsPathProjects = () => {
    const defaultValue = defaultConfig.fsPathProjects;
    setFsPathProjectsInput(defaultValue);
    updateConfig((current) => ({ ...current, fsPathProjects: defaultValue }));
  };

  const restoreFsPathConfig = () => {
    const defaultValue = defaultConfig.fsPathConfig;
    setFsPathConfigInput(defaultValue);
    updateConfig((current) => ({ ...current, fsPathConfig: defaultValue }));
  };

  const restoreFsPathTmp = () => {
    const defaultValue = defaultConfig.fsPathTmp;
    setFsPathTmpInput(defaultValue);
    updateConfig((current) => ({ ...current, fsPathTmp: defaultValue }));
  };

  const restoreFsPathPlugins = () => {
    const defaultValue = defaultConfig.fsPathPlugins;
    setFsPathPluginsInput(defaultValue);
    updateConfig((current) => ({ ...current, fsPathPlugins: defaultValue }));
  };

  const restoreSentryDsn = () => {
    const defaultValue = defaultConfig.sentryDsn;
    setSentryDsnInput(defaultValue);
    updateConfig((current) => ({ ...current, sentryDsn: defaultValue }));
  };

  const restoreSystemPrompt = () => {
    const defaultValue = defaultSystemPrompt;
    setSystemPromptInput(defaultValue);
    updateConfig((current) => ({ ...current, systemPrompt: defaultValue }));
  };

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
        title: t('serviceWorkerUpdated'),
        description: t('serviceWorkerUpdatedDescription'),
      });
    } catch (error) {
      toast({
        title: t('serviceWorkerUpdateFailed'),
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
            title: t('serviceWorkerUnregistered'),
            description: t('serviceWorkerUnregisteredDescription'),
          });
        } else {
          throw new Error("Failed to unregister service worker");
        }
      }
    } catch (error) {
      toast({
        title: t('serviceWorkerUnregisterFailed'),
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
        title: t('serviceWorkerCacheCleared'),
        description: t('serviceWorkerCacheClearedDescription'),
      });
    } catch (error) {
      toast({
        title: t('serviceWorkerClearCacheFailed'),
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
              <h4 className="text-sm font-medium">{t('serviceWorker')}</h4>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-4">
                {serviceWorkerRegistration ? (
                  <>
                    {/* Service Worker Status */}
                    <div className="space-y-2">
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('serviceWorkerStatus')}</span>
                          <span className="font-medium capitalize">{swState || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('serviceWorkerScope')}</span>
                          <span className="font-mono text-xs">{serviceWorkerRegistration.scope}</span>
                        </div>
                        {serviceWorkerRegistration.active && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('serviceWorkerScriptUrl')}</span>
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
                            {t('serviceWorkerUpdating')}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            {t('serviceWorkerUpdate')}
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
                            {t('serviceWorkerClearing')}
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            {t('serviceWorkerClearCache')}
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
                            {t('serviceWorkerUnregistering')}
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            {t('serviceWorkerUnregister')}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {t('serviceWorkerNotRegistered')}
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
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('projectTemplate')}</h4>
                {isModified.projectTemplate && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2">
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
                    className="flex-1"
                  />
                  {isModified.projectTemplate && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={restoreProjectTemplate}
                      title={t('restoreToDefault')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('corsProxy')}</h4>
                {isModified.corsProxy && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2">
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
                    className="flex-1"
                  />
                  {isModified.corsProxy && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={restoreCorsProxy}
                      title={t('restoreToDefault')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('faviconUrl')}</h4>
                {isModified.faviconUrl && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="favicon-url"
                    type="url"
                    placeholder="https://favicon.shakespeare.diy/?url={href}"
                    value={faviconUrlInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFaviconUrlInput(value);
                      updateConfig((current) => ({
                        ...current,
                        faviconUrl: value,
                      }));
                    }}
                    className="flex-1"
                  />
                  {isModified.faviconUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={restoreFaviconUrl}
                      title={t('restoreToDefault')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('faviconUrlDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* JavaScript CDN Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="esm-url" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('esmUrl')}</h4>
                {isModified.esmUrl && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="esm-url"
                    type="url"
                    placeholder="https://esm.sh"
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
                    className="flex-1"
                  />
                  {isModified.esmUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={restoreEsmUrl}
                      title={t('restoreToDefault')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('previewDomain')}</h4>
                {isModified.previewDomain && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2">
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
                    className="flex-1"
                  />
                  {isModified.previewDomain && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={restorePreviewDomain}
                      title={t('restoreToDefault')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('showcase')}</h4>
                {(isModified.showcaseEnabled || isModified.showcaseModerator) && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="showcase-enabled" className="text-sm font-medium">
                      {t('showcaseEnabled')}
                    </Label>
                    {isModified.showcaseEnabled && (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
                    {isModified.showcaseEnabled && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restoreShowcaseEnabled}
                        title={t('restoreToDefault')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('showcaseEnabledDescription')}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="showcase-moderator" className="text-sm font-medium">
                      {t('showcaseModerator')}
                    </Label>
                    {isModified.showcaseModerator && (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                    )}
                  </div>
                  <div className="flex gap-2">
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
                      className="flex-1"
                    />
                    {isModified.showcaseModerator && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restoreShowcaseModerator}
                        title={t('restoreToDefault')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('showcaseModeratorDescription')}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Sentry DSN Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="sentry-dsn" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('sentryDsn')}</h4>
                {isModified.sentryDsn && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="sentry-dsn"
                    type="text"
                    placeholder="https://..."
                    value={sentryDsnInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSentryDsnInput(value);
                      updateConfig((current) => ({
                        ...current,
                        sentryDsn: value,
                      }));
                    }}
                    className="flex-1"
                  />
                  {isModified.sentryDsn && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={restoreSentryDsn}
                      title={t('restoreToDefault')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('sentryDsnDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Filesystem Paths Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="filesystem-paths" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('filesystemPaths')}</h4>
                {(isModified.fsPathProjects || isModified.fsPathConfig || isModified.fsPathTmp || isModified.fsPathPlugins) && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fs-path-projects" className="text-sm font-medium">
                      {t('projectsDirectory')}
                    </Label>
                    {isModified.fsPathProjects && (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                    )}
                  </div>
                  <div className="flex gap-2">
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
                      className="flex-1"
                    />
                    {isModified.fsPathProjects && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restoreFsPathProjects}
                        title={t('restoreToDefault')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('projectsDirectoryDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fs-path-config" className="text-sm font-medium">
                      {t('configDirectory')}
                    </Label>
                    {isModified.fsPathConfig && (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                    )}
                  </div>
                  <div className="flex gap-2">
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
                      className="flex-1"
                    />
                    {isModified.fsPathConfig && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restoreFsPathConfig}
                        title={t('restoreToDefault')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('configDirectoryDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fs-path-tmp" className="text-sm font-medium">
                      {t('temporaryDirectory')}
                    </Label>
                    {isModified.fsPathTmp && (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                    )}
                  </div>
                  <div className="flex gap-2">
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
                      className="flex-1"
                    />
                    {isModified.fsPathTmp && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restoreFsPathTmp}
                        title={t('restoreToDefault')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('temporaryDirectoryDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fs-path-plugins" className="text-sm font-medium">
                      {t('pluginsDirectory')}
                    </Label>
                    {isModified.fsPathPlugins && (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="fs-path-plugins"
                      type="text"
                      placeholder="/plugins"
                      value={fsPathPluginsInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFsPathPluginsInput(value);
                        updateConfig((current) => ({
                          ...current,
                          fsPathPlugins: value,
                        }));
                      }}
                      className="flex-1"
                    />
                    {isModified.fsPathPlugins && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restoreFsPathPlugins}
                        title={t('restoreToDefault')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('pluginsDirectoryDescription')}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* System Prompt Configuration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="system-prompt" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('systemPrompt')}</h4>
                {isModified.systemPrompt && (
                  <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="py-1 space-y-2">
                <div className="flex gap-2 flex-col">
                  <Textarea
                    id="system-prompt"
                    placeholder="Enter EJS template..."
                    value={systemPromptInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSystemPromptInput(value);
                      updateConfig((current) => ({
                        ...current,
                        systemPrompt: value,
                      }));
                    }}
                    className="flex-1 font-mono text-xs min-h-[400px]"
                  />
                  {isModified.systemPrompt && (
                    <Button
                      variant="outline"
                      onClick={restoreSystemPrompt}
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t('restoreToDefault')}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('systemPromptDescription')}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

export default SystemSettings;