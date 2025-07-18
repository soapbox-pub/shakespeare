// Service Worker for serving files from LightningFS filesystem
const CACHE_NAME = 'shakespeare-fs-v1';

// Store pending file requests
const pendingRequests = new Map();

// Handle file requests from the virtual filesystem
async function handleFileRequest(url) {
  const urlObj = new URL(url);
  const pathMatch = urlObj.pathname.match(/^\/project\/([^\/]+)\/files\/(.+)$/);

  if (!pathMatch) {
    return new Response('Not Found', { status: 404 });
  }

  const [, projectId, filePath] = pathMatch;

  try {
    // Request file content from main thread via message
    const fileContent = await requestFileFromMainThread(projectId, filePath);

    if (fileContent === null) {
      return new Response('File Not Found', { status: 404 });
    }

    // Determine content type based on file extension
    const contentType = getContentType(filePath);

    return new Response(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache', // Don't cache for development
      },
    });
  } catch (error) {
    return new Response('File Not Found', { status: 404 });
  }
}

// Request file content from main thread
async function requestFileFromMainThread(projectId, filePath) {
  return new Promise((resolve) => {
    const messageId = Math.random().toString(36).substr(2, 9);

    // Store the resolver for this request
    pendingRequests.set(messageId, resolve);

    // Send request to all clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'FILE_REQUEST',
          messageId,
          projectId,
          filePath
        });
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (pendingRequests.has(messageId)) {
        pendingRequests.delete(messageId);
        resolve(null);
      }
    }, 5000);
  });
}

// Get content type based on file extension
function getContentType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'jsx': 'application/javascript',
    'ts': 'application/javascript',
    'tsx': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
  };

  return mimeTypes[ext] || 'text/plain';
}

// Top-level message event listener - must be added during initial evaluation
self.addEventListener('message', (event) => {
  if (event.data.type === 'FILE_RESPONSE' && event.data.messageId) {
    const messageId = event.data.messageId;
    const resolver = pendingRequests.get(messageId);

    if (resolver) {
      pendingRequests.delete(messageId);
      resolver(event.data.content);
    }
  }
});

// Service Worker event listeners
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only handle requests for project files
  if (url.includes('/project/') && url.includes('/files/')) {
    event.respondWith(handleFileRequest(url));
  }
});