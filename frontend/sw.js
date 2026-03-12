// HomeMaint Service Worker
// Minimal SW — just enough to satisfy PWA installability requirements
// No aggressive caching since this is a local network app

const CACHE_NAME = 'homemaint-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Always network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Network-first for everything else — fall back to cache for offline
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(r => r || caches.match('/index.html'))
    )
  )
})
