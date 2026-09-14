// Nama cache internal - perbarui versi untuk memicu update service worker
const CACHE_NAME = 'ipc-passed-cache-v2.1';

// File statis inti yang di-pre-cache saat SW terinstall (tanpa deskripsi.json agar data selalu dinamis)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './pwa/manifest.json',
  './pwa/favicon.svg',
  './pwa/icon-192x192.png',
  './pwa/icon-512x512.png',
  './pwa/icon-maskable-192x192.png',
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
    await cache.delete('./deskripsi.json');
    const keys = await cache.keys();
    for (const key of keys) {
      if (key.url.includes('deskripsi.json')) {
        await cache.delete(key);
      }
    }
    console.log('[SW] Cache deskripsi.json berhasil di-invalidasi');
  }
});

// 4. Event Fetch:
// - Network-First untuk data deskripsi.json (utamakan data terbaru dari GitHub/server, fallback cache bila offline)
// - Cache-First untuk gambar & aset statis pwa
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // STRATEGI A: NETWORK-FIRST untuk data MID (deskripsi.json)
  if (url.includes('deskripsi.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            // Simpan salinan terbaru untuk kebutuhan offline
            cache.put(request, networkResponse.clone());
            cache.put('./deskripsi.json', networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          // Jaringan gagal (misal koneksi gudang mati): ambil data terakhir yang tersimpan di cache
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request) || await cache.match('./deskripsi.json');
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

  // STRATEGI B: CACHE-FIRST untuk gambar & ikon statis
  if (
    request.destination === 'image' || 
    url.includes('/images/') || 
    url.includes('/pwa/')
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
