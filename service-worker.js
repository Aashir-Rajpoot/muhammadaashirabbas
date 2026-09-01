const CACHE = 'aashir-x-v7';
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
  './offline-fighter-integration.js',
  './offline-fighter/characters.js',
  './offline-fighter/stages.js',
  './offline-fighter/audio.js',
  './offline-fighter/controls.js',
  './offline-fighter/effects.js',
  './offline-fighter/ai.js',
  './offline-fighter/combat.js',
  './offline-fighter/ui.js',
  './offline-fighter/game.js',
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
