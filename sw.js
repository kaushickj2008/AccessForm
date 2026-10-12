const CACHE = 'accessform-v2';
const base = new URL('./', self.location.href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(new URL('precache.json', base), {cache:'no-store'});
    if (!response.ok) throw new Error('Offline manifest unavailable');
    const files = await response.json();
    const cache = await caches.open(CACHE);
    await cache.addAll(files.map(file => new URL(file, base).href));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('accessform-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== base.origin || url.pathname.includes('/api/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      // Only precached public app assets can be returned offline. Never cache user input or API responses.
      return response;
    } catch (error) {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request, {ignoreSearch:true});
      if(cached) return cached;
      if(event.request.mode === 'navigate') return (await cache.match(new URL('index.html',base).href)) || Response.error();
      return Response.error();
    }
  })());
});
