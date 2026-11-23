/* Service Worker: オフラインで動かす。
 * ファイルを更新したら、下の VERSION の数字を上げる（古いキャッシュが入れ替わる）。 */
const VERSION = 'axiom-v2';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/core.js', 'js/app.js', 'js/units/quadratic.js', 'js/units/fractions.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// ネットが使えるときは最新を取り、だめなときだけ保存済みを使う
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
