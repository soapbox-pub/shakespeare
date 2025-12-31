import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, ExternalLink, Loader2, AlertTriangle, Code, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { EmailSubscription } from '@/components/EmailSubscription';

export function AboutSettings() {
  const { t } = useTranslation();
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
    <SettingsPageLayout
      icon={Info}
      titleKey="aboutShakespeare"
      descriptionKey="aboutShakespeareDescription"
    >

      {/* Email Updates */}
      <EmailSubscription />

      <div className="space-y-3">
        {/* Mirrors */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="mirrors">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-muted-foreground" />
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
                    <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 flex items-center gap-2 justify-start"
                  asChild
                >
                  <a href="https://shakespeare-diy.github.io" target="_blank" rel="noopener noreferrer">
                    <span className="font-mono text-sm">shakespeare-diy.github.io</span>
                    <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 flex items-center gap-2 justify-start"
                  asChild
                >
                  <a href="https://shakespeare-b0b9c8.gitlab.io" target="_blank" rel="noopener noreferrer">
                    <span className="font-mono text-sm">shakespeare-b0b9c8.gitlab.io</span>
                    <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
                  </a>
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Project Information */}
        <Card>
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full h-12 flex items-center gap-2 justify-start text-base"
              asChild
            >
              <a href="https://gitlab.com/soapbox-pub/shakespeare" target="_blank">
                <Code className="!size-5 text-muted-foreground" />
                {t('sourceCode')}
                <ExternalLink className="ml-auto" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* License */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="license-text">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-muted-foreground" />
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
    </SettingsPageLayout>
  );
}

export default AboutSettings;