/* ECM English: copy buttons, "copy all", copied marks (this device only), the next-code dock, and the game search on /en/. */
(function () {
  'use strict';
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {} ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
    fallback(); return Promise.resolve();
  }
  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  /* ---------- game page ---------- */
  var game = document.body.getAttribute('data-game');
  if (game) {
    var KEY = 'ecm-en-copied:' + game;
    var used = new Set();
    try { used = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}
    var save = function () { try { localStorage.setItem(KEY, JSON.stringify(Array.from(used))); } catch (e) {} };
    var rows = $$('.row[data-code]');
    var codes = rows.map(function (r) { return r.getAttribute('data-code'); });
    used.forEach(function (c) { if (codes.indexOf(c) < 0) used.delete(c); });

    var dock = $('.dock');
    if (dock) dock.hidden = false;

    function paint() {
      rows.forEach(function (r) {
        var c = r.getAttribute('data-code'), u = used.has(c), b = $('.copy', r);
        r.classList.toggle('used', u);
        if (!b.classList.contains('done')) b.innerHTML = u ? ICON_OK + 'Copied' : ICON_COPY + 'Copy';
      });
      if (!dock) return;
      var next = codes.filter(function (c) { return !used.has(c); })[0];
      var n = codes.length - codes.filter(function (c) { return !used.has(c); }).length;
      $('.dock .mono').textContent = next || 'All copied';
      $('.dock .lbl').textContent = next ? 'Next code · ' + n + ' of ' + codes.length + ' copied' : 'You copied all ' + codes.length + ' codes';
      $('.dock .copy').disabled = !next;
    }
    function flash(b) {
      b.classList.add('done'); b.innerHTML = ICON_OK + 'Copied';
      clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('done'); paint(); }, 1400);
    }
    function mark(c) { used.add(c); save(); paint(); }

    document.addEventListener('click', function (e) {
      var b = e.target.closest('.row .copy');
      if (b) {
        var c = b.closest('.row').getAttribute('data-code');
        copyText(c); mark(c); flash(b); toast('Copied ' + c); track('copy_code', { game: game, code: c, via: 'row' });
        return;
      }
      if (e.target.closest('.dock .copy')) {
        var nx = codes.filter(function (c) { return !used.has(c); })[0];
        if (!nx) return;
        copyText(nx); mark(nx); toast('Copied ' + nx); track('copy_code', { game: game, code: nx, via: 'dock' });
        return;
      }
      if (e.target.closest('.dock .reset')) { used.clear(); save(); paint(); toast('Cleared copied marks'); return; }
      var all = e.target.closest('[data-copy-all]');
      if (all) {
        copyText(codes.join('\n'));
        all.innerHTML = ICON_OK + 'Copied all';
        setTimeout(function () { all.innerHTML = ICON_COPY + 'Copy all'; }, 1400);
        toast('Copied ' + codes.length + ' codes'); track('copy_all', { game: game, count: codes.length });
      }
    });
    paint();
  }

  /* ---------- game index search ---------- */
  var q = $('#game-search');
  if (q) {
    var key = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var cards = $$('.card[data-name]');
    var groups = $$('[data-group]');
    q.addEventListener('input', function () {
      var k = key(q.value);
      cards.forEach(function (c) { c.hidden = k && key(c.getAttribute('data-name')).indexOf(k) < 0; });
      groups.forEach(function (g) { g.hidden = !$$('.card[data-name]', g).some(function (c) { return !c.hidden; }); });
      var none = $('#no-match'); if (none) none.hidden = cards.some(function (c) { return !c.hidden; });
    });
  }
})();
