/**
 * 오늘의 쿠폰: /today/
 *
 * 매일 다시 올 이유가 되는 한 페이지. 아워운세 "오늘의 운세"처럼 날마다 내용이 바뀐다.
 *   - 오늘 새로 올라온 코드 (없으면 최근 3일)
 *   - 오늘·내일 끝나는 코드, 이번 주 끝나는 코드
 *   - 내 게임: 게임 페이지의 "내 게임에 담기"(localStorage ecm:fav)로 고른 게임의 코드만
 *
 * 날짜는 보는 사람의 한국 날짜로 정해야 해서, 코드 목록을 JSON으로 심고 화면은 브라우저가 그린다.
 * 검색엔진·자바스크립트 없는 환경을 위해 빌드한 날 기준의 목록을 먼저 HTML로 그려 둔다.
 * prerender.js 가 쿠폰을 갱신할 때마다 다시 만든다 (루틴이 하루 여러 번 돌린다).
 */
const fs = require('fs');
const path = require('path');
const { SITE, esc, fitTitle, fitDesc, pageShell, breadcrumbLd, writeIfChanged } = require('./page-shell');
const { monoOf } = require('./mono');

const BASELINE_DATE = '2026-09-21'; // 사이트를 연 날 한꺼번에 넣은 코드는 "새 코드"로 치지 않는다 (hubs.js 와 같다)

const CSS = `
    .td-date { font-size: .85rem; color: var(--ink-3); margin: 0 0 .2rem; }
    .td-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin: 0 0 1.5rem; }
    .td-stats > div { padding: .75rem .9rem; display: flex; flex-direction: column; gap: .05rem; }
    .td-stats > div + div { border-left: 1px solid var(--line); }
    .td-stats b { font-size: 1.35rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .td-stats span { font-size: .75rem; color: var(--ink-3); }
    .td-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: #fff; }
    .td-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: .15rem .8rem; align-items: center; padding: .85rem 1rem; border-top: 1px solid var(--line); }
    .td-row:first-child { border-top: 0; }
    .td-ico { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font-size: 1rem; grid-row: span 2; align-self: start; }
    .td-main { min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
    .td-game { font-weight: 700; font-size: .92rem; color: var(--ink); text-decoration: none; }
    .td-game:hover { text-decoration: underline; text-decoration-color: var(--y-deep); text-decoration-thickness: 3px; text-underline-offset: 3px; }
    .td-code { font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 700; font-size: 1rem; letter-spacing: .02em; overflow-wrap: anywhere; }
    .td-reward { font-size: .8rem; color: var(--ink-2); line-height: 1.5; }
    .td-side { display: flex; flex-direction: column; align-items: flex-end; gap: .35rem; }
    .td-empty { padding: 1rem; color: var(--ink-3); font-size: .88rem; border: 1px dashed var(--line); border-radius: 14px; margin: 0; }
    .td-fav-bar { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin: 0 0 .75rem; }
    .td-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .5rem .35rem .75rem; border-radius: 999px; background: var(--sf); font-size: .85rem; font-weight: 600; }
    .td-chip button { border: 0; background: none; color: var(--ink-3); cursor: pointer; font-size: .85rem; padding: 0 .2rem; }
    .td-pick { display: flex; gap: .4rem; flex-wrap: wrap; }
    .td-pick select { height: 40px; border-radius: 10px; border: 1px solid var(--line); background: #fff; padding: 0 .6rem; font-family: inherit; font-size: .88rem; max-width: 100%; }
    .td-pick button { height: 40px; }
    .ecm-page-note { font-size: .85rem; color: var(--ink-3); }
    @media (max-width: 480px) { .td-row { grid-template-columns: 40px minmax(0, 1fr); } .td-side { grid-column: 2; flex-direction: row; align-items: center; justify-content: space-between; margin-top: .35rem; } }
`;

function writeTodayPage(rootDir, { games, firstSeen, gamePageIds, evaluate, headerHtml, footerHtml, version }) {
  const pages = new Set(gamePageIds);
  const items = [];
  for (const g of games) {
    const m = monoOf(g.title);
    for (const c of g.coupons || []) {
      const ev = evaluate(c.expireDate);
      if (!ev.active) continue;
      const seen = firstSeen[g.id + ':' + c.code] || '';
      items.push({
        id: g.id, t: g.title, u: pages.has(g.id) ? `/game/${g.id}.html` : '/game/', mh: m.h, mc: m.ch,
        c: c.code, r: c.reward || '', e: c.expireDate || '상시', s: seen > BASELINE_DATE ? seen : '',
      });
    }
  }
  const gameList = [...new Map(items.map(x => [x.id, { id: x.id, t: x.t }])).values()].sort((a, b) => a.t.localeCompare(b.t, 'ko'));

  // ── 빌드한 날 기준의 HTML (검색엔진·자바스크립트 없는 환경) ──
  const k = new Date(Date.now() + 9 * 3600e3);
  const iso = k.toISOString().slice(0, 10);
  const dayLabel = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${'일월화수목금토'[k.getUTCDay()]}요일`;
  const leftOf = x => evaluate(x.e).left;
  const daysSince = s => s ? Math.round((Date.parse(iso) - Date.parse(s)) / 86400000) : 99;
  const fresh = items.filter(x => daysSince(x.s) <= 2).sort((a, b) => b.s.localeCompare(a.s));
  const soon = items.filter(x => leftOf(x) !== null && leftOf(x) <= 1).sort((a, b) => leftOf(a) - leftOf(b));
  const week = items.filter(x => leftOf(x) !== null && leftOf(x) >= 2 && leftOf(x) <= 7).sort((a, b) => leftOf(a) - leftOf(b));
  const row = x => {
    const l = leftOf(x);
    const pill = l === null ? '<span class="ecm-pill due">상시</span>' : `<span class="ecm-pill ${l <= 1 ? 'hot' : 'due'}">${l === 0 ? '오늘 마감' : `D-${l}`}</span>`;
    return `<li class="td-row"><span class="td-ico ecm-mono" style="--mh:${x.mh}" aria-hidden="true">${esc(x.mc)}</span><div class="td-main"><a class="td-game" href="${esc(x.u)}">${esc(x.t)}</a><code class="td-code">${esc(x.c)}</code><span class="td-reward">${esc(x.r)}</span></div><div class="td-side">${x.s === iso ? '<span class="ecm-pill new">NEW</span>' : ''}${pill}<button type="button" class="ecm-btn-primary" data-copy="${esc(x.c)}"><i class="fa-regular fa-copy"></i> 복사</button></div></li>`;
  };
  const list = (arr, empty) => arr.length ? `<ul class="td-list">\n${arr.map(row).join('\n')}\n</ul>` : `<p class="td-empty">${empty}</p>`;

  const body = `    <nav class="hub-crumb" aria-label="현재 위치"><a href="/">ECM 쿠폰</a> › 오늘의 쿠폰</nav>
    <div class="hub-head">
      <p class="td-date" id="tdDate">${esc(dayLabel)}</p>
      <h1>오늘의 쿠폰</h1>
      <p class="hub-lede">오늘 새로 올라온 코드와 곧 끝나는 코드를 매일 한곳에 모아요. 게임 페이지에서 <b>내 게임에 담기</b>를 누르면 내가 하는 게임의 코드만 따로 모아 볼 수 있어요.</p>
    </div>
    <div class="td-stats" id="tdStats"><div><b>${fresh.filter(x => x.s === iso).length}</b><span>오늘 새 코드</span></div><div><b>${soon.length}</b><span>오늘·내일 마감</span></div><div><b>${items.length}</b><span>지금 쓸 수 있는 코드</span></div></div>

    <section class="hub-sec" id="mine" aria-labelledby="mineTitle">
      <h2 id="mineTitle"><i class="fa-solid fa-star"></i> 내 게임</h2>
      <div id="tdMine"><p class="td-empty">게임 페이지에서 <b>내 게임에 담기</b>를 누르거나, 아래에서 게임을 골라 담아 보세요.</p></div>
      <div class="td-pick" id="tdPick" hidden>
        <select id="tdPickSel" aria-label="담을 게임 고르기"><option value="">코드가 있는 게임 ${gameList.length}종</option>${gameList.map(g => `<option value="${esc(g.id)}">${esc(g.t)}</option>`).join('')}</select>
        <button type="button" class="ecm-btn-primary" id="tdPickAdd">내 게임에 담기</button>
      </div>
    </section>

    <section class="hub-sec" id="new" aria-labelledby="newTitle">
      <h2 id="newTitle"><i class="fa-solid fa-bolt"></i> <span id="newTitleText">새로 올라온 코드</span> <small>최근 3일</small></h2>
      <div id="tdNew">${list(fresh, '최근 3일 안에 새로 올라온 코드가 없어요.')}</div>
    </section>

    <section class="hub-sec" id="soon" aria-labelledby="soonTitle">
      <h2 id="soonTitle"><i class="fa-regular fa-clock"></i> 오늘·내일 끝나요</h2>
      <div id="tdSoon">${list(soon, '오늘·내일 끝나는 코드는 없어요.')}</div>
    </section>

    <section class="hub-sec" id="week" aria-labelledby="weekTitle">
      <h2 id="weekTitle"><i class="fa-regular fa-calendar"></i> 이번 주 안에 끝나요</h2>
      <div id="tdWeek">${list(week, '이번 주 안에 끝나는 코드는 없어요.')}</div>
    </section>

    <p class="ecm-page-note">코드는 게임사 공식 채널에서 확인한 것만 올려요. 전체 목록은 <a class="hub-link" href="/game/">게임 쿠폰 홈</a>에 있어요.</p>
    <div id="copyToast" class="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-50 hidden px-4 py-2 rounded-full ecm-toast text-xs font-bold shadow-2xl">복사했습니다</div>
    <script type="application/json" id="todayData">${JSON.stringify({ items, games: gameList }).replace(/</g, '\\u003c')}</script>
    <script>${CLIENT}</script>`;

  const title = fitTitle(['오늘의 쿠폰 — 새 게임 쿠폰 코드와 마감 임박 코드 | ECM 쿠폰', '오늘의 쿠폰 | ECM 쿠폰']);
  const desc = fitDesc(['오늘 새로 올라온 게임 쿠폰 코드와 오늘·내일 끝나는 코드를 매일 한곳에. 내가 하는 게임만 모아 볼 수도 있어요.', '오늘 새 게임 쿠폰 코드와 마감 임박 코드를 매일 한곳에.']);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '오늘의 쿠폰', description: desc, url: SITE + '/today/', inLanguage: 'ko', dateModified: version,
      isPartOf: { '@type': 'WebSite', name: 'ECM 쿠폰', url: SITE + '/' } },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '오늘의 쿠폰', path: '/today/' }]),
  ];
  const html = pageShell({ title, desc, path: '/today/', ld, style: CSS, body, headerHtml, footerHtml });
  const dir = path.join(rootDir, 'today');
  fs.mkdirSync(dir, { recursive: true });
  return writeIfChanged(fs, path.join(dir, 'index.html'), html);
}

// 브라우저 쪽: 보는 사람의 한국 날짜로 다시 그리고, 내 게임(localStorage ecm:fav)을 채운다.
const CLIENT = `
(function () {
  var data = JSON.parse(document.getElementById('todayData').textContent);
  var KEY = 'ecm:fav';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var k = new Date(Date.now() + 9 * 3600e3);
  var today = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  var iso = k.toISOString().slice(0, 10);
  function left(e) { var m = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(e || ''); return m ? Math.round((Date.UTC(+m[1], m[2] - 1, +m[3]) - today) / 864e5) : null; }
  function since(s) { return s ? Math.round((today - Date.parse(s)) / 864e5) : 99; }
  var live = data.items.filter(function (x) { var l = left(x.e); return l === null || l >= 0; });
  function row(x) {
    var l = left(x.e);
    var pill = l === null ? '<span class="ecm-pill due">상시</span>' : '<span class="ecm-pill ' + (l <= 1 ? 'hot' : 'due') + '">' + (l === 0 ? '오늘 마감' : 'D-' + l) + '</span>';
    return '<li class="td-row"><span class="td-ico ecm-mono" style="--mh:' + x.mh + '" aria-hidden="true">' + esc(x.mc) + '</span><div class="td-main"><a class="td-game" href="' + esc(x.u) + '">' + esc(x.t) + '</a><code class="td-code">' + esc(x.c) + '</code><span class="td-reward">' + esc(x.r) + '</span></div><div class="td-side">' + (x.s === iso ? '<span class="ecm-pill new">NEW</span>' : '') + pill + '<button type="button" class="ecm-btn-primary" data-copy="' + esc(x.c) + '"><i class="fa-regular fa-copy"></i> 복사</button></div></li>';
  }
  function list(arr, empty) { return arr.length ? '<ul class="td-list">' + arr.map(row).join('') + '</ul>' : '<p class="td-empty">' + empty + '</p>'; }
  var byLeft = function (a, b) { return left(a.e) - left(b.e); };
  var todayNew = live.filter(function (x) { return x.s === iso; });
  var recent = live.filter(function (x) { return since(x.s) <= 2; }).sort(function (a, b) { return b.s.localeCompare(a.s); });
  var soon = live.filter(function (x) { var l = left(x.e); return l !== null && l <= 1; }).sort(byLeft);
  var week = live.filter(function (x) { var l = left(x.e); return l !== null && l >= 2 && l <= 7; }).sort(byLeft);

  document.getElementById('tdDate').textContent = (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일 ' + '일월화수목금토'[k.getUTCDay()] + '요일';
  document.getElementById('newTitleText').textContent = todayNew.length ? '오늘 새로 올라온 코드' : '새로 올라온 코드';
  document.getElementById('tdNew').innerHTML = list(todayNew.length ? todayNew : recent, '최근 3일 안에 새로 올라온 코드가 없어요.');
  document.getElementById('tdSoon').innerHTML = list(soon, '오늘·내일 끝나는 코드는 없어요.');
  document.getElementById('tdWeek').innerHTML = list(week, '이번 주 안에 끝나는 코드는 없어요.');

  function paintMine() {
    var fav = load();
    var mine = live.filter(function (x) { return fav.indexOf(x.id) >= 0; }).sort(function (a, b) { var la = left(a.e), lb = left(b.e); return (la === null ? 999 : la) - (lb === null ? 999 : lb); });
    var names = fav.map(function (id) { var g = data.games.filter(function (x) { return x.id === id; })[0]; return g ? '<span class="td-chip">' + esc(g.t) + '<button type="button" data-unfav="' + esc(id) + '" aria-label="' + esc(g.t) + ' 빼기">✕</button></span>' : ''; }).join('');
    var box = document.getElementById('tdMine');
    if (!fav.length) box.innerHTML = '<p class="td-empty">게임 페이지에서 <b>내 게임에 담기</b>를 누르거나, 아래에서 게임을 골라 담아 보세요.</p>';
    else box.innerHTML = '<div class="td-fav-bar">' + names + '</div>' + list(mine, '담은 게임에 지금 쓸 수 있는 코드가 없어요. 새 코드가 올라오면 여기에 먼저 보여요.');
    var stats = document.getElementById('tdStats');
    stats.innerHTML = '<div><b>' + todayNew.length + '</b><span>오늘 새 코드</span></div><div><b>' + soon.length + '</b><span>오늘·내일 마감</span></div><div><b>' + (fav.length ? mine.length : live.length) + '</b><span>' + (fav.length ? '내 게임 코드' : '지금 쓸 수 있는 코드') + '</span></div>';
  }
  document.getElementById('tdPick').hidden = false;
  paintMine();
  document.getElementById('tdPickAdd').addEventListener('click', function () {
    var id = document.getElementById('tdPickSel').value;
    if (!id) return;
    var fav = load(); if (fav.indexOf(id) < 0) fav.push(id); save(fav); paintMine();
  });
  document.addEventListener('click', function (e) {
    var u = e.target.closest && e.target.closest('[data-unfav]');
    if (u) { var fav = load().filter(function (x) { return x !== u.getAttribute('data-unfav'); }); save(fav); paintMine(); return; }
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
      var t = document.getElementById('copyToast');
      t.classList.remove('hidden');
      setTimeout(function () { t.classList.add('hidden'); }, 1500);
    });
  });
})();
`;

module.exports = { writeTodayPage };
