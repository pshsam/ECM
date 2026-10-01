// 검색: 홈 검색창, 블로그 검색창(/?q=), 분야 탭 이동
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./page');

const page = loadPage();
const { games, SHOP_CATS, SHOP_CATALOGS } = page.state();
const { matchesGameSearch, matchesShopSearch } = page.fn;

function search(q) {
  page.setQuery(q.trim().toLowerCase());
}

test('모든 게임은 자기 이름으로 찾아진다', () => {
  for (const g of games) {
    search(g.title);
    assert.ok(matchesGameSearch(g), `${g.id}: '${g.title}'로 검색해도 안 나옴`);
  }
});

test('이름 앞 두 글자로도 찾아진다', () => {
  // 지금 검색은 띄어쓰기를 그대로 비교한다 ('펫시'로는 '펫 시뮬레이터'가 안 나옴). 그래서 이름 앞부분 그대로 자른다.
  for (const g of games) {
    const part = [...g.title].slice(0, 2).join('').trim();
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

test('쇼핑몰은 이름으로 찾아진다', () => {
  for (const cat of SHOP_CATS) {
    for (const m of SHOP_CATALOGS[cat]) {
      search(m.name);
      assert.ok(matchesShopSearch(m), `${cat}/${m.id}: '${m.name}'로 검색해도 안 나옴`);
    }
  }
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

test('쿠폰 없는 게임도 검색하면 목록에 나오고, 쿠폰 있는 게임이 위에 온다', () => {
  const p = loadPage();
  const { games: gs } = p.state();
  const none = gs.find(g => p.fn.countActiveCoupons(g) === 0);
  assert.ok(none, '쿠폰 없는 게임이 하나도 없어 이 테스트를 건너뜀');
  p.fn.handleSearch(none.title);
  assert.match(p.grids.game, new RegExp(`data-game-id="${none.id}"`));

  // 쿠폰 있는 게임 카드가 '현재 쿠폰 없음' 카드보다 먼저
  p.fn.handleSearch('');
  const html = p.grids.game;
  const lastActive = html.lastIndexOf('ecm-active');
  const firstSoon = html.indexOf('ecm-soon');
  if (lastActive >= 0 && firstSoon >= 0) assert.ok(lastActive < firstSoon, '쿠폰 없는 게임이 쿠폰 있는 게임보다 위에 있음');
});

test('홈에서 쇼핑몰 이름을 검색하면 그 분야 탭으로 옮겨 간다', () => {
  const p = loadPage({ search: '' });
  const m = p.state().SHOP_CATALOGS.fashion[0];
  p.fn.handleSearch(m.name);
  assert.equal(p.state().currentMainCategory, 'fashion');
});

test('블로그 검색창(/?q=)으로 들어오면 결과가 있는 탭이 열린다', () => {
  // 2026-10-01 고침: 결과 탭으로 옮긴 뒤 다시 홈으로 되돌려서, '검색 결과 1개'인데 카드가 안 보였다
  const g = games[0];
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
