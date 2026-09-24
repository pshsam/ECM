/* 페이지를 옮길 때 "Coupon on the way" 로딩 표시.
   정적 사이트라 대개 순식간이지만, 느린 회선에서는 아무 반응이 없어 보여 두 번 누르거나 나간다.
   내 사이트 안의 다른 페이지로 가는 링크를 눌렀을 때만 켜고, 새 페이지가 뜨면 사라진다. */
(function () {
  var el, timer;

  function loader() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'ecm-loader';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', '페이지를 불러오는 중');
    var text = 'Coupon on the way';
    var letters = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      letters += ch === ' ' ? '<span class="sp"> </span>'
        : '<span style="animation-delay:' + (i * 60) + 'ms">' + ch + '</span>';
    }
    el.innerHTML = '<div class="ecm-loader-bar"></div>'
      + '<div class="ecm-loader-pill"><img class="ecm-loader-ico" src="/assets/mascot.svg" alt=""><span class="ecm-loader-text">' + letters + '</span></div>';
    document.body.appendChild(el);
    return el;
  }
  function show() {
    loader().classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(hide, 10000); // 다운로드처럼 페이지가 안 바뀌는 경우 대비
  }
  function hide() {
    if (el) el.classList.remove('is-on');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (!a) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    // 메인 화면 안에서 처리하는 링크(게임·쇼핑·카테고리)는 페이지를 옮기지 않는다
    if (typeof window.bindMenu === 'function' && (a.dataset.game || a.dataset.shop || a.dataset.cat)) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(javascript:|mailto:|tel:)/i.test(href)) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // 같은 페이지 안 이동
    show();
  }, true);

  // 블로그 헤더 검색창(GET /?q=)도 페이지를 옮긴다
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.tagName === 'FORM' && (f.getAttribute('action') || '') === '/') show();
  }, true);

  window.addEventListener('pageshow', hide);   // 뒤로 가기(bfcache)로 돌아왔을 때
  window.addEventListener('pagehide', hide);
})();

/* 블로그 글 왼쪽 목차.
   글의 h2(필요하면 h3)로 목차를 만들어 넓은 화면에서는 왼쪽에 붙여 두고(스크롤해도 따라옴),
   좁은 화면에서는 글 위에 접었다 펴는 상자로 둔다. 읽고 있는 항목에 표시가 붙는다. */
(function () {
  if (!/^\/blog\//.test(location.pathname)) return;
  var main = document.querySelector('main');
  var scope = main && main.querySelector('article');
  if (!scope) return; // 글 페이지에만 (목록 페이지는 분류 칩이 있다)
  var heads = Array.prototype.slice.call(scope.querySelectorAll('h2, h3')).filter(function (h) {
    return h.textContent.trim() && !h.closest('.ecm-toc');
  });
  if (heads.filter(function (h) { return h.tagName === 'H2'; }).length < 3) return;

  var used = {};
  heads.forEach(function (h, i) {
    if (!h.id) {
      var base = h.textContent.trim().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 40) || ('sec-' + i);
      var id = base, n = 2;
      while (used[id] || document.getElementById(id)) id = base + '-' + (n++);
      h.id = id;
    }
    used[h.id] = true;
  });

  var aside = document.createElement('aside');
  aside.className = 'ecm-toc';
  aside.setAttribute('aria-label', '목차');
  var list = heads.map(function (h) {
    return '<li class="lv-' + h.tagName.toLowerCase() + '"><a href="#' + h.id + '">' + h.textContent.trim().replace(/</g, '&lt;') + '</a></li>';
  }).join('');
  aside.innerHTML = '<details class="ecm-toc-box" open><summary>목차 <span class="ecm-toc-n">' + heads.length + '</span></summary><ol>' + list + '</ol></details>';
  main.classList.add('has-toc');
  main.insertBefore(aside, main.firstChild);

  // 좁은 화면에서는 접어 둔다
  var box = aside.querySelector('details');
  var mq = window.matchMedia('(max-width: 1279px)');
  function fold() { box.open = !mq.matches; }
  fold();
  if (mq.addEventListener) mq.addEventListener('change', fold);

  // 누르면 목차 밖에서는 접히게, 읽는 위치 표시
  var links = Array.prototype.slice.call(aside.querySelectorAll('a'));
  links.forEach(function (a) {
    a.addEventListener('click', function () { if (mq.matches) box.open = false; });
  });
  if ('IntersectionObserver' in window) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) current = e.target.id;
      });
      if (!current) return;
      links.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + current); });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    heads.forEach(function (h) { io.observe(h); });
  }
})();

/* 메인이 아닌 페이지(블로그·정보)의 드롭다운. 메인은 자체 메뉴 코드(bindMenu)를 쓴다. */
(function () {
  if (typeof window.bindMenu === 'function') return;
  var wrap = document.getElementById('megaMenuWrap');
  var box = document.getElementById('megaGridContainer');
  if (!wrap || !box) return;
  var header = document.getElementById('siteHeader') || wrap.closest('header');
  var openName = null, closeTimer = null;
  var isDesktop = function () { return window.matchMedia('(min-width: 1024px)').matches; };

  // 메인에서 미리 렌더링해 둔 메뉴 3개(게임·쇼핑·블로그). 링크는 메인(/#...)으로 간다.
  fetch('/assets/menu.html', { cache: 'no-store' }).then(function (r) { return r.text(); })
    .then(function (html) { box.innerHTML = html; })
    .catch(function () { box.innerHTML = '<div class="ecm-mega" data-panel="blog"><div class="ecm-mega-panel"><div class="ecm-mega-body"><p class="ecm-mega-empty"><a href="/blog/index.html">블로그 목록 보기</a></p></div></div></div>'; });

  function openMenu(name) {
    openName = name;
    wrap.classList.add('is-open');
    Array.prototype.slice.call(document.querySelectorAll('.ecm-mega')).forEach(function (p) { p.classList.toggle('is-open', p.getAttribute('data-panel') === name); });
    Array.prototype.slice.call(document.querySelectorAll('.ecm-menu-btn')).forEach(function (b) {
      var on = b.getAttribute('data-menu') === name; b.classList.toggle('is-open', on); b.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    if (!isDesktop()) document.body.classList.add('ecm-lock');
  }
  function closeMenu() {
    openName = null;
    wrap.classList.remove('is-open');
    Array.prototype.slice.call(document.querySelectorAll('.ecm-mega, .ecm-menu-btn')).forEach(function (el) { el.classList.remove('is-open'); });
    document.body.classList.remove('ecm-lock');
  }
  function activateSide(panel, key) {
    Array.prototype.slice.call(document.querySelectorAll('.ecm-mega-side-item[data-panel-side="' + panel + '"]')).forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-side') === key); });
    Array.prototype.slice.call(document.querySelectorAll('.ecm-mega-sec[data-panel-sec="' + panel + '"]')).forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-sec') === key); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var btn = t.closest('.ecm-menu-btn');
    if (btn) { var name = btn.getAttribute('data-menu'); if (openName === name && !isDesktop()) closeMenu(); else openMenu(name); return; }
    if (t.closest('#burgerBtn')) { openName ? closeMenu() : openMenu('all'); return; }
    if (t.closest('[data-close-menu]')) { closeMenu(); return; }
    var side = t.closest('.ecm-mega-side-item');
    if (side) { activateSide(side.getAttribute('data-panel-side'), side.getAttribute('data-side')); return; }
    if (openName && header && !header.contains(t)) closeMenu();
    if (openName && !isDesktop() && t.id === 'megaMenuWrap') closeMenu();
  });
  document.addEventListener('mouseover', function (e) {
    if (!isDesktop()) return;
    var t = e.target; if (!t || !t.closest) return;
    // 패널이나 메뉴 줄 위에 있는 동안은 닫지 않는다 (버튼→패널로 내려오는 길에 예약된 닫기를 취소)
    if (t.closest('.ecm-mega-panel') || t.closest('.ecm-menu')) clearTimeout(closeTimer);
    var btn = t.closest('.ecm-menu-btn');
    if (btn) { clearTimeout(closeTimer); openMenu(btn.getAttribute('data-menu')); return; }
    var side = t.closest('.ecm-mega-side-item');
    if (side) { activateSide(side.getAttribute('data-panel-side'), side.getAttribute('data-side')); return; }
    // 패널 상자 밖의 빈 자리(패널 옆)에 마우스가 오면 바로 닫는다
    if (openName && t.closest('#megaMenuWrap') && !t.closest('.ecm-mega-panel')) { clearTimeout(closeTimer); closeMenu(); return; }
    if (openName && header && header.contains(t) && !t.closest('.ecm-menu') && !t.closest('#megaMenuWrap')) {
      clearTimeout(closeTimer); closeTimer = setTimeout(closeMenu, 150);
    }
  });
  if (header) {
    // 헤더(메뉴 줄 + 패널) 밖으로 나가면 바로 닫는다
    header.addEventListener('mouseleave', function () { if (isDesktop()) { clearTimeout(closeTimer); closeMenu(); } });
    header.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
  }
  // 패널 상자 밖으로 나가면(옆·아래) 바로 닫는다. 위쪽 메뉴 줄로 올라가는 중이면 잠깐만 기다린다.
  document.addEventListener('mouseout', function (e) {
    if (!isDesktop() || !openName) return;
    var t = e.target; if (!t || !t.closest) return;
    var panel = t.closest('.ecm-mega-panel'); if (!panel) return;
    var to = e.relatedTarget;
    if (to && panel.contains(to)) return;
    clearTimeout(closeTimer);
    if (to && header && header.contains(to) && !to.closest('#megaMenuWrap')) closeTimer = setTimeout(closeMenu, 120);
    else closeMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
})();

/* 블로그 목록: 카테고리 칩. '최신 글'은 분류 섹션의 카드를 날짜순으로 모아 보여준다. */
(function () {
  var chips = document.getElementById('blogCats');
  var latest = document.getElementById('latestPosts');
  if (!chips || !latest) return;
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[data-cat]'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('main section[data-cat] .post-card'));
  var grid = latest.querySelector('.grid');
  cards.slice().sort(function (a, b) {
    var da = (a.querySelector('.post-date') || {}).textContent || '', db = (b.querySelector('.post-date') || {}).textContent || '';
    return db.localeCompare(da);
  }).forEach(function (c) { grid.appendChild(c.cloneNode(true)); });

  function show(cat) {
    sections.forEach(function (s) { s.hidden = s.getAttribute('data-cat') !== cat; });
    Array.prototype.slice.call(chips.querySelectorAll('.ecm-chip')).forEach(function (b) {
      var on = b.getAttribute('data-cat') === cat; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  chips.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.ecm-chip') : null;
    if (!b) return;
    var cat = b.getAttribute('data-cat');
    show(cat);
    if (history.replaceState) history.replaceState(null, '', cat === 'latest' ? ' ' : '#' + cat);
  });
  var want = (location.hash || '').slice(1);
  show(['game', 'platform', 'life', 'guide'].indexOf(want) >= 0 ? want : 'latest');
})();
