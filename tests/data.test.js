// 카탈로그 데이터와 빌드 결과물 점검. 쿠폰 자동 갱신 루틴이 데이터를 고친 뒤 깨진 곳이 없는지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const mono = require('../scripts/mono');
const { codeAnchor } = require('../scripts/game-pages');

const page = loadPage();
const { initialGameCatalog: catalog, SHOP_CATS, SHOP_CATALOGS, COUPON_FIRST_SEEN } = page.state();
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

test('한 게임 안에서 같은 코드가 두 번 나오지 않는다', () => {
  for (const g of catalog) {
    const codes = g.coupons.map(c => c.code.toUpperCase());
    const dup = codes.find((c, i) => codes.indexOf(c) !== i);
    assert.equal(dup, undefined, `${g.id}: ${dup} 중복`);
  }
});

test('쇼핑몰 id 는 분야 안에서 겹치지 않고 주소가 https 다', () => {
  for (const cat of SHOP_CATS) {
    const ids = new Set();
    for (const m of SHOP_CATALOGS[cat]) {
      assert.ok(!ids.has(m.id), `${cat}/${m.id} 중복`);
      ids.add(m.id);
      assert.match(m.url, /^https:\/\//, `${cat}/${m.id}: url '${m.url}'`);
    }
  }
});

test('쿠폰 등록일 장부 날짜가 올바르다', () => {
  for (const [k, d] of Object.entries(COUPON_FIRST_SEEN)) assert.ok(realDate(d), `${k}: '${d}'`);
});

test('글자 타일 규칙이 화면(index.html)과 빌드(scripts/mono.js)에서 같다', () => {
  const names = [...catalog.map(g => g.title), ...SHOP_CATS.flatMap(c => SHOP_CATALOGS[c].map(m => m.name)), '', '7DS', '2XKO'];
  for (const n of names) assert.deepEqual(page.fn.monoOf(n), mono.monoOf(n), `'${n}'`);
});

test('코드 앵커 규칙이 화면과 빌드에서 같다', () => {
  const codes = [...catalog.flatMap(g => g.coupons.map(c => c.code)), '한글코드!', 'A-B_c'];
  for (const c of codes) assert.equal(page.fn.codeAnchor(c), codeAnchor(c), `'${c}'`);
});

test('홈 HTML 에 미리 그린 목록이 들어 있다 (prerender 를 돌렸는지)', () => {
  const html = page.html;
  const markers = [...html.matchAll(/<!--PRERENDER:([a-z]+)-->/g)].map(m => m[1]);
  // mega·쇼핑 6분야는 일부러 브라우저에서만 그린다(prerender.js CLIENT_ONLY)
  for (const name of ['game', 'herostats', 'tiles', 'itemlist']) {
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
