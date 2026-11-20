/**
 * Shakespeare's service worker: the app's files for offline use (Workbox, as vite-plugin-pwa's
 * generated worker did), and the assistant, where Din lets it run with the windows closed
 * (`sw/agentHost.ts`).
 */
// Before anything that uses them (isomorphic-git needs Buffer)
import './lib/polyfills';

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

import { sw } from './sw/types';
import './sw/agentHost';

declare const self: { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// The update prompt's "Update" (vite-plugin-pwa's registerType: 'prompt')
sw.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void sw.skipWaiting();
  }
});
