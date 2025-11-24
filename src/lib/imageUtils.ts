/**
 * Converts a File to a base64-encoded data URL for API consumption.
 *
 * @param file - The file to convert
 * @returns Promise resolving to base64 data URL string
 */
export async function fileToUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

