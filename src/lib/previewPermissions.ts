/**
 * Remembered decisions for the preview's NIP-07 signer proxy.
 *
 * Decisions are scoped to (projectId, userPubkey). `signEvent` is remembered
 * per event kind, and per `d` tag for kind 30078 app data, so a grant to write
 * one app's record can't be used to overwrite another's. Encryption and
 * decryption of messages with other people are remembered per operation.
 */

export type PreviewPermissionType =
  | 'signEvent'
  | 'nip04.encrypt'
  | 'nip04.decrypt'
  | 'nip44.encrypt'
  | 'nip44.decrypt';

export interface PreviewPermissionScope {
  type: PreviewPermissionType;
  kind: number | null;
  dTag: string | null;
}

interface PreviewPermission extends PreviewPermissionScope {
  allowed: boolean;
}

interface PreviewAllowance {
  projectId: string;
  userPubkey: string;
  permissions: PreviewPermission[];
}

const STORAGE_KEY = 'shakespeare:preview-permissions';

function readAllowances(): PreviewAllowance[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return (parsed as PreviewAllowance[]).map((a) => ({
      ...a,
      permissions: Array.isArray(a.permissions) ? a.permissions : [],
    }));
  } catch {
    return [];
  }
}

function matchesScope(p: PreviewPermissionScope, scope: PreviewPermissionScope): boolean {
  return p.type === scope.type && p.kind === scope.kind && p.dTag === scope.dTag;
}

/** Look up a remembered decision. */
export function getPreviewPermission(
  projectId: string,
  userPubkey: string,
  scope: PreviewPermissionScope,
): 'allow' | 'deny' | 'ask' {
  const allowance = readAllowances().find((a) => a.projectId === projectId && a.userPubkey === userPubkey);
  const match = allowance?.permissions.find((p) => matchesScope(p, scope));
  if (!match) return 'ask';
  return match.allowed ? 'allow' : 'deny';
}

/** Remember a decision, replacing any earlier one for the same scope. */
export function setPreviewPermission(
  projectId: string,
  userPubkey: string,
  scope: PreviewPermissionScope,
  allowed: boolean,
): void {
  const allowances = readAllowances();
  let allowance = allowances.find((a) => a.projectId === projectId && a.userPubkey === userPubkey);
  if (!allowance) {
    allowance = { projectId, userPubkey, permissions: [] };
    allowances.push(allowance);
  }
  allowance.permissions = allowance.permissions.filter((p) => !matchesScope(p, scope));
  allowance.permissions.push({ ...scope, allowed });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allowances));
}
