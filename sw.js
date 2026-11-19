/* Fishers: service worker.
 *
 * - The app shell (page, CSS, JS, icons, font) is precached under a cache
 *   named for the build, so every deploy gets a fresh cache.
 * - data/prompts.json and data/schedule.json are network-first with a cache fallback: new content
 *   arrives when online, and the game still plays offline.
 * - Old caches are deleted on activate.
 * - A new version waits until the page asks it to take over (the "New
 *   version available" toast), so nobody is switched mid-round.
 *
 * Paths are relative to this file, so it works under a sub-path such as
 * https://<user>.github.io/fishers/.
 */
'use strict';
var VERSION = '__BUILD_VERSION__';
var SHELL = 'fishers-shell-' + VERSION;
var DATA = 'fishers-data';

var SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css', 'css/world.css', 'css/hud.css',
  'js/config.js', 'js/data-loader.js', 'js/matcher.js', 'js/round.js', 'js/typeahead.js', 'js/daily.js', 'js/schedule.js',
  'js/storage.js', 'js/scene.js', 'js/icons.js', 'js/share.js', 'js/sound.js', 'js/telemetry.js',
  'js/pwa.js', 'js/game.js',
  'fonts/jetbrains-mono-latin-500-normal.woff2', 'fonts/jetbrains-mono-latin-700-normal.woff2',
  'assets/favicon.svg', 'assets/icons/favicon-32.png', 'assets/icons/icon-192.png',
  'assets/icons/icon-512.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL).then(function (cache) {
      // Fetch fresh copies, not whatever the HTTP cache holds.
      return cache.addAll(SHELL_FILES.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    }).then(function () {
      // Also keep the prompt bank, so the first offline visit can still play.
      return caches.open(DATA).then(function (c) {
        return Promise.all(['data/prompts.json', 'data/schedule.json'].map(function (u) {
          return fetch(u, { cache: 'no-cache' }).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
        }));
      });
    })
  );
  // Don't skipWaiting here: the page decides when to switch (see js/pwa.js).
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== DATA; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The prompt bank and the schedule: network first, cached copy when offline.
  var dataFile = /\/(data\/(?:prompts|schedule)\.json)$/.exec(url.pathname);
  if (dataFile) {
    var name = dataFile[1];
    event.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(DATA).then(function (c) { c.put(name, copy); }); }
        return res;
      }).catch(function () {
        return caches.open(DATA).then(function (c) { return c.match(name); }).then(function (hit) {
          return hit || Response.error();
        });
      })
    );
    return;
  }

  // Page loads: the cached shell, so the game opens offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html', { cacheName: SHELL }).then(function (hit) {
        return hit || fetch(req);
      }).catch(function () { return fetch(req); })
    );
    return;
  }

  // Everything else in the shell: cache first, then network.
  event.respondWith(
    caches.match(req, { cacheName: SHELL, ignoreSearch: true }).then(function (hit) { return hit || fetch(req); })
  );
});
