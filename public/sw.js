// Service Worker for serving files from LightningFS filesystem
// Import LightningFS using importScripts (ServiceWorker compatible)
importScripts('https://unpkg.com/@isomorphic-git/lightning-fs@4.6.2/dist/lightning-fs.min.js');

// Initialize LightningFS in the service worker
const fs = new LightningFS('shakespeare-fs');
const projectsDir = '/projects';

// Handle file requests from the virtual filesystem
async function handleFileRequest(url) {
  const urlObj = new URL(url);
  const pathMatch = urlObj.pathname.match(/^\/project\/([^\/]+)\/files\/(.+)$/);

  if (!pathMatch) {
    return new Response('Not Found', { status: 404 });
  }

  const [, projectId, filePath] = pathMatch;

  try {
    // Read file directly from LightningFS
    const fullPath = `${projectsDir}/${projectId}/${filePath}`;
    const fileContent = await fs.promises.readFile(fullPath, 'utf8');

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
    console.error('Failed to read file:', error);
    return new Response('File Not Found', { status: 404 });
  }
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