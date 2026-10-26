// 카탈로그 데이터와 빌드 결과물 점검. 쿠폰 자동 갱신 루틴이 데이터를 고친 뒤 깨진 곳이 없는지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const mono = require('../scripts/mono');
const { codeAnchor, couponSourceHtml } = require('../scripts/game-pages');

const page = loadPage();
const { initialGameCatalog: catalog, COUPON_FIRST_SEEN } = page.state();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = s => DATE.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

test('게임 id 는 겹치지 않고 주소에 쓸 수 있는 글자만 쓴다', () => {
  const seen = new Set();
  for (const g of catalog) {
    assert.match(g.id, /^[a-z0-9_-]+$/, `id '${g.id}'`);
    assert.ok(!seen.has(g.id), `id '${g.id}' 가 두 번 나옴`);
    seen.add(g.id);
  }
});

test('게임마다 이름·분류·플랫폼이 있다', () => {
  for (const g of catalog) {
    assert.ok(g.title && g.title.trim(), `${g.id}: title 없음`);
    assert.ok(g.category, `${g.id}: category 없음`);
    assert.ok(Array.isArray(g.platforms) && g.platforms.length, `${g.id}: platforms 없음`);
    assert.ok(Array.isArray(g.coupons), `${g.id}: coupons 가 배열이 아님`);
  }
});

test('쿠폰 날짜는 "상시" 또는 실제 있는 YYYY-MM-DD', () => {
  for (const g of catalog) {
    for (const c of g.coupons) {
      const where = `${g.id} ${c.code}`;
      assert.ok(typeof c.code === 'string' && c.code.trim() === c.code && c.code, `${where}: 코드가 비었거나 앞뒤 공백`);
      assert.ok(c.reward, `${where}: reward 없음`);
      if (c.expireDate !== undefined) assert.ok(c.expireDate === '상시' || realDate(c.expireDate), `${where}: expireDate '${c.expireDate}'`);
      if (c.recheckBy !== undefined) assert.ok(realDate(c.recheckBy), `${where}: recheckBy '${c.recheckBy}'`);
    }
  }
});

// 코드별 근거(2026-10-13~, 쿠폰 루틴이 채운다): src = 근거로 센 출처 글 주소 1~3개, verified = 출처로 확인한 한국 날짜, cond = 조건(선택)
test('쿠폰 출처·확인일은 형식이 맞고, 확인일은 미래가 아니다', () => {
  const kstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  for (const g of catalog) {
    for (const c of g.coupons) {
      const where = `${g.id} ${c.code}`;
      if (c.src !== undefined) {
        assert.ok(Array.isArray(c.src) && c.src.length >= 1 && c.src.length <= 3, `${where}: src 는 주소 1~3개 배열`);
        for (const u of c.src) assert.match(u, /^https:\/\/[^\s/]+\.[^\s/]+\/\S+/, `${where}: src '${u}' (글 단위 https 주소여야 함)`);
        assert.ok(!c.src.some(u => /google\.[a-z.]+\/search|bing\.com\/search|webcache/.test(u)), `${where}: 검색 결과·캐시 주소는 출처가 아님`);
      }
      if (c.verified !== undefined) {
        assert.ok(realDate(c.verified), `${where}: verified '${c.verified}'`);
        assert.ok(c.verified <= kstToday, `${where}: verified ${c.verified} 가 오늘(${kstToday})보다 뒤`);
        assert.ok(c.src !== undefined, `${where}: verified 가 있으면 src 도 있어야 함`);
      }
      if (c.cond !== undefined) assert.ok(typeof c.cond === 'string' && c.cond.trim() && c.cond.length <= 40, `${where}: cond 는 40자 안의 짧은 문구`);
    }
  }
});

test('한 게임 안에서 같은 코드가 두 번 나오지 않는다', () => {
  for (const g of catalog) {
    const codes = g.coupons.map(c => c.code.toUpperCase());
    const dup = codes.find((c, i) => codes.indexOf(c) !== i);
    assert.equal(dup, undefined, `${g.id}: ${dup} 중복`);
  }
});

test('쿠폰 등록일 장부 날짜가 올바르다', () => {
  for (const [k, d] of Object.entries(COUPON_FIRST_SEEN)) assert.ok(realDate(d), `${k}: '${d}'`);
});

test('글자 타일 규칙이 화면(index.html)과 빌드(scripts/mono.js)에서 같다', () => {
  const names = [...catalog.map(g => g.title), '', '7DS', '2XKO'];
  for (const n of names) assert.deepEqual(page.fn.monoOf(n), mono.monoOf(n), `'${n}'`);
});

test('코드 앵커 규칙이 화면과 빌드에서 같다', () => {
  const codes = [...catalog.flatMap(g => g.coupons.map(c => c.code)), '한글코드!', 'A-B_c'];
  for (const c of codes) assert.equal(page.fn.codeAnchor(c), codeAnchor(c), `'${c}'`);
});

test('코드별 확인일·출처 줄이 화면(index.html)과 빌드(scripts/game-pages.js)에서 같다', () => {
  const samples = [
    ...catalog.flatMap(g => g.coupons),
    {},
    { src: ['https://www.example.com/a', 'https://example.com/b', 'https://other.kr/news/1'], verified: '2026-10-13', cond: '신규 계정만' },
    { src: ['https://example.com/a?x=1&y="2"'] },
    { verified: '2026-10-13' },
    { cond: '<b>조건</b>' },
    { src: ['잘못된 주소'] },
  ];
  for (const c of samples) assert.equal(page.fn.couponSourceHtml(c), couponSourceHtml(c), JSON.stringify(c));
  // 게임 id 를 넘기면 공식 출처(data/official-sources.json)를 가른다: 카탈로그 코드 전부 + 공식 주소를 섞은 예시
  for (const g of catalog) for (const c of g.coupons) assert.equal(page.fn.couponSourceHtml(c, g.id), couponSourceHtml(c, g.id), `${g.id}:${c.code}`);
  const mixed = { src: ['https://www.pockettactics.com/x', 'https://kr.playblackdesert.com/ko-KR/News/Notice/Detail?boardNo=1'], verified: '2026-10-27' };
  assert.equal(page.fn.couponSourceHtml(mixed, 'blackdesert'), couponSourceHtml(mixed, 'blackdesert'));
});

test('확인일·출처 줄: 값이 없으면 아무것도 찍지 않고, 있으면 날짜·도메인·조건을 보여 준다', () => {
  assert.equal(couponSourceHtml({ code: 'X', reward: 'y' }), '');
  const html = couponSourceHtml({ src: ['https://www.pockettactics.com/wuthering-waves/codes', 'https://www.pcgamesn.com/wuthering-waves/codes'], verified: '2026-10-15', cond: '레벨 10 이상' });
  // 공식 출처가 없으면 "참고"로 매체 주소를 보여 준다
  assert.match(html, /확인 2026\.10\.15 · 참고 <a [^>]*>pockettactics\.com<\/a>, <a [^>]*>pcgamesn\.com<\/a>/);
  assert.match(html, /조건: 레벨 10 이상/);
  assert.match(html, /target="_blank" rel="noopener nofollow"/);
  assert.doesNotMatch(couponSourceHtml({ cond: '<img src=x>' }), /<img/);
});

test('게임 페이지 코드 표에 확인일·출처가 나온다 (src 가 있는 코드)', () => {
  const g = catalog.find(x => x.coupons.some(c => c.src && page.fn.evaluateCoupon(c).status === 'active'));
  if (!g) return; // 아직 출처가 붙은 살아 있는 코드가 없으면 건너뜀
  const file = path.join(ROOT, 'game', g.id + '.html');
  if (!fs.existsSync(file)) return;
  assert.match(fs.readFileSync(file, 'utf8'), /class="ecm-src"/, `${g.id}: prerender 후 게임 페이지에 출처 줄이 없음`);
});

test('홈 HTML 에 미리 그린 목록이 들어 있다 (prerender 를 돌렸는지)', () => {
  const html = page.html;
  const markers = [...html.matchAll(/<!--PRERENDER:([a-z]+)-->/g)].map(m => m[1]);
  // mega 는 일부러 브라우저에서만 그린다(prerender.js CLIENT_ONLY)
  for (const name of ['game', 'herostats', 'itemlist']) {
    assert.ok(markers.includes(name), `PRERENDER:${name} 마커 없음`);
    const m = html.match(new RegExp(`<!--PRERENDER:${name}-->([\\s\\S]*?)<!--/PRERENDER:${name}-->`));
    assert.ok(m && m[1].trim().length > 100, `PRERENDER:${name} 안이 비어 있음`);
  }
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok((visible.match(/활성 쿠폰/g) || []).length > 0, '검색엔진이 보는 HTML 에 쿠폰 있는 게임이 하나도 없음');
});

test('게임 페이지 링크가 가리키는 파일이 실제로 있다', () => {
  for (const m of page.grids.game.matchAll(/href="\/game\/([a-z0-9_-]+)\.html"/g)) {
    assert.ok(fs.existsSync(path.join(ROOT, 'game', m[1] + '.html')), `/game/${m[1]}.html 없음`);
  }
});
