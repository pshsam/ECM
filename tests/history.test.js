// 지난 코드 기록·코드가 나온 흐름 (게임 페이지, 2026-10-15~). 근거는 ECM 장부뿐이다:
//   data/coupon-seen.json (코드 첫 등록일), data/coupon-history.json (보상·공식 만료일·목록에서 내린 날)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const { historyFor, flowFor, evaluate, KEEP_LISTED_WITHOUT_CODES } = require('../scripts/game-pages');

const page = loadPage();
const { initialGameCatalog: catalog } = page.state();
const seen = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coupon-seen.json'), 'utf8'));
const LEDGER_FILE = path.join(ROOT, 'data', 'coupon-history.json');
const ledger = fs.existsSync(LEDGER_FILE) ? JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')) : {};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const kstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

test('지난 코드 장부(data/coupon-history.json) 형식: "게임id:코드" → { reward?, expireDate?, removed? }', () => {
  assert.ok(fs.existsSync(LEDGER_FILE), 'prerender 를 돌려 장부를 만드세요');
  for (const [k, v] of Object.entries(ledger)) {
    assert.match(k, /^[a-z0-9_-]+:.+$/, `키 '${k}'`);
    assert.ok(v && typeof v === 'object' && !Array.isArray(v), `${k}: 객체가 아님`);
    for (const f of Object.keys(v)) assert.ok(['reward', 'expireDate', 'removed'].includes(f), `${k}: 모르는 필드 ${f}`);
    if (v.reward !== undefined) assert.ok(typeof v.reward === 'string' && v.reward.trim(), `${k}: reward`);
    if (v.expireDate !== undefined) assert.ok(v.expireDate === '상시' || DATE.test(v.expireDate), `${k}: expireDate '${v.expireDate}'`);
    if (v.removed !== undefined) assert.ok(DATE.test(v.removed) && v.removed <= kstToday, `${k}: removed '${v.removed}'`);
  }
});

test('지금 카탈로그에 있는 코드는 장부에 보상이 그대로 있고 removed 가 없다', () => {
  for (const g of catalog) {
    for (const c of g.coupons) {
      const v = ledger[g.id + ':' + c.code];
      assert.ok(v, `${g.id}:${c.code} 가 장부에 없음 (prerender 를 돌리세요)`);
      assert.equal(v.removed, undefined, `${g.id}:${c.code}: 카탈로그에 있는데 removed 가 있음`);
    }
  }
});

test('지난 코드 기록: 끝난 코드만, 글자 그대로, 사이트 연 날 예시 데이터는 빼고, 끝난 날은 장부 기준', () => {
  const g = { id: 'zz', coupons: [{ code: 'LIVE1', reward: 'r', expireDate: '상시' }] };
  const fs0 = {
    'zz:LIVE1': '2026-10-01',
    'zz:SEED1': '2026-09-21',       // 사이트 연 날 첫 커밋에만 있던 예시 → 빼야 함
    'zz:AbCd': '2026-10-03',        // 대소문자 그대로
    'zz:EXP1': '2026-10-05',
    'zz:GONE1': '2026-10-09',
    'zz:NOREC': '2026-10-10',
    'zzz:OTHER': '2026-10-10',      // 다른 게임(id 가 앞부분만 같은) → 빼야 함
    'game:zz': '2026-09-24',
  };
  const led = {
    'zz:AbCd': { reward: '보석 10개', removed: '2026-10-08' },
    'zz:EXP1': { reward: '골드', expireDate: '2026-10-07', removed: '2026-10-08' },
    'zz:GONE1': { reward: '상자', expireDate: '2026-12-31', removed: '2026-10-11' },
  };
  const rows = historyFor(g, fs0, g.coupons, led);
  assert.deepEqual(rows.map(r => r.code), ['NOREC', 'GONE1', 'EXP1', 'AbCd']);
  const by = Object.fromEntries(rows.map(r => [r.code, r]));
  assert.equal(by.AbCd.reward, '보석 10개');
  assert.equal(by.AbCd.end, '2026.10.08 목록에서 내림');
  assert.equal(by.EXP1.end, '2026.10.07 만료');
  assert.equal(by.GONE1.end, '2026.10.11 목록에서 내림', '공식 만료일 전에 내렸으면 내린 날');
  assert.equal(by.NOREC.reward, '');
  assert.equal(by.NOREC.end, '');

  const f = flowFor(g, fs0, g.coupons);
  assert.equal(f.start, '2026-09-24');
  assert.equal(f.n, 5);
  assert.equal(f.last, '2026-10-10');
  assert.equal(f.days, 5);
  assert.equal(f.gap, Math.round(9 / 4));
});

test('코드가 나온 흐름: 기록이 없으면 0개, 날이 3번 미만이면 평균 간격을 내지 않는다', () => {
  const g = { id: 'yy', coupons: [] };
  assert.deepEqual(flowFor(g, { 'game:yy': '2026-09-21' }, []), { start: '2026-09-21', n: 0, last: '', days: 0, gap: null });
  const two = flowFor(g, { 'yy:A': '2026-10-01', 'yy:B': '2026-10-05' }, []);
  assert.equal(two.days, 2);
  assert.equal(two.gap, null);
});

test('게임 페이지의 지난 코드 기록에 사이트 연 날 예시 코드가 없다', () => {
  const seed = Object.keys(seen).filter(k => !k.startsWith('game:') && seen[k] <= '2026-09-21');
  for (const k of seed) {
    const id = k.slice(0, k.indexOf(':')), code = k.slice(k.indexOf(':') + 1);
    const g = catalog.find(x => x.id === id);
    if (!g || g.coupons.some(c => c.code === code)) continue; // 지금도 카탈로그에 있는 진짜 코드(상시 코드 등)는 괜찮다
    const file = path.join(ROOT, 'game', id + '.html');
    if (!fs.existsSync(file)) continue;
    assert.ok(!fs.readFileSync(file, 'utf8').includes(`>${code}</code>`), `${id}: 예시 코드 ${code} 가 페이지에 나옴`);
  }
});

test('코드가 없는 A 게임 페이지: 상태 한 줄·새 코드 알림이 있고, 지난 코드 기록은 기록이 있을 때만 나온다', () => {
  const activeOf = g => g.coupons.filter(c => evaluate(c).active);
  for (const id of KEEP_LISTED_WITHOUT_CODES) {
    const g = catalog.find(x => x.id === id);
    if (!g || activeOf(g).length) continue;
    const html = fs.readFileSync(path.join(ROOT, 'game', id + '.html'), 'utf8');
    assert.match(html, /지금 쓸 수 있는 코드가 없어요/, `${id}: 상태 줄 없음`);
    assert.match(html, /<h2 id="alertTitle">새 코드 알림<\/h2>/, `${id}: 새 코드 알림 없음`);
    assert.match(html, /href="https:\/\/t\.me\/ecmcoupon"/, `${id}: 텔레그램 링크 없음`);
    assert.match(html, new RegExp(`data-fav="${id}"`), `${id}: 내 게임에 담기 없음`);
    assert.doesNotMatch(html, /<meta name="robots" content="noindex">/, `${id}: A 게임인데 noindex`);
    const rows = historyFor(g, seen, g.coupons, ledger);
    if (rows.length) assert.match(html, /<h2 id="history">지난 코드 기록<\/h2>/, `${id}: 기록이 있는데 지난 코드 기록이 없음`);
    else assert.doesNotMatch(html, /id="history"/, `${id}: 기록이 없는데 빈 지난 코드 기록이 나옴`);
  }
});
