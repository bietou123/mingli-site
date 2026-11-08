/* sw.js —— 玄机阁 Service Worker：预缓存核心静态资源，强化离线可用 */
/* 注意：更新任一前端资源后，请同时把下面 CACHE 版本号 +1，否则浏览器沿用旧缓存 */
const CACHE = 'xuanjige-v83';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/style.css',
  './js/app/main.js',
  './js/app/home.js',
  './js/app/bazi.js',
  './js/app/liuyao.js',
  './js/app/ziwei.js',
  './js/app/profiles.js',
  './js/engine/bazi-analyze.js',
  './js/engine/liuyao.js',
  './js/engine/liuyao-analyze.js',
  './js/engine/ziwei.js',
  './js/engine/calendar.js',
  './js/engine/ganzhi.js',
  './js/engine/huangli.js',
  './js/engine/lunar.esm.js',
  './data/knowledge-bazi.json',
  './data/knowledge-ziwei.json',
  './data/knowledge-liuyao.json',
  './data/yijing64.json',
  './data/ziwei-brightness.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return; // 后端 API 走网络

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
