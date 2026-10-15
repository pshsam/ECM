// 검색: 홈 검색창, 블로그 검색창(/?q=), 분야 탭 이동
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./page');

const page = loadPage();
const { games } = page.state();
const { matchesGameSearch } = page.fn;

function search(q) {
  page.setQuery(q.trim().toLowerCase());
}

test('모든 게임은 자기 이름으로 찾아진다', () => {
  for (const g of games) {
    search(g.title);
    assert.ok(matchesGameSearch(g), `${g.id}: '${g.title}'로 검색해도 안 나옴`);
  }
});

test('이름 일부를 띄어쓰기 없이 써도 찾아진다', () => {
  for (const g of games) {
    const part = [...g.title.replace(/[\s\p{P}]/gu, '')].slice(0, 3).join('');
    search(part);
    assert.ok(matchesGameSearch(g), `${g.id}: '${part}'로 검색해도 안 나옴`);
  }
});

test('쿠폰 코드로 찾아지고, 대소문자를 가리지 않는다', () => {
  for (const g of games) {
    for (const c of g.coupons || []) {
      search(c.code.toLowerCase());
      assert.ok(matchesGameSearch(g), `${g.id}: 코드 ${c.code} 소문자 검색 실패`);
      search(c.code.toUpperCase());
      assert.ok(matchesGameSearch(g), `${g.id}: 코드 ${c.code} 대문자 검색 실패`);
    }
  }
});

test('띄어쓰기·문장부호를 무시한다', () => {
  const pick = id => games.find(g => g.id === id);
  const cases = [
    ['펫시뮬레이터', 'roblox-pet-simulator-99'],
    ['붕괴 스타레일', 'starrail'],
    ['붕괴스타레일', 'starrail'],
    ['로스트 아크', 'lostark'],
    ['젠레스존제로', 'zzz'],
  ];
  for (const [q, id] of cases) {
    const g = pick(id);
    if (!g) continue; // 카탈로그에서 빠진 게임은 건너뜀
    search(q);
    assert.ok(matchesGameSearch(g), `'${q}'로 ${id} 가 안 나옴`);
  }
});

test('하이픈 넣은 코드도, 뺀 코드도 찾아진다', () => {
  const g = games.find(x => (x.coupons || []).some(c => c.code.includes('-')));
  if (!g) return;
  const code = g.coupons.find(c => c.code.includes('-')).code;
  search(code.replace(/-/g, ''));
  assert.ok(matchesGameSearch(g));
  search(code.toLowerCase());
  assert.ok(matchesGameSearch(g));
});

test('문장부호만 쓴 검색어는 전부를 띄우지 않는다', () => {
  search('!!!');
  assert.ok(games.filter(matchesGameSearch).length < games.length);
});

test('엉뚱한 검색어는 아무것도 걸리지 않는다', () => {
  search('zzqqxx없는검색어');
  const counts = page.fn.searchCounts();
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 0);
});

test('검색어가 비면 전부 보인다', () => {
  search('');
  assert.ok(games.every(matchesGameSearch));
});

test('목록에 남긴 쿠폰 없는 게임은 검색되고, 목록에서 뺀 게임은 안 나오며, 쿠폰 있는 게임이 위에 온다', () => {
  // 쿠폰이 없어도 목록에 남기기로 한 게임(data/game-listing.json)만. 나머지 쿠폰 없는 게임은 검색에도 안 나온다
  const p = loadPage();
  const { games: gs } = p.state();
  const none = gs.find(g => p.fn.countActiveCoupons(g) === 0 && p.fn.isListedGame(g));
  if (none) {
    p.fn.handleSearch(none.title);
    assert.match(p.grids.game, new RegExp(`data-game-id="${none.id}"`));
  }
  const hidden = gs.find(g => !p.fn.isListedGame(g));
  if (hidden) {
    p.fn.handleSearch(hidden.title);
    assert.doesNotMatch(p.grids.game, new RegExp(`data-game-id="${hidden.id}"`), `${hidden.id}: 목록에서 뺀 게임이 검색에 나옴`);
  }

  // 쿠폰 있는 게임 카드가 '현재 쿠폰 없음' 카드보다 먼저
  p.fn.handleSearch('');
  const html = p.grids.game;
  const lastActive = html.lastIndexOf('ecm-active');
  const firstSoon = html.indexOf('ecm-soon');
  if (lastActive >= 0 && firstSoon >= 0) assert.ok(lastActive < firstSoon, '쿠폰 없는 게임이 쿠폰 있는 게임보다 위에 있음');
});

test('홈에서 게임 이름을 검색하면 게임 탭으로 옮겨 간다', () => {
  const p = loadPage({ search: '' });
  p.fn.handleSearch(p.state().games.find(p.fn.isListedGame).title);
  assert.equal(p.state().currentMainCategory, 'games');
});

test('쇼핑 할인 기능은 남아 있지 않다 (2026-10 게임 쿠폰 전용으로 정리)', () => {
  const p = loadPage();
  assert.doesNotMatch(p.html, /href="\/shop\//, '홈에 /shop/ 링크가 남아 있음');
  assert.doesNotMatch(p.html, /raw(Fashion|Grocery|Ott|Beauty|Delivery|Travel)Catalog/, '쇼핑 카탈로그 데이터가 남아 있음');
});

test('블로그 검색창(/?q=)으로 들어오면 결과가 있는 탭이 열린다', () => {
  // 2026-10-01 고침: 결과 탭으로 옮긴 뒤 다시 홈으로 되돌려서, '검색 결과 1개'인데 카드가 안 보였다
  const g = games.find(page.fn.isListedGame);
  const p = loadPage({ search: '?q=' + encodeURIComponent(g.title) });
  assert.equal(p.document.getElementById('globalSearchInput').value, g.title);
  assert.equal(p.state().currentMainCategory, 'games');
  assert.match(p.grids.game, new RegExp(`data-game-id="${g.id}"`));
});

test('검색 결과가 없는 /?q= 는 홈에 머문다', () => {
  const p = loadPage({ search: '?q=zzqqxx없는검색어' });
  assert.equal(p.state().currentMainCategory, 'home');
  assert.match(p.document.getElementById('searchSummary').innerHTML, /검색 결과가 없어요/);
});

test('검색어 속 태그는 화면에 그대로 끼어들지 않는다', () => {
  const p = loadPage({ search: '?q=' + encodeURIComponent('<img src=x onerror=alert(1)>') });
  const box = p.document.getElementById('searchSummary').innerHTML;
  assert.doesNotMatch(box, /<img/);
});
