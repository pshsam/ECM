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
    if (a.dataset.game || a.dataset.shop || a.dataset.cat) return;
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
