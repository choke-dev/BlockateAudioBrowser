const CACHE_NAME = 'blockate-audio-browser-v1';
const STATIC_CACHE_NAME = 'blockate-static-v1';

// Resources to cache immediately when the service worker is installed
const STATIC_RESOURCES = [
  '/',
  '/favicon.ico',
  '/audiodb.png',
];

// Resources that should use network-first strategy
const NETWORK_FIRST_PATTERNS = [
  /^\/api\//,           // All API routes
  /^\/auth\//,          // Authentication routes
  /\.json$/,            // JSON files
  /\.css$/,
  /\.js$/,
];

// Resources that should be cached (cache-first strategy)
const CACHE_FIRST_PATTERNS = [
  /\.(woff|woff2|ttf|eot)$/,         // Font files
  /\.(png|jpg|jpeg|gif|svg|ico)$/,   // Images
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        // Ensure the service worker takes control of all clients immediately
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine caching strategy based on URL patterns
  if (shouldUseNetworkFirst(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (shouldUseCacheFirst(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Default to network-first for everything else
    event.respondWith(networkFirstStrategy(request));
  }
});

/**
 * Network-first strategy: Try network first, fallback to cache
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    console.log('Service Worker: Network-first strategy for:', request.url);
    
    // Try to fetch from network
    const networkResponse = await fetch(request);
    
    // If successful, clone and cache the response
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      console.log('Service Worker: Cached fresh response for:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for:', request.url);
    
    // Network failed, try to get from cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // If not in cache either, return a fallback response for navigation requests
    if (request.mode === 'navigate') {
      console.log('Service Worker: Serving offline fallback for navigation');
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Offline - Blockate Audio Browser</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
                text-align: center;
                padding: 20px;
              }
              .offline-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
              h1 {
                margin-bottom: 0.5rem;
                color: #df3877;
              }
              p {
                margin-bottom: 2rem;
                opacity: 0.8;
              }
              button {
                background: #df3877;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1rem;
              }
              button:hover {
                background: #c12e68;
              }
            </style>
          </head>
          <body>
            <div class="offline-icon">📡</div>
            <h1>You're offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }
    
    // For other requests, throw the error
    throw error;
  }
}

/**
 * Cache-first strategy: Try cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('Service Worker: Serving from cache (cache-first):', request.url);
    return cachedResponse;
  }
  
  console.log('Service Worker: Cache miss, fetching from network (cache-first):', request.url);
  
  try {
    // Not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response if successful
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      console.log('Service Worker: Cached response (cache-first):', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Network and cache failed for:', request.url);
    throw error;
  }
}

/**
 * Check if URL should use network-first strategy
 */
function shouldUseNetworkFirst(pathname) {
  return NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Check if URL should use cache-first strategy
 */
function shouldUseCacheFirst(pathname) {
  return CACHE_FIRST_PATTERNS.some(pattern => pattern.test(pathname));
}

// Handle background sync for failed requests (optional enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here if needed
  console.log('Service Worker: Performing background sync...');
}

// Handle push notifications (optional enhancement)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('Service Worker: Push notification received:', data);
    
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'blockate-notification',
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    self.clients.openWindow('/')
  );
});