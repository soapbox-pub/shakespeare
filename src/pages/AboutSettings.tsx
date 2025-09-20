import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ExternalLink, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIsMobile } from '@/hooks/useIsMobile';

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

        const response = await fetch('/LICENSE.txt');

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

      <div className="space-y-4">
        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {t('sourceCode')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button
                variant="outline"
                asChild
                className="w-full sm:w-auto"
              >
                <a
                  href="https://gitlab.com/soapbox-pub/act2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('viewOnGitLab')}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* License */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {t('license')}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              <ScrollArea className="h-96 w-full rounded-md border p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {license}
                </pre>
              </ScrollArea>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AboutSettings;