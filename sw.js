// ══════════════════════════════════════════════
// SERVICE WORKER — GeoMap Processor Arauco
// Cachea todo para funcionar 100% offline
// ══════════════════════════════════════════════

const CACHE_NAME = 'arauco-geomap-v1';

const RECURSOS_CRITICOS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap',
];

// ── INSTALACIÓN: cachea todos los recursos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando recursos críticos...');
      // Cachear uno a uno para no fallar si alguno no está disponible
      return Promise.allSettled(
        RECURSOS_CRITICOS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err))
        )
      );
    }).then(() => {
      console.log('[SW] Instalación completa');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVACIÓN: limpia cachés viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => {
      console.log('[SW] Activado, caché limpio');
      return self.clients.claim();
    })
  );
});

// ── FETCH: sirve desde caché, red como fallback ──
self.addEventListener('fetch', event => {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Tenemos en caché → servir directo (offline funciona)
        return cached;
      }

      // No está en caché → intentar red y cachear resultado
      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // Sin red y sin caché → respuesta de error amigable
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        return new Response('Sin conexión y recurso no cacheado', { status: 503 });
      });
    })
  );
});

// ── MENSAJE: forzar actualización de caché ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage('Cache cleared');
    });
  }
});
