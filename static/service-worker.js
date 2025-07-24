const CACHE_NAME = 'blockate-audio-browser-v2';
const STATIC_CACHE_NAME = 'blockate-static-v2';

// Resources to cache immediately when the service worker is installed
const STATIC_RESOURCES = [
  '/',
  '/offline',
  '/favicon.ico',
  '/audiodb.png',
  '/manifest.json',
];

// Cache configuration with patterns and durations (in milliseconds)
// null duration = no expiration, number = milliseconds until expiration, 0 = don't cache
const CACHE_CONFIG = [
  // Network-first patterns with offline caching for PWA functionality
  { pattern: /^\/api\/audio\/search/, strategy: 'network-first', duration: 60 * 60 * 1000 }, // Cache search results for 1 hour
  { pattern: /^\/api\/audio\/preview/, strategy: 'network-first', duration: 24 * 60 * 60 * 1000 }, // Cache preview URLs for 24 hours
  { pattern: /^\/api\/audio\/info/, strategy: 'network-first', duration: 24 * 60 * 60 * 1000 }, // Cache audio info for 24 hours
  { pattern: /^\/api\/audio\/duration/, strategy: 'network-first', duration: 7 * 24 * 60 * 60 * 1000 }, // Cache duration for 7 days
  { pattern: /^\/api\//, strategy: 'network-first', duration: 0 }, // Other API endpoints - no cache
  { pattern: /^\/auth\//, strategy: 'network-first', duration: 0 },
  { pattern: /\.json$/, strategy: 'network-first', duration: 60 * 60 * 1000 }, // Cache JSON for 1 hour
  { pattern: /\.css$/, strategy: 'network-first', duration: 24 * 60 * 60 * 1000 }, // Cache CSS for 24 hours
  { pattern: /\.js$/, strategy: 'network-first', duration: 24 * 60 * 60 * 1000 }, // Cache JS for 24 hours
  
  // Cache-first patterns (prioritize cached content)
  { pattern: /\.(woff|woff2|ttf|eot)$/, strategy: 'cache-first', duration: 30 * 24 * 60 * 60 * 1000 },
  { pattern: /\.(png|jpg|jpeg|gif|svg|ico)$/, strategy: 'cache-first', duration: 7 * 24 * 60 * 60 * 1000 },
  { pattern: /^https:\/\/audio\.jukehost\.co\.uk\//, strategy: 'cache-first', duration: 14 * 24 * 60 * 60 * 1000 },
  { pattern: /^https:\/\/fonts\.googleapis\.com\//, strategy: 'cache-first', duration: 30 * 24 * 60 * 60 * 1000 },
  { pattern: /^https:\/\/fonts\.gstatic\.com\//, strategy: 'cache-first', duration: 30 * 24 * 60 * 60 * 1000 },
];

// Legacy arrays for backward compatibility (derived from CACHE_CONFIG)
const NETWORK_FIRST_PATTERNS = CACHE_CONFIG.filter(c => c.strategy === 'network-first').map(c => c.pattern);
const CACHE_FIRST_PATTERNS = CACHE_CONFIG.filter(c => c.strategy === 'cache-first').map(c => c.pattern);

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
    Promise.all([
      // Delete old caches
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                console.log('Service Worker: Deleting old cache:', cacheName);
                return caches.delete(cacheName);
              }
            })
          );
        }),
      // Clean up expired cache entries
      cleanupExpiredCacheEntries()
    ])
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
  } else if (shouldUseCacheFirst(url.pathname, request.url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Default to network-first for everything else
    event.respondWith(networkFirstStrategy(request));
  }
});

/**
 * Get cache configuration for a URL
 */
function getCacheConfig(url, pathname) {
  return CACHE_CONFIG.find(config => {
    // Test against pathname for relative patterns
    if (config.pattern.test(pathname)) {
      return true;
    }
    // Test against full URL for absolute patterns
    if (url && config.pattern.test(url)) {
      return true;
    }
    return false;
  });
}

/**
 * Check storage quota before caching
 */
async function checkStorageQuota() {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return true; // If we can't check, assume it's okay
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

    if (usagePercentage >= 95) {
      console.warn('Service Worker: Storage quota critical, skipping cache');
      // Trigger cleanup
      await cleanupExpiredCacheEntries();
      return false;
    } else if (usagePercentage >= 85) {
      console.warn('Service Worker: Storage quota high, cleaning up');
      await cleanupExpiredCacheEntries();
    }

    return true;
  } catch (error) {
    console.error('Service Worker: Failed to check storage quota:', error);
    return true; // If check fails, proceed with caching
  }
}

/**
 * Cache a response with expiration metadata
 */
async function cacheResponseWithExpiration(cache, request, response) {
  // Check storage quota before caching
  const quotaOk = await checkStorageQuota();
  if (!quotaOk) {
    console.log('Service Worker: Skipping cache due to quota limits:', request.url);
    return;
  }

  const config = getCacheConfig(request.url, new URL(request.url).pathname);
  const duration = config?.duration;
  
  if (duration === null) {
    // No expiration - cache normally
    const responseClone = response.clone();
    await cache.put(request, responseClone);
  } else if (duration > 0) {
    // Cache with expiration timestamp
    const expirationTime = Date.now() + duration;
    const responseClone = response.clone();
    
    // Add expiration metadata to response headers
    const modifiedResponse = new Response(responseClone.body, {
      status: responseClone.status,
      statusText: responseClone.statusText,
      headers: {
        ...Object.fromEntries(responseClone.headers.entries()),
        'sw-cache-expires': expirationTime.toString()
      }
    });
    
    await cache.put(request, modifiedResponse);
  }
  // If duration is 0 or undefined, don't cache
}

/**
 * Get cached response if it's still valid (not expired)
 */
async function getCachedResponseIfValid(cache, request) {
  // Try exact match first
  let cachedResponse = await cache.match(request, { ignoreVary: true });
  
  if (!cachedResponse) {
    return null;
  }
  
  // Check if response has expiration metadata
  const expiresHeader = cachedResponse.headers.get('sw-cache-expires');
  
  if (expiresHeader) {
    const expirationTime = parseInt(expiresHeader);
    const now = Date.now();
    
    if (now > expirationTime) {
      // Response has expired, remove from cache
      console.log('Service Worker: Cached response expired, removing:', request.url);
      await cache.delete(request);
      return null;
    }
  }
  
  // Response is valid (no expiration or not expired yet)
  return cachedResponse;
}

/**
 * Clean up expired cache entries
 */
async function cleanupExpiredCacheEntries() {
  try {
    console.log('Service Worker: Starting cache cleanup...');
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    let cleanedCount = 0;
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const expiresHeader = response.headers.get('sw-cache-expires');
        if (expiresHeader) {
          const expirationTime = parseInt(expiresHeader);
          const now = Date.now();
          
          if (now > expirationTime) {
            await cache.delete(request);
            cleanedCount++;
            console.log('Service Worker: Cleaned expired cache entry:', request.url);
          }
        }
      }
    }
    
    console.log(`Service Worker: Cache cleanup complete. Removed ${cleanedCount} expired entries.`);
  } catch (error) {
    console.error('Service Worker: Cache cleanup failed:', error);
  }
}

/**
 * Network-first strategy: Try network first, fallback to cache
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    console.log('Service Worker: Network-first strategy for:', request.url);
    
    // Try to fetch from network
    const networkResponse = await fetch(request);
    
    // If successful, clone and cache the response with expiration
    if (networkResponse.ok) {
      await cacheResponseWithExpiration(cache, request, networkResponse);
      console.log('Service Worker: Cached fresh response for:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for:', request.url);
    
    // Network failed, try to get valid cached response
    const cachedResponse = await getCachedResponseIfValid(cache, request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // If not in cache either, check if we have a cached app shell for navigation requests
    if (request.mode === 'navigate') {
      console.log('Service Worker: Navigation request failed, trying to serve cached app shell');
      
      // Try to get the cached root page (app shell)
      const appShellRequest = new Request('/', {
        method: 'GET',
        headers: request.headers,
        mode: 'navigate',
        credentials: request.credentials,
        redirect: 'manual'
      });
      
      const cachedAppShell = await getCachedResponseIfValid(cache, appShellRequest);
      
      if (cachedAppShell) {
        console.log('Service Worker: Serving cached app shell for offline navigation');
        return cachedAppShell;
      }
      
      // If no app shell is cached, try to serve a minimal offline page that redirects to /offline
      console.log('Service Worker: No cached app shell, serving minimal offline redirect');
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Offline - Blockate Audio Browser</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script>
              // Redirect to offline page when the app loads
              window.addEventListener('load', () => {
                if (window.location.pathname !== '/offline') {
                  window.location.href = '/offline';
                }
              });
            </script>
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
              .loading {
                font-size: 2rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="loading">📡</div>
            <p>Loading offline mode...</p>
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
  
  // Check if cached response is still valid
  const cachedResponse = await getCachedResponseIfValid(cache, request);
  
  if (cachedResponse) {
    console.log('Service Worker: Serving from cache (cache-first):', request.url);
    return cachedResponse;
  }
  
  console.log('Service Worker: Cache miss or expired, fetching from network (cache-first):', request.url);
  
  try {
    // Not in cache or expired, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response if successful
    if (networkResponse.ok) {
      await cacheResponseWithExpiration(cache, request, networkResponse);
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
function shouldUseCacheFirst(pathname, fullUrl) {
  return CACHE_FIRST_PATTERNS.some(pattern => {
    // Test against pathname for file extension patterns
    if (pattern.test(pathname)) {
      return true;
    }
    // Test against full URL for external domain patterns
    if (fullUrl && pattern.test(fullUrl)) {
      return true;
    }
    return false;
  });
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

// Periodic cache cleanup (runs every hour)
setInterval(() => {
  cleanupExpiredCacheEntries();
}, 60 * 60 * 1000); // 1 hour