import { useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useGitStatus } from './useGitStatus';

interface PushReminderState {
  /** Whether push reminders are enabled */
  enabled: boolean;
  /** Number of messages since last push */
  messagesSinceLastPush: number;
  /** Timestamp when user last pushed or dismissed a reminder */
  lastInteraction: number;
  /** Project ID being tracked */
  currentProjectId: string | null;
}

const DEFAULT_STATE: PushReminderState = {
  enabled: true,
  messagesSinceLastPush: 0,
  lastInteraction: Date.now(),
  currentProjectId: null,
};

/** Number of messages before showing push reminder */
const MESSAGE_THRESHOLD = 2; // Lowered to 2 for easier testing

/** Minimum time in ms between showing reminders (5 minutes) */
const MIN_REMINDER_INTERVAL = 5 * 60 * 1000;

export function usePushReminder(projectId: string | null) {
  const [state, setState] = useLocalStorage<PushReminderState>(
    'push-reminder-state',
    DEFAULT_STATE
  );

  const { data: gitStatus } = useGitStatus(projectId);

  // Reset counter when switching projects
  useEffect(() => {
    if (projectId && state.currentProjectId !== projectId) {
      setState((prev) => ({
        ...prev,
        currentProjectId: projectId,
        messagesSinceLastPush: 0,
        lastInteraction: Date.now(),
      }));
    }
  }, [projectId, state.currentProjectId, setState]);

  // Check if should show reminder
  const shouldShowReminder = useCallback(() => {
    if (!state.enabled || !projectId || !gitStatus?.isGitRepo) {
      console.log('[PushReminder] Should NOT show - enabled:', state.enabled, 'projectId:', projectId, 'isGitRepo:', gitStatus?.isGitRepo);
      return false;
    }

    // Don't show if user recently interacted with push reminder
    const timeSinceLastInteraction = Date.now() - state.lastInteraction;
    if (timeSinceLastInteraction < MIN_REMINDER_INTERVAL) {
      console.log('[PushReminder] Should NOT show - too soon since last interaction:', Math.round(timeSinceLastInteraction / 1000), 'seconds');
      return false;
    }

    // Show if:
    // 1. There are uncommitted changes OR commits ahead of remote OR no remote configured
    // 2. Enough messages have been sent since last interaction
    const hasUnpushedWork =
      gitStatus.hasUncommittedChanges ||
      gitStatus.ahead > 0 ||
      gitStatus.remotes.length === 0;
    const enoughMessages = state.messagesSinceLastPush >= MESSAGE_THRESHOLD;

    console.log('[PushReminder] Check:', {
      hasUnpushedWork,
      enoughMessages,
      messageCount: state.messagesSinceLastPush,
      threshold: MESSAGE_THRESHOLD,
      hasUncommittedChanges: gitStatus.hasUncommittedChanges,
      ahead: gitStatus.ahead,
      remotesCount: gitStatus.remotes.length,
    });

    const shouldShow = hasUnpushedWork && enoughMessages;
    console.log('[PushReminder] Should show reminder:', shouldShow);

    return shouldShow;
  }, [state, projectId, gitStatus]);

  // Increment message counter
  const incrementMessages = useCallback(() => {
    if (!state.enabled || !projectId) {
      console.log('[PushReminder] Not incrementing - enabled:', state.enabled, 'projectId:', projectId);
      return;
    }

    const newCount = state.messagesSinceLastPush + 1;
    console.log('[PushReminder] Incrementing message counter to:', newCount);

    setState((prev) => ({
      ...prev,
      messagesSinceLastPush: prev.messagesSinceLastPush + 1,
    }));
  }, [state.enabled, projectId, setState, state.messagesSinceLastPush]);

  // Reset counter (called after push or dismiss)
  const resetReminder = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messagesSinceLastPush: 0,
      lastInteraction: Date.now(),
    }));
  }, [setState]);

  // Enable/disable reminders
  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      enabled,
      messagesSinceLastPush: 0,
      lastInteraction: Date.now(),
    }));
  }, [setState]);

  // Check if there's unpushed work that should trigger warning icon
  const hasUnpushedWork = gitStatus?.isGitRepo && (
    gitStatus.hasUncommittedChanges ||
    gitStatus.ahead > 0 ||
    gitStatus.remotes.length === 0
  );

  return {
    shouldShowReminder: shouldShowReminder(),
    incrementMessages,
    resetReminder,
    enabled: state.enabled,
    setEnabled,
    hasUnpushedWork: hasUnpushedWork || false,
    gitStatus,
  };
}
