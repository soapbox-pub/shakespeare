/**
 * Unsent text in each project's chat composer, kept in localStorage so it
 * survives reloads and switching projects. Attachments are not saved.
 */

const STORAGE_PREFIX = 'shakespeare:chat-draft:';

export function readChatDraft(projectId: string): string {
  try {
    return localStorage.getItem(STORAGE_PREFIX + projectId) ?? '';
  } catch {
    return '';
  }
}

export function writeChatDraft(projectId: string, draft: string): void {
  try {
    if (draft) {
      localStorage.setItem(STORAGE_PREFIX + projectId, draft);
    } else {
      localStorage.removeItem(STORAGE_PREFIX + projectId);
    }
  } catch {
    // Storage full or unavailable; the draft just won't survive a reload.
  }
}

export function moveChatDraft(fromProjectId: string, toProjectId: string): void {
  const draft = readChatDraft(fromProjectId);
  writeChatDraft(fromProjectId, '');
  writeChatDraft(toProjectId, draft);
}
