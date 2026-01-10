import { useQuery } from '@tanstack/react-query';
import { useAppContext } from './useAppContext';
import { proxyUrl } from '@/lib/proxyUrl';

export interface OGMetadata {
  image: string | null;
  description: string | null;
}

/**
 * Hook to fetch Open Graph metadata from a web URL using CORS proxy
 * @param webUrl - The web URL to fetch OG metadata from
 * @returns Query result with OG image URL and description
 */
export function useOGImage(webUrl?: string) {
  const { config } = useAppContext();

  return useQuery({
    queryKey: ['og-metadata', webUrl],
    queryFn: async (): Promise<OGMetadata> => {
      if (!webUrl) {
        return { image: null, description: null };
      }

      try {
        // Use CORS proxy to fetch the HTML
        const proxiedUrl = proxyUrl(config.corsProxy, webUrl);
        const response = await fetch(proxiedUrl, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return { image: null, description: null };
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract OG image
        let ogImage: string | null = null;
        const ogImageMeta = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (ogImageMeta) {
          try {
            ogImage = new URL(ogImageMeta, webUrl).href;
          } catch {
            ogImage = ogImageMeta.startsWith('http') ? ogImageMeta : null;
          }
        }

        // Fallback to twitter:image if og:image not found
        if (!ogImage) {
          const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
          if (twitterImage) {
            try {
              ogImage = new URL(twitterImage, webUrl).href;
            } catch {
              ogImage = twitterImage.startsWith('http') ? twitterImage : null;
            }
          }
        }

        // Extract OG description
        let ogDescription: string | null = null;
        const ogDescriptionMeta = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        if (ogDescriptionMeta) {
          ogDescription = ogDescriptionMeta.trim();
        }

        // Fallback to twitter:description if og:description not found
        if (!ogDescription) {
          const twitterDescription = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
          if (twitterDescription) {
            ogDescription = twitterDescription.trim();
          }
        }

        return {
          image: ogImage,
          description: ogDescription || null,
        };
      } catch (error) {
        console.warn('Failed to fetch OG metadata:', error);
        return { image: null, description: null };
      }
    },
    enabled: !!webUrl,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });
}
