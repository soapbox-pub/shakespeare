/**
 * BuildDebouncer manages automatic builds triggered by file changes.
 * It debounces build requests to avoid excessive builds while the AI is working.
 */
export class BuildDebouncer {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private pendingBuilds = new Map<string, Set<string>>();
  private readonly debounceMs: number;
  private readonly onBuild: (projectId: string, changedFiles: string[]) => void;

  constructor(
    debounceMs: number = 2000,
    onBuild: (projectId: string, changedFiles: string[]) => void
  ) {
    this.debounceMs = debounceMs;
    this.onBuild = onBuild;
  }

  /**
   * Register a file change for a project.
   * This will trigger a debounced build after the configured delay.
   */
  registerFileChange(projectId: string, filePath: string): void {
    // Track the changed file
    if (!this.pendingBuilds.has(projectId)) {
      this.pendingBuilds.set(projectId, new Set());
    }
    this.pendingBuilds.get(projectId)!.add(filePath);

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.triggerBuild(projectId);
    }, this.debounceMs);

    this.debounceTimers.set(projectId, timer);
  }

  /**
   * Trigger an immediate build for a project, bypassing the debounce.
   */
  triggerBuild(projectId: string): void {
    const changedFiles = Array.from(this.pendingBuilds.get(projectId) || []);
    
    if (changedFiles.length === 0) {
      return;
    }

    // Clear the pending builds and timer
    this.pendingBuilds.delete(projectId);
    const timer = this.debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(projectId);
    }

    // Trigger the build
    this.onBuild(projectId, changedFiles);
  }

  /**
   * Cancel any pending builds for a project.
   */
  cancel(projectId: string): void {
    const timer = this.debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(projectId);
    }
    this.pendingBuilds.delete(projectId);
  }

  /**
   * Check if a project has pending file changes.
   */
  hasPendingChanges(projectId: string): boolean {
    return (this.pendingBuilds.get(projectId)?.size || 0) > 0;
  }

  /**
   * Get the list of pending changed files for a project.
   */
  getPendingFiles(projectId: string): string[] {
    return Array.from(this.pendingBuilds.get(projectId) || []);
  }

  /**
   * Cleanup all timers (call on unmount/cleanup).
   */
  cleanup(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingBuilds.clear();
  }
}
