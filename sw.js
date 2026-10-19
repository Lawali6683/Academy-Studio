const CACHE = 'bidiyo-studio-v2';
const CORE = ['./', 'index.html', 'index.css', 'index.js', 'manifest.webmanifest'];
const FA = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
const EXT = [FA, 'https://i.imgur.com/oyqM5oF.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(u).catch(() => {})));
    for (const u of EXT) {
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        if (u === FA) {
          const text = await r.clone().text();
          const fonts = Array.from(text.matchAll(/url\(([^)]+)\)/g))
            .map(m => new URL(m[1].replace(/["']/g, ''), FA).href)
            .filter(x => x.includes('.woff2'));
          await Promise.all(fonts.map(f => fetch(f).then(fr => (fr.ok ? c.put(f, fr) : null)).catch(() => {})));
        }
        await c.put(u, r);
      } catch (err) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r);
    const net = fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
      return res;
    }).catch(() => null);
    if (hit) {
      e.waitUntil(net);
      return hit;
    }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') {
      const f = (await c.match('index.html')) || (await c.match('./'));
      if (f) return f;
    }
    return new Response('', { status: 504 });
  })());
});