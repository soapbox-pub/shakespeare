import { useEffect, useState } from 'react';
import { useFS } from '@/hooks/useFS';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface VFSImageProps {
  path: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  onError?: (error: string) => void;
}

export function VFSImage({ path, alt, className, onClick, onError }: VFSImageProps) {
  const { fs } = useFS();
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadImage() {
      try {
        setIsLoading(true);
        setError(null);

        // Read the file from VFS
        const imageData = await fs.readFile(path);

        if (!isMounted) return;

        // Determine MIME type from file extension
        const extension = path.split('.').pop()?.toLowerCase() || '';
        const mimeTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'bmp': 'image/bmp',
        };
        const mimeType = mimeTypes[extension] || 'image/png';

        // Convert bytes to base64
        const base64 = btoa(
          Array.from(imageData)
            .map(byte => String.fromCharCode(byte))
            .join('')
        );

        // Create data URI
        const uri = `data:${mimeType};base64,${base64}`;

        if (isMounted) {
          setDataUri(uri);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load image';
          setError(errorMessage);
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    }

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [fs, onError, path]);

  if (isLoading) {
    return <Skeleton className={className || 'w-full h-64'} />;
  }

  if (error || !dataUri) {
    return (
      <div className={className || 'w-full h-64 flex items-center justify-center bg-muted rounded'}>
        <div className="text-center text-muted-foreground space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto" />
          <p className="text-xs">{error || 'Failed to load image'}</p>
          <p className="text-xs font-mono">{path}</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={dataUri}
      alt={alt}
      className={className}
      onClick={onClick}
    />
  );
}
