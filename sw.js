// Service worker de 501: funciona sin conexión y muestra las notificaciones.
const CACHE = '501-v1';
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', './config.js', './logica.js',
  './store.js', './firebase-config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero la red (para recibir cambios), y si no hay conexión, lo guardado.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '501', {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: d.tag,
    data: { url: d.url || './' },
  }));
});

// Al tocar la notificación se abre 501 en la sección correcta (y eso cuenta como "visto").
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if ('focus' in v) { await v.navigate(destino).catch(() => {}); return v.focus(); }
    }
    return self.clients.openWindow(destino);
  })());
});
