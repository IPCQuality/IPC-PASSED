// Nama cache internal - perbarui versi untuk memicu update service worker
const CACHE_NAME = 'ipc-passed-cache-v4.9';

// File statis inti yang di-pre-cache saat SW terinstall (tanpa deskripsi.json agar data selalu dinamis)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './js/formater.js',
  './js/index.js',
  './js/admin.js',
  './manifest.json',
  './pwa/manifest.json',
  './pwa/favicon.svg',
  './pwa/favicon-32x32.png',
  './pwa/favicon-16x16.png',
  './pwa/icon-192x192.png',
  './pwa/icon-512x512.png',
  './pwa/icon-maskable-192x192.png',
  './pwa/icon-maskable-512x512.png',
  './pwa/apple-touch-icon.png'
];

// 1. Event Install: Simpan aset statis utama dan lewati masa tunggu
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Event Activate: Bersihkan cache lama dan klaim kendali klien
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Menghapus cache usang:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Listener pesan dari aplikasi (skipWaiting & invalidasi manual)
self.addEventListener('message', async (event) => {
  if (!event.data) return;
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data.action === 'invalidateDataCache') {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete('./data/deskripsi.json');
    const keys = await cache.keys();
    for (const key of keys) {
      if (key.url.includes('deskripsi.json')) {
        await cache.delete(key);
      }
    }
    console.log('[SW] Cache data/deskripsi.json berhasil di-invalidasi');
  }
});

// 4. Event Fetch:
// - Network-First untuk navigasi halaman (PWA launch / index.html) dengan fallback cache offline
// - Network-First untuk data deskripsi.json (utamakan data terbaru, fallback cache bila offline)
// - Cache-First untuk gambar, ikon, manifest, dan aset statis
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // STRATEGI A: NAVIGASI HALAMAN (PWA launch & link buka halaman)
  // Menjamin PWA tidak 404 saat dibuka di Android / Desktop / iOS baik online maupun offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request) || await cache.match('./index.html') || await cache.match('./');
          if (cached) {
            return cached;
          }
          return new Response('Aplikasi Quality Passed siap offline', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // STRATEGI B: NETWORK-FIRST untuk data MID (deskripsi.json)
  if (url.includes('deskripsi.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            cache.put('./data/deskripsi.json', networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request) || await cache.match('./data/deskripsi.json');
          if (cached) {
            return cached;
          }
          return new Response(JSON.stringify({ records: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // STRATEGI C: CACHE-FIRST untuk gambar, ikon, dan manifest
  if (
    request.destination === 'image' || 
    url.includes('/images/') || 
    url.includes('manifest.json') ||
    url.match(/\.(png|jpg|jpeg|svg|webp|ico)$/i)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return new Response('Aset tidak tersedia secara offline', { status: 404 });
        }
      })
    );
    return;
  }
});
