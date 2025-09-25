/**
 * Utility functions for managing persistent storage in the browser
 */

/**
 * Checks if persistent storage is supported by the browser
 */
export function isPersistentStorageSupported(): boolean {
  return 'storage' in navigator && 'persist' in navigator.storage;
}

/**
 * Checks if persistent storage is already granted
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if (!isPersistentStorageSupported()) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch (error) {
    console.warn('Failed to check persistent storage status:', error);
    return false;
  }
}

/**
 * Requests persistent storage from the browser
 * Returns true if granted, false if denied or not supported
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!isPersistentStorageSupported()) {
    console.warn('Persistent storage is not supported in this browser');
    return false;
  }

  try {
    // Check if already granted
    const alreadyGranted = await isPersistentStorageGranted();
    if (alreadyGranted) {
      return true;
    }

    // Request persistent storage
    const granted = await navigator.storage.persist();
    return granted;
  } catch (error) {
    console.warn('Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Automatically requests persistent storage if not already granted
 * This is intended to be called silently after project creation/cloning
 * Returns true if persistent storage is available (either already granted or newly granted)
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    // Check if already granted
    const alreadyGranted = await isPersistentStorageGranted();
    if (alreadyGranted) {
      return true;
    }

    // Only request if supported
    if (!isPersistentStorageSupported()) {
      return false;
    }

    // Silently request persistent storage
    const granted = await requestPersistentStorage();

    if (granted) {
      console.log('Persistent storage granted automatically');
    } else {
      console.log('Persistent storage request denied or failed');
    }

    return granted;
  } catch (error) {
    console.warn('Failed to ensure persistent storage:', error);
    return false;
  }
}

/**
 * Gets current storage usage information
 */
export async function getStorageInfo(): Promise<{
  quota: number;
  usage: number;
  usageDetails?: Record<string, number>;
} | null> {
  if (!('storage' in navigator)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      usageDetails: (estimate as StorageEstimate & { usageDetails?: Record<string, number> }).usageDetails,
    };
  } catch (error) {
    console.warn('Failed to get storage information:', error);
    return null;
  }
}