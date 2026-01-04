/**
 * Keystore persistence utilities
 * Saves/loads signing keys from localStorage
 */
import type { SigningKey } from './signing';
import { importKeyFromPkcs12, exportKeyToPkcs12 } from './signing';

const STORAGE_KEY = 'shakespeare:apk-signing-key';

export interface StoredKeyInfo {
  alias: string;
  commonName: string;
  createdAt: string;
  expiresAt: string;
}

interface StoredKeyData {
  p12Base64: string;
  info: StoredKeyInfo;
}

/**
 * Check if a signing key is saved in localStorage
 */
export function hasSavedKey(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null;
  } catch {
    return false;
  }
}

/**
 * Get info about the saved key without loading it
 */
export function getSavedKeyInfo(): StoredKeyInfo | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: StoredKeyData = JSON.parse(stored);
    return data.info;
  } catch {
    return null;
  }
}

/**
 * Load a saved signing key from localStorage
 * Requires the password to decrypt the PKCS#12 data
 */
export function loadSavedKey(password: string): SigningKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    throw new Error('No saved signing key found');
  }

  const data: StoredKeyData = JSON.parse(stored);
  const p12Buffer = Uint8Array.from(atob(data.p12Base64), c => c.charCodeAt(0));

  return importKeyFromPkcs12(p12Buffer.buffer, password);
}

/**
 * Save a signing key to localStorage
 * The key is stored as encrypted PKCS#12 data
 */
export function saveKey(key: SigningKey, password: string): void {
  const p12Data = exportKeyToPkcs12(key, password);
  const p12Base64 = btoa(String.fromCharCode(...p12Data));

  // Extract certificate info
  const cert = key.certificate;
  const commonName = cert.subject.getField('CN')?.value || key.alias;

  const data: StoredKeyData = {
    p12Base64,
    info: {
      alias: key.alias,
      commonName: typeof commonName === 'string' ? commonName : key.alias,
      createdAt: cert.validity.notBefore.toISOString(),
      expiresAt: cert.validity.notAfter.toISOString(),
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Delete the saved signing key from localStorage
 */
export function deleteSavedKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}
