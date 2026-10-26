// 공식 출처·직접 확인 중심 (2026-10-27, 애드센스 재심사)
//   data/official-sources.json  게임별 공식 채널. 코드의 src 가 여기 맞으면 "공식 출처"
//   data/game-listing.json      검색에 내보낼 게임 규칙(operatorGames · holdRobloxFromIndex · officialIndexFrom)
//   data/blog-hold.json         검색에서 잠시 뺀 블로그 글
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const { OFFICIAL_SOURCES, srcKey, isOfficialSrc, hasOfficialBasis } = require('../scripts/official');
const { isIndexed, evaluate, couponSourceHtml, OPERATOR_GAMES, HOLD_ROBLOX, OFFICIAL_INDEX_FROM } = require('../scripts/game-pages');
const { BLOG_HOLD } = require('../scripts/prerender');

const page = loadPage();
const { initialGameCatalog: catalog, OFFICIAL_SOURCES: homeSources } = page.state();
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const activeOf = g => (g.coupons || []).filter(c => evaluate(c).active);

// 공식 채널이 아닌 곳: 코드 정리 사이트·매체·커뮤니티. official-sources.json 에 들어가면 안 된다
const NOT_OFFICIAL = /(pockettactics|beebom|pcgamesn|pocketgamer|game8|prydwen|bluestacks|dexerto|mein-mmo|progameguides|sportskeeda|thegamer|tryhardguides|gamesradar|vg247|eurogamer|theclick|mrguider|gamsgo|game\.guide|leekduck|insider-gaming|inven\.co\.kr|ruliweb|namu\.wiki|thisisgame|gamemeca|news\.nate)/i;
// 여러 게임·사람이 같이 쓰는 곳은 계정·카페 경로까지 적어야 한다
const SHARED_HOSTS = ['x.com', 'twitter.com', 'youtube.com', 'facebook.com', 'instagram.com', 'discord.com', 'discord.gg', 'cafe.naver.com', 'game.naver.com', 'roblox.com', 'reddit.com', 'tiktok.com', 'mcoupon.nexon.com', 'coupon.netmarble.com', 'nshop.plaync.com', 'coupon.withhive.com', 'hoyolab.com'];

test('data/official-sources.json 형식: 카탈로그 게임만, 주소는 프로토콜 없이, 매체 없음, 같이 쓰는 곳은 경로까지', () => {
  const j = JSON.parse(read('data/official-sources.json'));
  assert.ok(j.games && typeof j.games === 'object');
  for (const [id, list] of Object.entries(j.games)) {
    assert.ok(catalog.some(g => g.id === id), `${id}: 카탈로그에 없는 게임`);
    assert.ok(Array.isArray(list), `${id}: 배열이 아님`);
    for (const e of list) {
      assert.equal(typeof e, 'string', `${id}: 문자열이 아님`);
      assert.doesNotMatch(e, /^https?:|\s/, `${id}: '${e}' 는 프로토콜·공백 없이 적는다`);
      assert.doesNotMatch(e, NOT_OFFICIAL, `${id}: '${e}' 는 공식 채널이 아님`);
      const host = e.split('/')[0].replace(/^www\./, '');
      if (SHARED_HOSTS.includes(host)) assert.ok(e.includes('/') && e.split('/')[1], `${id}: '${e}' 는 여러 곳이 같이 쓰는 주소라 계정·경로까지 적어야 함`);
    }
  }
});

test('index.html 의 OFFICIAL_SOURCES 가 data/official-sources.json 과 같다 (prerender 를 돌렸는지)', () => {
  assert.deepEqual(homeSources, OFFICIAL_SOURCES);
});

test('공식 출처 판정이 화면(index.html)과 빌드(scripts/official.js)에서 같다', () => {
  const urls = [
    ...catalog.flatMap(g => g.coupons.flatMap(c => (c.src || []).map(u => [g.id, u]))),
    ['blackdesert', 'https://www.kr.playblackdesert.com/ko-KR/News/Detail?boardNo=1'],
    ['lostark', 'https://twitter.com/LOSTARK_KR/status/1'],
    ['nope', 'https://example.com/a'],
    ['lostark', '주소 아님'],
  ];
  for (const [id, u] of urls) {
    assert.equal(page.fn.srcKey(u), srcKey(u), u);
    assert.equal(page.fn.isOfficialSrc(id, u), isOfficialSrc(id, u), `${id} ${u}`);
  }
});

test('공식 출처 판정 규칙: 주소만 적으면 하위 주소까지, 경로를 적으면 그 경로로 시작하는 글만', () => {
  const src = { a: ['kr.playblackdesert.com', 'x.com/Game_KR'], b: ['blackdesertm.com'] };
  assert.ok(isOfficialSrc('a', 'https://www.kr.playblackdesert.com/ko-KR/News', src));
  assert.ok(isOfficialSrc('b', 'https://game.blackdesertm.com/coupon', src), '하위 주소');
  assert.ok(!isOfficialSrc('b', 'https://notblackdesertm.com/x', src), '이름만 비슷한 다른 주소');
  assert.ok(isOfficialSrc('a', 'https://twitter.com/game_kr/status/123', src), 'twitter.com = x.com, 대소문자 무시');
  assert.ok(isOfficialSrc('a', 'https://x.com/Game_KR', src));
  assert.ok(!isOfficialSrc('a', 'https://x.com/Game_KR_fan/status/1', src), '계정 이름 경계');
  assert.ok(!isOfficialSrc('a', 'https://x.com/other/status/1', src));
  assert.ok(!isOfficialSrc('c', 'https://kr.playblackdesert.com/', src), '목록에 없는 게임');
  assert.ok(!isOfficialSrc('a', '주소 아님', src));
});

test('출처 줄: 공식 출처가 있으면 공식 주소만 "공식 출처"로, 없으면 "참고"로', () => {
  const c = { src: ['https://www.pockettactics.com/x', 'https://kr.playblackdesert.com/ko-KR/News/Notice'], verified: '2026-10-27' };
  const html = couponSourceHtml(c, 'blackdesert');
  assert.match(html, /공식 출처<\/b> <a [^>]*>kr\.playblackdesert\.com<\/a>/);
  assert.doesNotMatch(html, /pockettactics/, '공식 출처가 있으면 매체 주소는 보여 주지 않음');
  assert.match(couponSourceHtml({ src: ['https://www.pockettactics.com/x'] }, 'blackdesert'), /참고 <a /);
});

test('직접 확인(tested ok)은 공식 출처와 같은 근거로 센다. 실패(fail)는 세지 않는다', () => {
  const c = { code: 'ABC', src: ['https://www.pockettactics.com/x'] };
  assert.ok(!hasOfficialBasis('zz', c, {}));
  assert.ok(hasOfficialBasis('zz', c, { 'zz:ABC': { date: '2026-10-27', result: 'ok' } }));
  assert.ok(!hasOfficialBasis('zz', c, { 'zz:ABC': { date: '2026-10-27', result: 'fail' } }));
});

test('검색에 내보낼 게임 판정 (isIndexed)', () => {
  const live = (src) => ({ code: 'L1', reward: 'r', expireDate: '상시', src });
  const base = { redeemHow: '설정 > 쿠폰', platforms: ['pc'] };
  const media = { ...base, id: 'blackdesert', coupons: [live(['https://www.pockettactics.com/x'])] };
  const official = { ...base, id: 'blackdesert', coupons: [live(['https://kr.playblackdesert.com/ko-KR/News'])] };
  const roblox = { ...base, id: 'roblox-zz', platforms: ['roblox'], coupons: [live(['https://www.roblox.com/games/1/x'])] };
  const before = '2026-10-27', after = '2026-11-10';
  assert.equal(OFFICIAL_INDEX_FROM, '2026-11-10');
  // 판정 시작 전에는 목록 규칙만 따른다
  assert.ok(isIndexed(media, activeOf, { todayKst: before }));
  // 시작 뒤에는 공식 출처나 직접 확인이 있어야 한다
  assert.ok(!isIndexed(media, activeOf, { todayKst: after }));
  assert.ok(isIndexed(official, activeOf, { todayKst: after }));
  assert.ok(isIndexed(media, activeOf, { todayKst: after, tested: { 'blackdesert:L1': { date: '2026-11-01', result: 'ok' } } }));
  // 로블록스는 보류 중이면 날짜와 상관없이 noindex
  assert.equal(HOLD_ROBLOX, true);
  assert.ok(!isIndexed(roblox, activeOf, { todayKst: before }));
  // 운영자가 하는 게임은 목록에 보이면 내보낸다
  for (const id of OPERATOR_GAMES) {
    assert.ok(catalog.some(g => g.id === id), `${id}: 카탈로그에 없는 운영자 게임`);
    assert.ok(isIndexed({ ...base, id, coupons: [live(['https://www.pockettactics.com/x'])] }, activeOf, { todayKst: after }), id);
  }
  // 목록에 없는 게임은 내보내지 않는다
  assert.ok(!isIndexed({ ...base, id: 'zz-none', coupons: [] }, activeOf, { todayKst: before }));
});

test('검색에서 잠시 뺀 글: 파일이 있고, noindex 가 붙고, 사이트맵·최근 글·llms.txt·블로그 목록에서 빠진다', () => {
  const j = JSON.parse(read('data/blog-hold.json'));
  assert.equal(new Set(j.posts).size, j.posts.length, '같은 글이 두 번');
  assert.ok(BLOG_HOLD.size > 0);
  const sitemap = read('sitemap.xml'), llms = read('llms.txt'), posts = read('assets/posts.json'), idx = read('blog/index.html');
  for (const slug of BLOG_HOLD) {
    const file = `blog/${slug}.html`;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} 가 없음`);
    assert.match(read(file), /<meta name="robots" content="noindex" data-hold>/, `${file} 에 noindex 가 없음 (prerender 를 돌리세요)`);
    for (const [name, out] of [['sitemap.xml', sitemap], ['llms.txt', llms], ['assets/posts.json', posts]]) assert.ok(!out.includes(`/blog/${slug}.html`), `${name} 에 ${slug} 가 있음`);
    assert.match(idx, new RegExp(`<a href="/blog/${slug}\\.html" data-hold style="display:none !important" class="post-card`), `블로그 목록에서 ${slug} 카드가 숨지 않음`);
  }
  // 목록에 없는 글에는 보류 표시가 남아 있지 않다
  for (const f of fs.readdirSync(path.join(ROOT, 'blog')).filter(f => f.endsWith('.html') && f !== 'index.html')) {
    if (BLOG_HOLD.has(f.replace(/\.html$/, ''))) continue;
    assert.doesNotMatch(read('blog/' + f), /data-hold/, `${f} 에 보류 표시가 남아 있음`);
  }
});
