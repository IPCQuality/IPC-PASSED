// Nama cache internal
const CACHE_NAME = 'ipc-passed-cache-v1';

// File dasar yang langsung di-pre-cache saat SW terinstall
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './deskripsi.json'
];

// 1. Event Install: Simpan aset utama ke cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Event Activate: Bersihkan cache lama jika ada update versi
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Event Fetch: Cek Cache terlebih dahulu (Cache-First Strategy untuk Gambar & Asset)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Tangani request gambar atau file json
  if (
    request.destination === 'image' || 
    request.url.includes('/images/') || 
    request.url.includes('deskripsi.json')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Cek apakah gambar sudah ada di penyimpanan internal (Cache)
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse; // Kembalikan langsung dari cache internal (super cepat)
        }

        // Jika belum ada di cache, unduh dari jaringan
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            // Simpan salinannya ke cache untuk penggunaan berikutnya
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Jika offline dan tidak ada di cache
          return new Response('Aset tidak tersedia secara offline', { status: 404 });
        }
      })
    );
  }
});