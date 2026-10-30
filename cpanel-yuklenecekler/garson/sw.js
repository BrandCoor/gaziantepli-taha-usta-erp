/* Garson PWA servis çalışanı.
 *
 * KURALLAR
 *  - API istekleri ASLA önbelleğe alınmaz / çevrimdışı taklit edilmez: sipariş yalnızca sunucu kabul ederse
 *    "gönderildi" sayılır (güvenilirlik için bilinçli karar; bkz. docs/waiter-app.md).
 *  - Uygulama kabuğu (HTML/CSS/yazı tipi/simge) önbelleğe alınır: kapalı internette bile sayfa açılır ve
 *    kullanıcıya "bağlantı yok" gösterir.
 *  - HTML için önce ağ denenir (yeni sürüm hemen gelir), ağ yoksa önbellek kullanılır.
 */
const VERSION = 'garson-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './zxing-browser.min.js',
  '../assets/app.css',
  '../assets/fa/css/all.min.css',
  '../assets/fonts/fonts.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST (sipariş) hiçbir zaman araya girilmez
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // API: her zaman ağ, önbellek yok

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Statik dosyalar: önbellek önce, arkada tazele
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
