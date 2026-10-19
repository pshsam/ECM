// 코드가 없는 게임 정리 (2026-10-15, 애드센스 '가치가 별로 없는 콘텐츠' 대응)
//   A: data/game-listing.json 의 keepListedWithoutCodes 게임은 코드가 없어도 목록에 남는다
//   B: 그 밖의 게임은 살아 있는 코드가 0개면 목록·메뉴·/game/·사이트맵·llms.txt 에서 빠지고, 페이지는 noindex 로 남는다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const { isListed, KEEP_LISTED_WITHOUT_CODES, evaluate, writeGamePages, headerHtml, footerHtml, GENRE_LABELS } = require('../scripts/game-pages');
const { writeGameHub } = require('../scripts/hubs');
const { writeLlmsTxt } = require('../scripts/llms-txt');
const { writeSitemap } = require('../scripts/prerender');

const page = loadPage();
const { initialGameCatalog: catalog, KEEP_LISTED_WITHOUT_CODES: homeList } = page.state();
const LISTING_FILE = path.join(ROOT, 'data', 'game-listing.json');
const activeOf = g => (g.coupons || []).filter(c => evaluate(c).active);
const NOINDEX = /<meta name="robots" content="noindex">/;
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('코드가 없어도 남길 게임 목록은 data/game-listing.json 한 곳에 있고, 모두 카탈로그에 있는 게임이다', () => {
  const j = JSON.parse(fs.readFileSync(LISTING_FILE, 'utf8'));
  const list = j.keepListedWithoutCodes;
  assert.ok(Array.isArray(list) && list.length > 0, 'keepListedWithoutCodes 가 비었음');
  assert.deepEqual(KEEP_LISTED_WITHOUT_CODES, list, 'scripts/game-pages.js 가 읽은 목록이 파일과 다름');
  assert.equal(new Set(list).size, list.length, '같은 id 가 두 번 들어 있음');
  for (const id of list) {
    const g = catalog.find(x => x.id === id);
    assert.ok(g, `${id}: 카탈로그에 없는 게임`);
    assert.ok(g.redeemHow && g.redeemHow.trim(), `${id}: 입력 방법(redeemHow)이 없어 페이지가 안 만들어짐`);
  }
});

test('index.html 의 KEEP_LISTED_WITHOUT_CODES 가 data/game-listing.json 과 같다 (prerender 를 돌렸는지)', () => {
  assert.deepEqual(homeList, KEEP_LISTED_WITHOUT_CODES);
});

test('목록 규칙이 화면(index.html isListedGame)과 빌드(game-pages.js isListed)에서 같다', () => {
  const keep = KEEP_LISTED_WITHOUT_CODES[0];
  const samples = [
    ...catalog,
    { id: 'zz-none', redeemHow: '설정 > 쿠폰', coupons: [] },
    { id: 'zz-live', coupons: [{ code: 'LIVE1', reward: 'r', expireDate: '상시' }] },
    { id: 'zz-old', redeemHow: '설정 > 쿠폰', coupons: [{ code: 'OLD1', reward: 'r', expireDate: '2020-01-01' }] },
    { id: 'zz-stale', redeemHow: '설정 > 쿠폰', coupons: [{ code: 'ST1', reward: 'r', recheckBy: '2020-01-01' }] },
    { id: keep, redeemHow: '설정 > 쿠폰', coupons: [] },
    { id: keep, coupons: [] }, // 입력 방법이 없으면 페이지가 없으니 목록에도 없다
  ];
  for (const g of samples) {
    assert.equal(page.fn.isListedGame(g), isListed(g, activeOf), `${g.id}: 화면과 빌드의 판단이 다름`);
  }
  assert.equal(isListed(samples.find(g => g.id === 'zz-none'), activeOf), false);
  assert.equal(isListed(samples.find(g => g.id === 'zz-live'), activeOf), true);
  assert.equal(isListed({ id: keep, redeemHow: 'x', coupons: [] }, activeOf), true);
});

test('B: 코드가 없는 게임은 사이트맵·llms.txt·/game/ 에서 빠지고 페이지는 noindex, 코드가 있는 게임은 들어간다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecm-listing-'));
  try {
    for (const f of ['index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html', 'guide.html', 'guide/redeem-errors.html', 'blog/index.html']) {
      fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
      fs.writeFileSync(path.join(tmp, f), '');
    }
    const keep = KEEP_LISTED_WITHOUT_CODES[0];
    const base = { publisher: '테스트', platforms: ['pc'], genre: 'rpg', category: 'RPG', redeemHow: '설정 > 쿠폰' };
    const games = [
      { ...base, id: 'zz-hidden', title: '숨김 게임', coupons: [{ code: 'GONE1', reward: 'r', expireDate: '2020-01-01' }] },
      { ...base, id: 'zz-live', title: '코드 있는 게임', coupons: [{ code: 'LIVE1', reward: 'r', expireDate: '상시' }] },
      { ...base, id: keep, title: '남기는 게임', coupons: [] },
    ];
    const gp = writeGamePages(tmp, games, [], '2026-10-15', {}, {});
    assert.deepEqual(gp.ids.sort(), ['zz-hidden', 'zz-live', keep].sort(), '숨긴 게임도 페이지 파일은 남아야 함');
    assert.deepEqual(gp.listedIds.sort(), ['zz-live', keep].sort());

    const hiddenPage = fs.readFileSync(path.join(tmp, 'game', 'zz-hidden.html'), 'utf8');
    assert.match(hiddenPage, NOINDEX, '숨긴 게임 페이지에 noindex 가 없음');
    assert.doesNotMatch(fs.readFileSync(path.join(tmp, 'game', 'zz-live.html'), 'utf8'), NOINDEX);
    assert.doesNotMatch(fs.readFileSync(path.join(tmp, 'game', keep + '.html'), 'utf8'), NOINDEX);
    // 목록에 보이는 게임 페이지의 관련 게임 칩도 숨긴 게임으로 가지 않는다
    assert.doesNotMatch(fs.readFileSync(path.join(tmp, 'game', 'zz-live.html'), 'utf8'), /\/game\/zz-hidden\.html/);

    writeSitemap(tmp, gp.listedIds, []);
    writeLlmsTxt(tmp, games, gp.listedIds, [], '2026-10-15');
    writeGameHub(tmp, { games, posts: [], version: '2026-10-15', firstSeen: {}, gamePageIds: gp.listedIds, evaluate, GENRE_LABELS, headerHtml, footerHtml });
    for (const f of ['sitemap.xml', 'llms.txt', 'game/index.html']) {
      const out = fs.readFileSync(path.join(tmp, f), 'utf8');
      assert.doesNotMatch(out, /\/game\/zz-hidden\.html/, `${f} 에 숨긴 게임이 있음`);
      assert.match(out, /\/game\/zz-live\.html/, `${f} 에 코드 있는 게임이 없음`);
      assert.match(out, new RegExp(`/game/${keep}\\.html`), `${f} 에 남기기로 한 게임이 없음`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── 실제 빌드 결과 (node scripts/prerender.js 를 돌린 뒤) ──
const pageFiles = fs.readdirSync(path.join(ROOT, 'game')).filter(f => f.endsWith('.html') && f !== 'index.html');
const hiddenIds = pageFiles.filter(f => NOINDEX.test(read('game/' + f))).map(f => f.replace(/\.html$/, ''));
const shownIds = pageFiles.map(f => f.replace(/\.html$/, '')).filter(id => !hiddenIds.includes(id));

test('noindex 게임 페이지는 지금 살아 있는 코드가 없고, 남길 게임 목록에도 없는 게임이다', () => {
  for (const id of hiddenIds) {
    const g = catalog.find(x => x.id === id);
    assert.ok(g, `${id}: 카탈로그에 없는 게임의 페이지가 남아 있음`);
    assert.equal(activeOf(g).length, 0, `${id}: 살아 있는 코드가 있는데 noindex (prerender 를 다시 돌리세요)`);
    assert.ok(!KEEP_LISTED_WITHOUT_CODES.includes(id), `${id}: 남길 게임인데 noindex`);
  }
});

test('살아 있는 코드가 있는 게임은 페이지가 noindex 가 아니고 사이트맵·llms.txt 에 있다', () => {
  const sitemap = read('sitemap.xml'), llms = read('llms.txt');
  for (const g of catalog.filter(x => activeOf(x).length > 0)) {
    assert.ok(shownIds.includes(g.id), `${g.id}: 코드가 있는데 페이지가 없거나 noindex`);
    assert.ok(sitemap.includes(`/game/${g.id}.html`), `${g.id}: 사이트맵에 없음`);
    assert.ok(llms.includes(`/game/${g.id}.html`), `${g.id}: llms.txt 에 없음`);
  }
});

test('사이트맵의 게임 페이지는 noindex 가 아닌 페이지와 정확히 같다', () => {
  const inMap = [...read('sitemap.xml').matchAll(/\/game\/([a-z0-9_-]+)\.html/g)].map(m => m[1]).sort();
  assert.deepEqual(inMap, shownIds.slice().sort());
});

test('목록·메뉴·허브·오늘의 쿠폰·무료 혜택·다른 게임 페이지가 noindex 게임 페이지로 링크하지 않는다', () => {
  const files = ['index.html', 'assets/menu.html', 'game/index.html', 'today/index.html', 'llms.txt', 'sitemap.xml',
    ...fs.readdirSync(path.join(ROOT, 'free')).filter(f => f.endsWith('.html')).map(f => 'free/' + f),
    ...shownIds.map(id => `game/${id}.html`)];
  for (const f of files) {
    const html = read(f);
    for (const id of hiddenIds) assert.ok(!html.includes(`/game/${id}.html`), `${f} 가 숨긴 게임 /game/${id}.html 로 링크함`);
  }
});

test('홈 화면 게임 목록·메뉴에 목록에서 뺀 게임이 없다 (화면 스크립트 기준)', () => {
  for (const g of catalog.filter(x => !page.fn.isListedGame(x))) {
    assert.doesNotMatch(page.grids.game, new RegExp(`data-game-id="${g.id}"`), `${g.id}: 홈 게임 목록에 나옴`);
    assert.doesNotMatch(page.grids.mega, new RegExp(`/game/${g.id}\\.html|data-game="${g.id}"`), `${g.id}: 메뉴에 나옴`);
  }
});
