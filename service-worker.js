const CACHE = 'aashir-x-v8';
const SHELL = [
  './',
  './aboutus',
  './index.html',
  './aboutus.html',
  './style.css',
  './app.js',
  './manifest.json',
  './aashir-profile.jpeg',
  './story-01.jpeg',
  './story-02.jpeg',
  './story-03.jpeg',
  // --- Offline Fighter game (added for the offline-mode integration) ---
  // Precached here so the whole game is available the moment the visitor
  // goes offline, even on their very first visit's install step, not just
  // after the generic fetch handler below has had a chance to cache it.
  // (The game's CSS is merged into style.css above, so it's covered by
  // that entry already and doesn't need its own line here.)
  // NOTE: these files live at the repo root (same level as index.html),
  // not in an "offline-fighter/" subfolder — the paths below match the
  // actual GitHub Pages layout. A wrong path here would make cache.addAll()
  // reject as a whole, silently caching NOTHING (not even the shell above).
  './offline-fighter-integration.js',
  './characters.js',
  './stages.js',
  './audio.js',
  './controls.js',
  './effects.js',
  './ai.js',
  './combat.js',
  './ui.js',
  './game.js',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
// Cache-first for the static shell only. Live weather/geocode requests always
// go to the network — we never let old weather data pretend to be current.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin.includes('open-meteo.com') || url.origin.includes('bigdatacloud.net')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match('./'));
    })
  );
});
