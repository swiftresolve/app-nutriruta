const CACHE = 'nutriruta-74609b696d';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/theme-init.js',
  './js/i18n.js',
  './js/config.js',
  './js/supabase-client.js',
  './js/store.js',
  './js/pathMap.js',
  './js/menu.js',
  './js/charts.js',
  './js/streakAnim.js',
  './js/push.js',
  './js/data/profiles.js',
  './js/data/recipes.js',
  './js/data/lessons.js',
  './js/data/mission.js',
  './js/data/emergencyPlan.js',
  './js/views/auth.js',
  './js/views/quiz.js',
  './js/views/dashboard.js',
  './js/views/planner.js',
  './js/views/sos.js',
  './js/views/progress.js',
  './js/views/learn.js',
  './js/views/settings.js',
  './js/views/mission.js',
  './js/views/plans.js',
  './js/views/emergency.js',
  './js/views/assistant.js',
  './js/views/checkin.js',
  './js/views/tour.js',
  './js/views/testimonials.js',
  './js/views/resetPassword.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/ruti/saludo.png',
  './img/ruti/feliz.png',
  './img/ruti/curiosa.png',
  './img/ruti/tranquila.png',
  './img/ruti/celebracion.png',
  './img/ruti/bienvenida.webm',
  './fonts/karla-variable.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // La API de Supabase nunca se cachea: datos y auth siempre en vivo.
  if (url.hostname.endsWith('.supabase.co')) return;

  // El SDK (esm.sh) sí se cachea para que la app arranque offline.
  const cacheable = url.origin === location.origin || url.hostname === 'esm.sh';
  if (!cacheable) return;

  // Código de la app (HTML/JS/CSS del propio origen): red primero, y solo
  // si falla (sin conexión) se cae al caché. Antes era caché-primero para
  // TODO, lo que significaba que un despliegue nuevo podía quedar
  // invisible durante varias recargas hasta que el navegador decidiera
  // por su cuenta revisar si había una versión nueva de este mismo
  // archivo -- causó varios bugs reales de "ya lo arreglé pero se sigue
  // viendo viejo" en esta sesión. Con red primero, apenas se despliega
  // algo nuevo se ve de inmediato con conexión; sin conexión sigue
  // funcionando igual que antes, desde el caché.
  const esCodigoDeLaApp = url.origin === location.origin &&
    (/\.(js|css|html)$/.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/'));

  if (esCodigoDeLaApp) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Todo lo demás (imágenes, fuentes, video, el SDK externo): caché
  // primero, como antes -- son archivos que casi nunca cambian, y cargan
  // más rápido así.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// ---------- Notificaciones push ----------
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'NutriRuta', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'NutriRuta';
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
