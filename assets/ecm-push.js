/**
 * 내 게임 새 쿠폰 푸시 알림 (페이지 쪽). assets/ecm.js 가 알림 버튼이 있는 페이지에서만 불러온다.
 *
 * 흐름: [data-push-toggle] 버튼 → 알림 권한 → FCM 토큰 → 파이어스토어 subscribers/{토큰} 에 {games, updated, ua} 저장.
 * games 는 "내 게임"(localStorage ecm:fav) 목록이다. 내 게임을 바꾸면 저장된 목록도 따라 바뀐다.
 * 보내는 쪽은 scripts/notify-push.js (GitHub Actions). 설정은 assets/push-config.js.
 * 아이폰은 홈 화면에 추가한 뒤(iOS 16.4 이상)에만 웹 알림을 받을 수 있다.
 */
(function () {
  var cfg = window.ECM_PUSH || {};
  var READY = cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && cfg.vapidKey;
  var FAV = 'ecm:fav', ON = 'ecm:push', TOKEN = 'ecm:push-token';
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function favs() { try { return JSON.parse(ls(FAV) || '[]'); } catch (e) { return []; } }
  var env = window.ECM_ENV || { ios: false, standalone: false, inApp: '', iosVer: 0, addToHomeHow: function () { return ''; } };
  var isIOS = env.ios, standalone = env.standalone;
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-push-toggle]'));
  if (!READY || !buttons.length) return;

  function paint() {
    var on = ls(ON) === '1' && Notification.permission === 'granted';
    buttons.forEach(function (b) {
      b.hidden = false;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var t = b.querySelector('span'); if (t) t.textContent = on ? '새 쿠폰 알림 켜짐' : '새 쿠폰 알림 받기';
      var i = b.querySelector('i'); if (i) i.className = on ? 'fa-solid fa-bell' : 'fa-regular fa-bell';
    });
  }
  function say(msg) {
    var box = document.getElementById('pushNote');
    if (!box) { box = document.createElement('p'); box.id = 'pushNote'; box.className = 'ecm-push-note'; box.setAttribute('role', 'status'); buttons[0].insertAdjacentElement('afterend', box); }
    box.textContent = msg;
  }
  function load(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  var app = null;
  function sdk() {
    if (app) return Promise.resolve(app);
    return load(SDK + 'firebase-app-compat.js').then(function () { return load(SDK + 'firebase-messaging-compat.js'); }).then(function () {
      app = firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
      return app;
    });
  }
  // 파이어스토어 REST 로 구독 문서 저장·삭제 (SDK 전체를 싣지 않으려고)
  function docUrl(token) { return 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents/subscribers/' + encodeURIComponent(token) + '?key=' + cfg.apiKey; }
  function saveDoc(token) {
    var body = { fields: {
      games: { arrayValue: { values: favs().slice(0, 100).map(function (g) { return { stringValue: g }; }) } },
      updated: { timestampValue: new Date().toISOString() },
      ua: { stringValue: (isIOS ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop') + (standalone ? '-app' : '-web') }
    } };
    return fetch(docUrl(token), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { if (!r.ok) throw new Error('save ' + r.status); });
  }
  function turnOn(btn) {
    if (env.inApp) { say(env.addToHomeHow()); return; }
    if (isIOS && env.iosVer < 1604) { say('아이폰은 iOS 16.4 이상에서 웹 알림을 받을 수 있어요. 텔레그램이나 카카오톡 채널로 새 쿠폰 소식을 받아 보세요.'); return; }
    if (isIOS && !standalone) { say('아이폰은 사파리·크롬 모두 브라우저 탭에서는 알림을 켤 수 없어요. ' + env.addToHomeHow() + ' 그 앱에서 이 버튼을 누르면 알림이 켜져요.'); return; }
    if (!supported) { say('이 브라우저는 웹 알림을 지원하지 않아요. 텔레그램이나 카카오톡 채널로 새 쿠폰 소식을 받을 수 있어요.'); return; }
    var gid = btn.getAttribute('data-game');
    if (gid) { var a = favs(); if (a.indexOf(gid) < 0) { a.push(gid); ls(FAV, JSON.stringify(a)); document.dispatchEvent(new CustomEvent('ecm:fav-change')); } }
    btn.disabled = true;
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { say('알림이 허용되지 않았어요. 브라우저 설정에서 ecm-coupon.com 알림을 허용하면 켤 수 있어요.'); throw 0; }
      return Promise.all([sdk(), navigator.serviceWorker.register('/sw.js')]);
    }).then(function (r) {
      return firebase.messaging().getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: r[1] });
    }).then(function (token) {
      if (!token) throw new Error('no token');
      ls(TOKEN, token); ls(ON, '1');
      return saveDoc(token);
    }).then(function () {
      say(favs().length ? '켰어요. 내 게임(' + favs().length + '개)에 새 쿠폰이 올라오면 알려 드려요. 밤 9시~아침 8시에는 모아서 아침에 보내요.' : '켰어요. 게임 페이지에서 "내 게임에 담기"를 누른 게임의 새 쿠폰을 알려 드려요.');
      paint();
      if (typeof window.gtag === 'function') window.gtag('event', 'push_on', { games: favs().length });
    }).catch(function (e) { if (e !== 0) say('알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.'); ls(ON, null); paint(); })
      .then(function () { btn.disabled = false; });
  }
  function turnOff() {
    var token = ls(TOKEN);
    ls(ON, null); ls(TOKEN, null); paint();
    say('알림을 껐어요.');
    if (token) fetch(docUrl(token), { method: 'DELETE' }).catch(function () {});
    sdk().then(function () { return firebase.messaging().deleteToken(); }).catch(function () {});
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { if (ls(ON) === '1' && Notification.permission === 'granted') turnOff(); else turnOn(b); });
  });
  // 내 게임을 바꾸면 알림 받을 게임 목록도 바꾼다
  document.addEventListener('ecm:fav-change', function () { var t = ls(TOKEN); if (ls(ON) === '1' && t) saveDoc(t).catch(function () {}); });
  paint();
})();
