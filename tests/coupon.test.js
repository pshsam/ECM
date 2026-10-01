// 쿠폰 만료 판정: 화면(index.html evaluateCoupon)과 빌드(scripts/game-pages.js evaluate)가 같은 답을 내야 한다.
// 둘이 어긋나면 홈에서는 살아 있는데 게임 페이지·오늘의 쿠폰·텔레그램에서는 만료로 보이는 식의 사고가 난다.
process.env.TZ = 'Asia/Seoul'; // 방문자 대부분이 한국 시간. 클라우드(UTC)에서 돌려도 같은 결과가 나오게 고정한다
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./page');
const { evaluate } = require('../scripts/game-pages');

const page = loadPage();
const { evaluateCoupon } = page.fn;
const { initialGameCatalog } = page.state();

// 한국 시간으로 2026-10-02 0시 (UTC로는 10-01 15시) — 날짜가 바뀌는 경계
const KST_MIDNIGHT = Date.UTC(2026, 9, 1, 15, 0, 0);
const at = (ms, fn) => {
  test.mock.timers.enable({ apis: ['Date'], now: ms });
  try { return fn(); } finally { test.mock.timers.reset(); }
};

const CASES = [
  // [설명, 쿠폰, 살아 있음?, 표시 문구]
  ['상시', { expireDate: '상시' }, true, '상시'],
  ['9999년', { expireDate: '9999-12-31' }, true, '상시'],
  ['오늘 마감', { expireDate: '2026-10-02' }, true, '오늘 마감'],
  ['어제 만료', { expireDate: '2026-10-01' }, false, '1일 전 만료'],
  ['사흘 남음', { expireDate: '2026-10-05' }, true, 'D-3'],
  ['만료일 없음', {}, true, '만료일 미공개'],
  ['만료일 없음 + 재확인 기한 남음', { recheckBy: '2026-10-10' }, true, '만료일 미공개'],
  ['만료일 없음 + 재확인 기한 오늘', { recheckBy: '2026-10-02' }, true, '만료일 미공개'],
  ['만료일 없음 + 재확인 기한 지남', { recheckBy: '2026-10-01' }, false, '재확인 필요'],
  ['공식 만료일이 재확인 기한보다 우선', { expireDate: '2026-12-31', recheckBy: '2026-09-01' }, true, 'D-90'],
];

for (const [name, c, active, text] of CASES) {
  test(`판정: ${name}`, () => at(KST_MIDNIGHT, () => {
    const b = evaluate(c);
    assert.equal(b.active, active, '빌드 판정');
    assert.equal(b.text, text, '빌드 문구');
    const s = evaluateCoupon(c);
    assert.equal(s.status === 'active', active, '화면 판정');
    assert.equal(s.ddayText, text, '화면 문구');
  }));
}

test('90일 넘게 지난 쿠폰은 목록에서 지운다', () => at(KST_MIDNIGHT, () => {
  assert.equal(evaluateCoupon({ expireDate: '2026-07-03' }).isPurge, true);
  assert.equal(evaluateCoupon({ expireDate: '2026-07-04' }).isPurge, false);
  assert.equal(evaluateCoupon({ recheckBy: '2026-07-01' }).isPurge, true);
}));

test('실제 카탈로그의 모든 쿠폰에서 화면과 빌드 판정이 같다 (자정 앞뒤·아침)', () => {
  const coupons = initialGameCatalog.flatMap(g => (g.coupons || []).map(c => [g.id, c]));
  assert.ok(coupons.length > 0);
  const now = Date.now();
  const kstToday = Date.UTC(...(d => [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()])(new Date(now + 9 * 3600e3))) - 9 * 3600e3;
  const moments = [kstToday - 60e3, kstToday + 60e3, kstToday + 8.5 * 3600e3, kstToday + 23.9 * 3600e3];
  for (const t of moments) {
    at(t, () => {
      for (const [id, c] of coupons) {
        const b = evaluate(c), s = evaluateCoupon(c);
        assert.equal(s.status === 'active', b.active, `${id} ${c.code}: 화면 ${s.status} / 빌드 ${b.active} (${new Date(t).toISOString()})`);
        assert.equal(s.ddayText, b.text, `${id} ${c.code}: 문구가 다름`);
      }
    });
  }
});
