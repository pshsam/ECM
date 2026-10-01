/**
 * ECM 쿠폰 안드로이드 앱 안에서만 불러오는 스크립트 (assets/ecm.js 가 사용자 에이전트의 "ECMApp" 을 보고 부른다).
 * 웹 방문자에게는 아무 영향이 없다. 앱 코드는 별도 저장소(바탕 화면 'ECM 앱')에 있다.
 *
 * - 쇼핑 할인 메뉴·페이지를 숨긴다 (앱은 게임 쿠폰 전용)
 * - 아래쪽 탭 바: 오늘 · 전체 게임 · 내 게임
 * - 처음 실행: 오늘의 쿠폰에서 "어떤 게임 하세요?" 고르기 → 새 쿠폰 알림 켜기 (assets/ecm-push.js 의 ECM_PUSH_TURN_ON)
 */
(function () {
  var path = location.pathname;
  if (/^\/shop(\/|$)/.test(path)) { location.replace('/today/?utm_source=app'); return; }

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
    'a[href^="/shop"], a[href*="ecm-coupon.com/shop"], [data-shop], .ecm-install { display: none !important; }',
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
      + '<h2 id="onbTitle">어떤 게임 하세요?</h2><p>고른 게임에 새 쿠폰이 올라오면 바로 알려 드려요. 나중에 게임 페이지의 ‘내 게임에 담기’로 바꿀 수 있어요.</p>'
      + '<input type="search" id="onbQ" placeholder="게임 이름 검색 (지금 코드가 있는 게임 ' + games.length + '종)" aria-label="게임 이름 검색">'
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

  // 검색창 안내 글에서 '쇼핑몰'을 뺀다 (앱은 게임 쿠폰만)
  function searchHint() {
    Array.prototype.forEach.call(document.querySelectorAll('input[placeholder*="쇼핑"]'), function (i) { i.placeholder = i.placeholder.replace(/·?\s*쇼핑몰/, ''); });
  }

  function start() { tabs(); searchHint(); onboarding(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
