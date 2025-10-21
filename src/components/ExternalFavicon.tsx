import { useAppContext } from '@/hooks/useAppContext';
import { faviconUrl, normalizeUrl } from '@/lib/faviconUrl';
import { ReactNode } from 'react';

interface ExternalFaviconProps {
  /** The URL to fetch the favicon for */
  url: string;
  /** Size of the favicon in pixels */
  size?: number;
  /** Fallback element to display if favicon fails to load */
  fallback?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ExternalFavicon component that fetches and displays a favicon for a given URL
 * using the configurable favicon service from app settings.
 */
export function ExternalFavicon({
  url,
  size = 16,
  fallback,
  className = '',
}: ExternalFaviconProps) {
  const { config } = useAppContext();

  // Normalize the URL to ensure it has a protocol
  const normalizedUrl = normalizeUrl(url);

  // Generate the favicon URL using the configured template
  const faviconSrc = faviconUrl(config.faviconUrl, normalizedUrl);

  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={faviconSrc}
        alt=""
        className="object-contain"
        style={{ width: size, height: size }}
        onError={(e) => {
          // Hide the image and show the fallback on error
          e.currentTarget.style.display = 'none';
          const fallbackElement = e.currentTarget.nextElementSibling as HTMLElement;
          if (fallbackElement) {
            fallbackElement.style.display = 'inline-block';
          }
        }}
      />
      {fallback && (
        <span style={{ display: 'none' }}>
          {fallback}
        </span>
      )}
    </span>
  );
}
