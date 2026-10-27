/**
 * ECM 쿠폰 앱(안드로이드·아이폰) 안에서만 불러오는 스크립트 (assets/ecm.js 가 사용자 에이전트의 "ECMApp" 을 보고 부른다).
 * 웹 방문자에게는 아무 영향이 없다. 앱 코드는 별도 저장소(바탕 화면 'ECM 앱')에 있다.
 *
 * - 아래쪽 탭 바: 오늘 · 전체 게임 · 내 게임
 * - 처음 실행: 오늘의 쿠폰에서 "어떤 게임 하세요?" 고르기 → 새 쿠폰 알림 켜기 (assets/ecm-push.js 의 ECM_PUSH_TURN_ON)
 * - 아이폰: 내 게임 목록을 홈 화면 위젯에 넘긴다 (앱의 EcmWidget 플러그인. 위젯은 /app/widget.json 을 직접 읽는다)
 */
(function () {
  var path = location.pathname;

  var FAV = 'ecm:fav', DONE = 'ecm:app-onboarded';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function favs() { try { return JSON.parse(ls(FAV) || '[]'); } catch (e) { return []; } }
  function track(name, p) { if (typeof window.gtag === 'function') window.gtag('event', name, p || {}); }
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // scripts/mono.js 와 같은 규칙 (같은 게임은 어디서나 같은 색 첫 글자 타일)
  var HUES = [42, 18, 352, 330, 285, 250, 215, 195, 170, 145, 95, 28];
  function mono(name) {
    var s = String(name || '').trim(), d = s.match(/^\d+/);
    var ch = d ? d[0].slice(0, 2) : (s.charAt(0) || '?').toUpperCase(), h = 0;
    for (var i = 0; i < s.length; i++) { var cp = s.codePointAt(i); h = (h * 31 + cp) % 9973; if (cp > 0xffff) i++; }
    return { ch: ch, h: HUES[h % HUES.length] };
  }

  var css = document.createElement('style');
  css.textContent = [
    '.ecm-install { display: none !important; }',
    // 앱은 새 쿠폰 알림을 푸시로 보내므로 텔레그램·카카오톡 채널 안내는 숨긴다(웹사이트 흔적을 줄여 앱 심사 4.2 대응)
    '[data-tg], [data-kc], .ecm-channels, .hub-sec:has(.fr-follow) { display: none !important; }',
    'body { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }',
    '.ecm-apptabs { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: grid; grid-template-columns: repeat(3, 1fr); background: #fff; border-top: 1px solid var(--line, #EBEAE4); padding: 6px 4px calc(8px + env(safe-area-inset-bottom)); }',
    '.ecm-apptabs a { display: grid; justify-items: center; gap: 2px; font-size: 11px; font-weight: 700; color: var(--ink-3, #6B685F); text-decoration: none; padding: 4px 0; }',
    '.ecm-apptabs a svg, .ecm-apptabs a i { font-size: 18px; }',
    '.ecm-apptabs a.on { color: var(--ink, #17160F); }',
    '.ecm-apptabs a.on svg, .ecm-apptabs a.on i { color: var(--y-deep, #F7C600); }',
    '.ecm-onb { position: fixed; inset: 0; z-index: 80; background: #fff; display: flex; flex-direction: column; }',
    '.ecm-onb-body { flex: 1; overflow-y: auto; padding: 20px 16px 12px; }',
    '.ecm-onb h2 { font-size: 22px; font-weight: 900; margin: 4px 0 4px; letter-spacing: -.02em; }',
    '.ecm-onb p { margin: 0 0 12px; color: var(--ink-2, #55534A); font-size: 14px; line-height: 1.55; }',
    '.ecm-onb input { width: 100%; height: 44px; border-radius: 12px; border: 0; background: var(--sf, #F6F6F3); padding: 0 14px; font-size: 15px; margin-bottom: 12px; }',
    '.ecm-onb-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }',
    '.ecm-onb-grid button { position: relative; display: grid; justify-items: center; gap: 6px; padding: 12px 4px 10px; border-radius: 14px; border: 1px solid var(--line, #EBEAE4); background: #fff; font-size: 12.5px; font-weight: 700; color: var(--ink, #17160F); line-height: 1.25; text-align: center; }',
    '.ecm-onb-grid button[aria-pressed="true"] { border-color: var(--y-deep, #F7C600); background: var(--y-pale, #FFFBE6); }',
    '.ecm-onb-grid button[aria-pressed="true"]::after { content: "✓"; position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%; background: var(--y, #FFE14D); font-size: 11px; display: grid; place-items: center; }',
    '.ecm-onb-tile { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-weight: 900; font-size: 17px; }',
    '.ecm-onb-foot { padding: 10px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line, #EBEAE4); display: grid; gap: 8px; }',
    '.ecm-onb-foot .go { height: 48px; border-radius: 12px; border: 1px solid var(--y-deep, #F7C600); background: var(--y, #FFE14D); color: #17160F; font-size: 15px; font-weight: 800; }',
    '.ecm-onb-foot .go:disabled { opacity: .5; }',
    '.ecm-onb-foot .skip { border: 0; background: none; color: var(--ink-3, #6B685F); font-size: 13px; padding: 6px; }'
  ].join('\n');
  document.head.appendChild(css);

  // ── 아래쪽 탭 바 ──
  function tabs() {
    if (document.querySelector('.ecm-apptabs')) return;
    var mine = path.indexOf('/today') === 0 && location.hash === '#mine';
    var items = [
      ['/today/', 'fa-solid fa-calendar-day', '오늘', path.indexOf('/today') === 0 && !mine],
      ['/', 'fa-solid fa-gamepad', '전체 게임', path === '/' || path.indexOf('/game') === 0],
      ['/today/#mine', 'fa-regular fa-star', '내 게임', mine]
    ];
    var nav = document.createElement('nav');
    nav.className = 'ecm-apptabs'; nav.setAttribute('aria-label', '앱 메뉴');
    nav.innerHTML = items.map(function (t) { return '<a href="' + t[0] + '"' + (t[3] ? ' class="on" aria-current="page"' : '') + '><i class="' + t[1] + '" aria-hidden="true"></i>' + t[2] + '</a>'; }).join('');
    document.body.appendChild(nav);
  }

  // ── 처음 실행: 하는 게임 고르기 (오늘의 쿠폰 페이지의 게임 목록 #tdPickSel 을 쓴다) ──
  function onboarding() {
    if (ls(DONE) || favs().length || path.indexOf('/today') !== 0) return;
    var sel = document.getElementById('tdPickSel');
    if (!sel) return;
    var games = Array.prototype.slice.call(sel.options).filter(function (o) { return o.value; }).map(function (o) { return { id: o.value, name: o.textContent.trim() }; });
    if (!games.length) return;
    var picked = [];
    var box = document.createElement('div');
    box.className = 'ecm-onb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'onbTitle');
    box.innerHTML = '<div class="ecm-onb-body"><img src="/assets/logo.svg" alt="ECM" height="26" style="height:26px;width:auto">'
      + '<h2 id="onbTitle">어떤 게임 하세요?</h2><p>지금 코드가 있는 게임 ' + games.length + '종 중에서 골라 주세요. 고른 게임에 새 쿠폰이 올라오면 바로 알려 드려요. 나중에 게임 페이지의 ‘내 게임에 담기’로 바꿀 수 있어요.</p>'
      // 안내 글은 짧게: 글자 크기를 크게 쓰는 휴대폰(170%)에서 긴 안내 글이 잘렸다(2026-10-13 실기기 시험)
      + '<input type="search" id="onbQ" placeholder="게임 이름 검색" aria-label="게임 이름 검색">'
      + '<div class="ecm-onb-grid" id="onbGrid">' + games.map(function (g) {
        var m = mono(g.name);
        return '<button type="button" aria-pressed="false" data-id="' + esc(g.id) + '" data-name="' + esc(g.name) + '"><span class="ecm-onb-tile" style="background:hsl(' + m.h + ' 72% 94%);color:hsl(' + m.h + ' 48% 30%)">' + esc(m.ch) + '</span>' + esc(g.name) + '</button>';
      }).join('') + '</div></div>'
      + '<div class="ecm-onb-foot"><button type="button" class="go" id="onbGo" disabled>게임을 골라 주세요</button><button type="button" class="skip" id="onbSkip">건너뛰기</button></div>';
    document.body.appendChild(box);
    document.documentElement.style.overflow = 'hidden';
    var go = box.querySelector('#onbGo');
    function paint() { go.disabled = !picked.length; go.textContent = picked.length ? '게임 ' + picked.length + '개 알림 받기' : '게임을 골라 주세요'; }
    box.querySelector('#onbGrid').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var id = b.getAttribute('data-id'), i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1); else picked.push(id);
      b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
      paint();
    });
    box.querySelector('#onbQ').addEventListener('input', function (e) {
      // 홈 검색과 같은 규칙: 대소문자·띄어쓰기·문장부호 무시
      var key = function (t) { return String(t || '').toLowerCase().replace(/[\s\p{P}]/gu, ''); };
      var q = key(e.target.value);
      Array.prototype.forEach.call(box.querySelectorAll('#onbGrid button'), function (b) { b.hidden = q && key(b.getAttribute('data-name')).indexOf(q) < 0; });
    });
    function close() { ls(DONE, '1'); box.remove(); document.documentElement.style.overflow = ''; }
    box.querySelector('#onbSkip').addEventListener('click', function () { close(); track('app_onboarding', { result: 'skip' }); });
    go.addEventListener('click', function () {
      ls(FAV, JSON.stringify(picked));
      try { document.dispatchEvent(new CustomEvent('ecm:fav-change')); } catch (err) {}
      track('app_onboarding', { result: 'picked', games: picked.length });
      go.disabled = true; go.textContent = '알림을 켜는 중…';
      var on = typeof window.ECM_PUSH_TURN_ON === 'function' ? window.ECM_PUSH_TURN_ON() : null;
      // 알림 권한 창에 답할 때까지 기다렸다가 내 게임 칸으로 (실패해도 고른 게임은 저장돼 있다)
      Promise.resolve(on).catch(function () {}).then(function () {
        close();
        location.replace('/today/?utm_source=app#mine');
        setTimeout(function () { location.reload(); }, 50);
      });
    });
  }

  // 아이폰 앱: 내 게임이 바뀔 때마다 위젯에 알린다 (안드로이드에는 위젯이 없다)
  function syncWidget() {
    var C = window.Capacitor;
    if (!C || typeof C.nativePromise !== 'function' || typeof C.getPlatform !== 'function' || C.getPlatform() !== 'ios') return;
    C.nativePromise('EcmWidget', 'save', { games: favs() }).catch(function () {});
  }
  document.addEventListener('ecm:fav-change', syncWidget);

  // ── 광고 (애드몹, 앱 플러그인 @capacitor-community/admob) ──
  // 웹뷰 안에서는 애드센스를 쓰지 않는다(scripts/analytics.js 가 ECMApp 이면 건너뜀). 앱 광고는 여기서만.
  // live 는 플랫폼별. false 면 구글 테스트 광고. 스토어 출시 + 애드몹 '스토어 추가' 뒤에 true 로 바꾼다(앱 업데이트 필요 없음).
  //   테스트 기기에서 실제 광고가 눌리면 무효 트래픽이 되니 출시 전에는 false 그대로 둔다.
  //   아이폰은 2026-10-27 App Store 출시 → true. 안드로이드는 플레이 정식 출시 전이라 false.
  // 애드몹 플러그인이 없는 예전 앱 빌드에서는 호출이 실패하고 조용히 넘어간다.
  var ADMOB = {
    live: { ios: true, android: false },
    android: { banner: 'ca-app-pub-2513976449143160/1385702966', interstitial: 'ca-app-pub-2513976449143160/5934402196' },
    ios: { banner: 'ca-app-pub-2513976449143160/3952156554', interstitial: 'ca-app-pub-2513976449143160/9977763995' },
    test: {
      android: { banner: 'ca-app-pub-3940256099942544/9214589741', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
      ios: { banner: 'ca-app-pub-3940256099942544/2435281174', interstitial: 'ca-app-pub-3940256099942544/4411468910' }
    }
  };
  // 전면 광고: 게임 페이지 5번째마다, 광고 사이 최소 3분, 앱을 처음 연 뒤 하루는 없음, 알림을 눌러 들어온 화면에는 없음 (아워운세와 같은 기준)
  var AD_EVERY = 5, AD_GAP = 3 * 60e3, AD_GRACE = 24 * 3600e3, AD_KEY = 'ecm:app-ad', FIRST_KEY = 'ecm:app-first-open', BANNER_H = 'ecm:app-banner-h';
  function ads() {
    var C = window.Capacitor;
    if (!C || typeof C.nativePromise !== 'function' || typeof C.getPlatform !== 'function') return;
    // 첫 실행 게임 고르기 화면 위에는 배너를 두지 않는다. 배너는 네이티브 화면이라 앞 페이지에서 띄운 것이 남아 있으면
    // 고르기 버튼을 가린다(2026-10-13 실기기 시험) → 숨기고, 고르고 나서 페이지를 다시 열 때 resumeBanner 로 되살린다
    if (document.querySelector('.ecm-onb')) { C.nativePromise('AdMob', 'hideBanner', {}).catch(function () {}); return; }
    var ios = C.getPlatform() === 'ios', live = !!ADMOB.live[ios ? 'ios' : 'android'], units = (live ? ADMOB : ADMOB.test)[ios ? 'ios' : 'android'];
    function call(m, o) { return C.nativePromise('AdMob', m, o || {}); }
    var nav = document.querySelector('.ecm-apptabs'), tabH = nav ? nav.offsetHeight : 0;
    // 배너는 네이티브 화면이라 페이지 위에 겹친다: 탭 바 바로 위에 두고, 그 높이만큼 본문 아래 여백을 늘린다
    function pad(h) { document.body.style.paddingBottom = 'calc(' + (tabH + h) + 'px + env(safe-area-inset-bottom))'; }
    try { var saved = +sessionStorage.getItem(BANNER_H); if (saved > 0) pad(saved); } catch (e) {}
    if (typeof C.addListener === 'function') C.addListener('AdMob', 'bannerAdSizeChanged', function (s) {
      var h = s && s.height > 0 ? s.height : 0; pad(h);
      try { sessionStorage.setItem(BANNER_H, String(h)); } catch (e) {}
    });
    // 아이폰은 추적 동의를 먼저 묻는다(이미 답했으면 바로 넘어감). 거절해도 광고는 나온다(맞춤 광고가 아닐 뿐)
    var ready = (ios ? call('trackingAuthorizationStatus').then(function (r) { if (r && r.status === 'notDetermined') return call('requestTrackingAuthorization'); }).catch(function () {}) : Promise.resolve())
      .then(function () { return call('initialize', {}); });
    ready.then(function () {
      // 이미 있던 배너에는 showBanner 가 새 광고만 받고 숨김은 풀지 않으며, 응답(resolve)도 오지 않는다(플러그인 8.2 동작,
      // 2026-10-13 실기기에서 확인) → showBanner 를 기다리지 말고 resumeBanner 를 먼저 따로 부른다. 배너가 아직 없으면 실패하고 넘어간다
      call('resumeBanner').catch(function () {});
      return call('showBanner', { adId: units.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: tabH, isTesting: !live });
    }).catch(function () {});

    // 첫 실행 시각은 어느 페이지든 앱을 처음 연 때로 센다(전면 광고 첫날 유예)
    var now = Date.now(), first = +ls(FIRST_KEY);
    if (!(first > 0)) { first = now; ls(FIRST_KEY, String(now)); }
    if (path.indexOf('/game/') !== 0 || /[?&]utm_source=push/.test(location.search)) return;
    if (now - first < AD_GRACE) return;
    var st = { views: 0, last: 0 };
    try { var o = JSON.parse(ls(AD_KEY) || '{}'); st.views = +o.views || 0; st.last = +o.last || 0; } catch (e) {}
    st.views++;
    var due = st.views >= AD_EVERY && now - st.last >= AD_GAP;
    if (due) { st.views = 0; st.last = now; }
    ls(AD_KEY, JSON.stringify(st));
    var opts = { adId: units.interstitial, isTesting: !live };
    ready.then(function () {
      // 다음 차례 바로 전 페이지에서 미리 받아 둔다(네이티브 쪽에 남아 다음 페이지에서 바로 뜬다)
      if (due) return call('showInterstitial').then(function () { track('app_interstitial', { result: 'shown' }); }, function () { return call('prepareInterstitial', opts); });
      if (st.views >= AD_EVERY - 1) return call('prepareInterstitial', opts);
    }).catch(function () {});
  }
  function start() { tabs(); onboarding(); syncWidget(); ads(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
