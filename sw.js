/* sw.js — cache para funcionar offline (estratégia network-first).
   Sempre tenta a rede primeiro (pega a versão nova quando online) e usa o
   cache como reserva quando estiver offline. */
const CACHE = 'folha-certa-v6';
const ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './js/db.js?v=12',
  './js/schema.js?v=12',
  './js/audit.js?v=12',
  './js/ia.js?v=12',
  './js/convert.js?v=12',
  './js/app.js?v=12',
  './manifest.webmanifest',
  './assets/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
