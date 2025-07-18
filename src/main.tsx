import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

import App from './App.tsx';
import './index.css';

// Using Inter Variable font for modern, clean typography
import '@fontsource-variable/inter';

// Register service worker for file serving
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered: ', registration);

      // Set up message handler for file requests from service worker
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data.type === 'FILE_REQUEST') {
          const { messageId, projectId, filePath } = event.data;

          try {
            // Dynamically import fsManager to avoid circular dependencies
            const { fsManager } = await import('./lib/fs');
            const content = await fsManager.readFile(projectId, filePath);

            // Send response back to service worker
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'FILE_RESPONSE',
                messageId,
                content
              });
            }
          } catch (error) {
            console.error('Failed to read file for service worker:', error);
            // Send null response to indicate file not found
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'FILE_RESPONSE',
                messageId,
                content: null
              });
            }
          }
        }
      });
    } catch (registrationError) {
      console.log('SW registration failed: ', registrationError);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
