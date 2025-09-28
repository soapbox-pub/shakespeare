import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ExternalLink, Loader2, AlertTriangle, ArrowLeft, Code } from 'lucide-react';
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
      </div>
    </div>
  );
}

export default AboutSettings;