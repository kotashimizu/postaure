// Postaure Service Worker
// Provides offline functionality and caching for posture analysis app

const CACHE_NAME = 'postaure-v1.2.0';
const STATIC_CACHE = 'postaure-static-v1.2.0';
const DYNAMIC_CACHE = 'postaure-dynamic-v1.2.0';
const ANALYSIS_CACHE = 'postaure-analysis-v1.2.0';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // Add critical CSS and JS files - these will be populated during build
];

// MediaPipe files that need to be cached for offline analysis
const MEDIAPIPE_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm',
  // Note: Actual MediaPipe model files will be cached dynamically
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /\/api\/analysis/,
  /\/api\/reports/,
  /\/api\/history/
];

// Files that should never be cached
const NEVER_CACHE = [
  /\/api\/auth/,
  /\/api\/live/,
  /analytics/,
  /\.hot-update\./
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(asset => asset !== undefined));
      }),
      
      // Pre-cache critical MediaPipe files
      caches.open(ANALYSIS_CACHE).then(cache => {
        console.log('[SW] Pre-caching MediaPipe assets');
        return Promise.allSettled(
          MEDIAPIPE_ASSETS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            })
          )
        );
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      // Force activation of new service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName.startsWith('postaure-') && 
                     ![STATIC_CACHE, DYNAMIC_CACHE, ANALYSIS_CACHE].includes(cacheName);
            })
            .map(cacheName => {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activation complete');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const { url, method } = request;
  
  // Only handle GET requests
  if (method !== 'GET') {
    return;
  }
  
  // Skip requests that should never be cached
  if (NEVER_CACHE.some(pattern => pattern.test(url))) {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (url.includes('/api/')) {
    event.respondWith(handleAPIRequest(request));
  } else if (url.includes('mediapipe') || url.includes('tasks-vision')) {
    event.respondWith(handleMediaPipeRequest(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Handle API requests - Network First with fallback
async function handleAPIRequest(request) {
  const url = request.url;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses
      if (API_CACHE_PATTERNS.some(pattern => pattern.test(url))) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
    
    throw new Error(`Network response not ok: ${networkResponse.status}`);
  } catch (error) {
    console.log(`[SW] Network failed for API request: ${url}, trying cache`);
    
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for analysis requests
    if (url.includes('/api/analysis')) {
      return new Response(JSON.stringify({
        error: 'offline',
        message: 'オフライン分析モードです。基本的な分析のみ利用可能です。',
        offlineMode: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Handle MediaPipe requests - Cache First with network fallback
async function handleMediaPipeRequest(request) {
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW] Serving MediaPipe asset from cache: ${request.url}`);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network and cache
    console.log(`[SW] Fetching MediaPipe asset from network: ${request.url}`);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(ANALYSIS_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error(`Failed to fetch MediaPipe asset: ${networkResponse.status}`);
  } catch (error) {
    console.error(`[SW] Failed to load MediaPipe asset: ${request.url}`, error);
    
    // For critical MediaPipe files, return a fallback
    if (request.url.includes('.wasm') || request.url.includes('vision_wasm_internal.js')) {
      return new Response('', {
        status: 503,
        statusText: 'MediaPipe asset unavailable offline'
      });
    }
    
    throw error;
  }
}

// Handle static assets - Cache First
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not cached, fetch and cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // For navigation requests, return offline page
    if (request.destination === 'document') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Handle dynamic requests - Network First with cache fallback
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For navigation requests, return offline page
    if (request.destination === 'document') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Helper function to determine if URL is a static asset
function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)$/i.test(url) ||
         url.includes('/assets/') ||
         url.includes('/static/');
}

// Background sync for analysis results
self.addEventListener('sync', event => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'analysis-upload') {
    event.waitUntil(syncAnalysisData());
  } else if (event.tag === 'report-upload') {
    event.waitUntil(syncReportData());
  }
});

// Sync analysis data when network becomes available
async function syncAnalysisData() {
  try {
    console.log('[SW] Syncing offline analysis data...');
    
    // Get pending analysis from IndexedDB or localStorage
    const pendingAnalysis = await getPendingAnalysis();
    
    for (const analysis of pendingAnalysis) {
      try {
        const response = await fetch('/api/analysis/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(analysis)
        });
        
        if (response.ok) {
          await removePendingAnalysis(analysis.id);
          console.log(`[SW] Synced analysis: ${analysis.id}`);
        }
      } catch (error) {
        console.error(`[SW] Failed to sync analysis ${analysis.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Sync report data
async function syncReportData() {
  try {
    console.log('[SW] Syncing offline reports...');
    // Implementation similar to syncAnalysisData
  } catch (error) {
    console.error('[SW] Report sync failed:', error);
  }
}

// Push notifications for analysis completion
self.addEventListener('push', event => {
  console.log('[SW] Push event received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.message || '姿勢分析が完了しました',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: data,
      actions: [
        {
          action: 'view',
          title: '結果を見る'
        },
        {
          action: 'close',
          title: '閉じる'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('Postaure', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync for cache maintenance
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync event:', event.tag);
  
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(performCacheCleanup());
  }
});

// Clean up old cache entries
async function performCacheCleanup() {
  try {
    console.log('[SW] Performing cache cleanup...');
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseTime = new Date(dateHeader).getTime();
          if (now - responseTime > maxAge) {
            await cache.delete(request);
            console.log(`[SW] Cleaned up old cache entry: ${request.url}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[SW] Cache cleanup failed:', error);
  }
}

// Utility functions for offline storage
async function getPendingAnalysis() {
  // This would typically use IndexedDB
  try {
    const stored = localStorage.getItem('pending_analysis');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[SW] Failed to get pending analysis:', error);
    return [];
  }
}

async function removePendingAnalysis(id) {
  try {
    const pending = await getPendingAnalysis();
    const filtered = pending.filter(item => item.id !== id);
    localStorage.setItem('pending_analysis', JSON.stringify(filtered));
  } catch (error) {
    console.error('[SW] Failed to remove pending analysis:', error);
  }
}

// Handle errors
self.addEventListener('error', event => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service Worker loaded');