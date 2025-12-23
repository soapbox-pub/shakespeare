/**
 * Normalize a URL string to ensure it has a protocol
 * @param url - The URL string to normalize
 * @returns A fully-qualified URL string
 */
export function normalizeUrl(url: string): string {
  // If it already has a protocol, return as-is
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  // Add https:// prefix
  return `https://${url}`;
}
