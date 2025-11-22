import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Trash2, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAISettings } from '@/hooks/useAISettings';
import { useToast } from '@/hooks/useToast';
import { useMCPServerStatus } from '@/hooks/useMCPServerStatus';
import type { MCPServer } from '@/contexts/AISettingsContext';
import { cn } from '@/lib/utils';

function MCPConnectionStatus({ server }: { server: MCPServer }) {
  const status = useMCPServerStatus(server);

  return (
    <div className="flex items-center gap-1.5 ml-auto mr-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'connected' && 'bg-green-500',
          status === 'offline' && 'bg-red-500',
          status === 'checking' && 'bg-yellow-500 animate-pulse'
        )}
      />
      <span className="text-xs text-muted-foreground capitalize">
        {status}
      </span>
    </div>
  );
}

export function MCPServersSection() {
  const { t } = useTranslation();
  const { settings, setMCPServer, removeMCPServer } = useAISettings();
  const { toast } = useToast();
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverType] = useState<'streamable-http'>('streamable-http'); // Only streamable-http is supported

  const mcpServers = settings.mcpServers || {};
  const serverEntries = Object.entries(mcpServers);

  const handleAddServer = () => {
    if (!serverName.trim() || !serverUrl.trim()) return;

    if (mcpServers[serverName.trim()]) {
      toast({
        title: t('error'),
        description: t('mcpServerAddFailed'),
        variant: 'destructive',
      });
      return;
    }

    const newServer: MCPServer = {
      type: serverType,
      url: serverUrl.trim(),
    };

    setMCPServer(serverName.trim(), newServer);

    toast({
      title: t('mcpServerAdded'),
      description: t('mcpServerAddedDescription', { name: serverName.trim() }),
    });

    setServerName('');
    setServerUrl('');
  };

  const handleRemoveServer = (name: string) => {
    removeMCPServer(name);

    toast({
      title: t('mcpServerDeleted'),
      description: t('mcpServerDeletedDescription', { name }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Divider */}
      <Separator className="my-6" />

      {/* MCP Servers Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('mcpServers')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('mcpServersDescription')}
        </p>
      </div>

      {/* Configured MCP Servers List */}
      {serverEntries.length > 0 ? (
        <div className="space-y-2">
          {serverEntries.map(([name, server]) => (
            <Accordion key={name} type="single" collapsible className="w-full">
              <AccordionItem value={name} className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2 w-full mr-3">
                    <Server size={16} className="text-primary" />
                    <span className="font-medium">{name}</span>
                    <MCPConnectionStatus server={server} />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`${name}-type`}>{t('mcpServerType')}</Label>
                      <Select value={server.type} disabled>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="streamable-http">{t('mcpServerTypeStreamableHttp')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${name}-url`}>{t('mcpServerUrl')}</Label>
                      <Input
                        id={`${name}-url`}
                        value={server.url}
                        onChange={(e) => setMCPServer(name, { ...server, url: e.target.value })}
                        placeholder="https://example.com/mcp"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveServer(name)}
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
            {t('noMcpServersConfigured')}
          </AlertDescription>
        </Alert>
      )}

      {/* Add New MCP Server */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="add-server" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">{t('addMcpServer')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('mcpServerDescription')}
              </p>
              <div className="grid gap-2">
                <Label htmlFor="new-server-name">{t('mcpServerName')}</Label>
                <Input
                  id="new-server-name"
                  placeholder="e.g., my-mcp-server"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-server-type">{t('mcpServerType')}</Label>
                <Select value={serverType} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="streamable-http">{t('mcpServerTypeStreamableHttp')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only Streamable HTTP transport is currently supported
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-server-url">{t('mcpServerUrl')}</Label>
                <Input
                  id="new-server-url"
                  placeholder="https://example.com/mcp"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddServer}
                disabled={!serverName.trim() || !serverUrl.trim() || !!mcpServers[serverName.trim()]}
                className="gap-2 w-full"
              >
                <Check className="h-4 w-4" />
                {t('add')}
              </Button>
              {mcpServers[serverName.trim()] && (
                <p className="text-sm text-destructive">
                  A server with this name already exists
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
