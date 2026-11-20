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

// Precaching is for offline use over the web. The Cache API stores only http(s) requests, so for a
// Din app from a folder (din+file://, already local) it would fail the install, and with it the worker.
if (location.protocol === 'https:' || location.protocol === 'http:') {
  precacheAndRoute(self.__WB_MANIFEST);
  cleanupOutdatedCaches();
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
}

// Take the pages at once on first install, so the assistant can run here without a reload. (An
// update only activates once the update prompt asks, and the page reloads then anyway.)
sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

// The update prompt's "Update" (vite-plugin-pwa's registerType: 'prompt')
sw.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void sw.skipWaiting();
  }
});
