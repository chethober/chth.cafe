// Lets the menu, admin and panel open without a connection. API requests are never
// cached here: the app keeps its own copy of the last sync, and queued orders, in IndexedDB.
const SHELL = 'chth-shell-v1';
const ASSETS = 'chth-assets-v1';
const FONTS = 'chth-fonts-v1';

const assetsIn = html => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);

// Caches the page and drops build files the new page no longer uses.
async function keepPage(response) {
  const html = await response.clone().text();
  const shell = await caches.open(SHELL);
  await shell.put('/', response);
  const wanted = new Set(assetsIn(html).map(path => new URL(path, self.location.origin).href));
  const assets = await caches.open(ASSETS);
  for (const url of wanted) if (!(await assets.match(url))) await assets.add(url);
  for (const request of await assets.keys()) if (!wanted.has(request.url)) await assets.delete(request);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('/', { cache: 'no-store' });
    if (response.ok) await keepPage(response);
    await (await caches.open(SHELL)).addAll(['/favicon.svg', '/manifest.webmanifest']);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const current = [SHELL, ASSETS, FONTS];
    for (const name of await caches.keys()) if (!current.includes(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Show the saved fonts at once and refresh them in the background.
    event.respondWith(caches.open(FONTS).then(async cache => {
      const cached = await cache.match(request);
      // The stylesheet is loaded without CORS, so its response is opaque (status 0) but still usable.
      const fresh = fetch(request).then(response => { if (response.ok || response.type === 'opaque') void cache.put(request, response.clone()); return response; }).catch(() => Response.error());
      return cached || fresh;
    }));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Every page is the same app, so the newest copy of '/' answers any address offline.
    event.respondWith(fetch(request).then(response => {
      if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) event.waitUntil(keepPage(response.clone()).catch(() => {}));
      return response;
    }).catch(async () => (await caches.match('/', { cacheName: SHELL })) || Response.error()));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Build files have content hashes in their names, so a saved copy is never stale.
    event.respondWith(caches.match(request, { cacheName: ASSETS }).then(cached => cached || fetch(request).then(async response => {
      if (response.ok) await (await caches.open(ASSETS)).put(request, response.clone());
      return response;
    })));
    return;
  }

  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || Response.error()));
});
