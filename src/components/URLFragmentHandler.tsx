import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AddProviderDialog } from '@/components/AddProviderDialog';
import type { AIProvider } from '@/contexts/AISettingsContext';

/**
 * Component that handles URL fragments for adding AI providers
 * Example URL: https://shakespeare.diy/#id=openrouter&baseURL=https://openrouter.ai/api&apiKey=sk-123
 */
export function URLFragmentHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const [providerFromURL, setProviderFromURL] = useState<AIProvider | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Only process if there's a hash
    if (!location.hash) return;

    // Remove the leading '#' and parse as URLSearchParams
    const fragment = location.hash.slice(1);
    const params = new URLSearchParams(fragment);

    // Check if we have the required parameters for a provider
    const id = params.get('id');
    const baseURL = params.get('baseURL');

    if (!id || !baseURL) {
      // Not a provider URL, ignore
      return;
    }

    // Build the provider object
    const provider: AIProvider = {
      id,
      baseURL,
    };

    // Add optional parameters
    const apiKey = params.get('apiKey');
    if (apiKey) {
      provider.apiKey = apiKey;
    }

    const nostr = params.get('nostr');
    if (nostr === 'true') {
      provider.nostr = true;
    }

    const proxy = params.get('proxy');
    if (proxy === 'true') {
      provider.proxy = true;
    }

    // Set the provider and open dialog
    setProviderFromURL(provider);
    setDialogOpen(true);

    // Remove the fragment from the URL immediately
    // Preserve the current path and search params
    navigate(location.pathname + location.search, { replace: true });
  }, [location, navigate]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setProviderFromURL(null);
  };

  if (!providerFromURL) {
    return null;
  }

  return (
    <AddProviderDialog
      open={dialogOpen}
      onOpenChange={handleDialogClose}
      provider={providerFromURL}
    />
  );
}
