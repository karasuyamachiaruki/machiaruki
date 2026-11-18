// からすやまちあるき サービスワーカー
// index.html の更新は通信できれば自動で反映されます。アイコンや manifest.json を変えたときだけ CACHE_VERSION を v2, v3…と上げてください。
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'chiaruki-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
const QR_LIB = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // QR読み取りライブラリは取得できなくてもインストールを止めない
    try { await cache.add(new Request(QR_LIB, { mode: 'no-cors' })); } catch (e) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('chiaruki-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ページ本体：通信できるときは常に最新を取りに行き、圏外のときだけ保存版を使う
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 同じサイトの画像・設定ファイルとQRライブラリ：保存版を先に返し、裏で更新する
  if (url.origin === self.location.origin || req.url === QR_LIB) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
  // それ以外（世田谷区の資料リンクなど）はそのままネットに任せる
});
