/**
 * ECM 쿠폰 서비스 워커 (홈 화면에 설치하는 웹앱 + 새 쿠폰 푸시 알림).
 *
 * 원칙: 쿠폰 코드는 자주 바뀌므로 페이지(HTML)는 저장해 두고 보여 주지 않는다. 항상 네트워크에서 받고,
 * 연결이 끊겼을 때만 /offline.html 을 보여 준다. 스타일·스크립트·아이콘처럼 잘 안 바뀌는 파일만 저장해 빠르게 연다.
 * 다른 사이트 요청(광고·애널리틱스·글꼴)은 건드리지 않는다.
 *
 * 푸시: /assets/push-config.js 에 파이어베이스 설정이 채워져 있을 때만 켜진다. 알림 표시·클릭 이동은 FCM SDK 가 한다.
 * 이 파일을 고치면 CACHE 이름의 숫자를 올린다(옛 저장본을 지운다).
 */
const CACHE = 'ecm-static-v1';
const PRECACHE = ['/offline.html', '/assets/ecm.css', '/assets/styles.css', '/assets/ecm.js', '/assets/logo.svg', '/assets/favicon.svg', '/assets/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ecm-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 광고·애널리틱스·CDN 은 브라우저 기본 동작 그대로

  // 페이지: 항상 네트워크. 끊겼을 때만 오프라인 안내
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // 스타일·스크립트: 새 화면과 짝이 맞아야 하므로 네트워크 먼저, 끊겼을 때만 저장본
  if (/^\/assets\/.+\.(css|js)$/.test(url.pathname) && url.pathname !== '/assets/push-config.js') {
    event.respondWith(
      fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 아이콘·이미지: 저장본으로 빨리 열고, 뒤에서 새것으로 바꿔 둔다
  // (posts.json·menu.html 같은 목록 데이터는 제외: 새 글·새 게임이 늦게 보이지 않게)
  if (/^\/(assets|blog\/images)\/.+\.(png|jpe?g|webp|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(req).then(hit => {
        const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || fresh;
      }))
    );
  }
});

// ── 푸시 알림 (파이어베이스 설정이 있을 때만) ──
try {
  importScripts('/assets/push-config.js');
  const cfg = self.ECM_PUSH || {};
  if (cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId) {
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
    firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
    firebase.messaging(); // 백그라운드 알림 표시·클릭 이동(webpush.fcm_options.link)은 SDK 가 처리
  }
} catch (e) { /* 설정 전이거나 불러오기 실패: 웹앱 기능만 동작 */ }
