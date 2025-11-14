import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ExternalLink, Loader2, AlertTriangle, ArrowLeft, Code, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIsMobile } from '@/hooks/useIsMobile';
import { EmailSubscription } from '@/components/EmailSubscription';

export function AboutSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [license, setLicense] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLicense = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/LICENSE.html');

        if (!response.ok) {
          throw new Error(`Failed to fetch license: ${response.status} ${response.statusText}`);
        }

        const licenseText = await response.text();
        setLicense(licenseText);
      } catch (err) {
        console.error('Failed to fetch license:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch license');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLicense();
  }, []);

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
              <Info className="h-6 w-6 text-primary" />
              {t('aboutShakespeare')}
            </h1>
            <p className="text-muted-foreground">
              {t('aboutShakespeareDescription')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Info className="h-6 w-6 text-primary" />
            {t('aboutShakespeare')}
          </h1>
          <p className="text-muted-foreground">
            {t('aboutShakespeareDescription')}
          </p>
        </div>
      )}

      <div className="space-y-6 max-w-xl">
        {/* Email Updates */}
        <EmailSubscription />

        <div className="space-y-3">
          {/* Mirrors */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="mirrors" className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('mirrors')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground mb-3">{t('mirrorsDescription')}</p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full h-10 flex items-center gap-2 justify-start"
                    asChild
                  >
                    <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer">
                      <span className="font-mono text-sm">shakespeare.diy</span>
                      <ExternalLink className="ml-auto h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-10 flex items-center gap-2 justify-start"
                    asChild
                  >
                    <a href="https://shakespeare-diy.github.io" target="_blank" rel="noopener noreferrer">
                      <span className="font-mono text-sm">shakespeare-diy.github.io</span>
                      <ExternalLink className="ml-auto h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-10 flex items-center gap-2 justify-start"
                    asChild
                  >
                    <a href="https://shakespeare-b0b9c8.gitlab.io" target="_blank" rel="noopener noreferrer">
                      <span className="font-mono text-sm">shakespeare-b0b9c8.gitlab.io</span>
                      <ExternalLink className="ml-auto h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Project Information */}
          <Button
            variant="outline"
            className="w-full h-12 flex items-center gap-2 justify-start text-base"
            asChild
          >
            <a href="https://gitlab.com/soapbox-pub/shakespeare" target="_blank">
              <Code className="!size-5" />
              {t('sourceCode')}
              <ExternalLink className="ml-auto" />
            </a>
          </Button>

          {/* License */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="license-text" className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  {t('license')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t('loadingLicense')}</span>
                  </div>
                ) : error ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {t('failedToLoadLicense')}: {error}
                    </AlertDescription>
                  </Alert>
                ) : license ? (
                  <div
                    className="prose text-sm dark:prose-invert mx-auto"
                    dangerouslySetInnerHTML={{ __html: license }}
                  />
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {import.meta.env.VERSION && (
          <div className="text-center text-xs text-muted-foreground/60 pt-4">
            v{import.meta.env.VERSION}
          </div>
        )}
      </div>
    </div>
  );
}

export default AboutSettings;