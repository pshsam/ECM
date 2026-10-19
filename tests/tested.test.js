// 직접 입력해 봤어요 (2026-10-19~). 운영자가 게임에서 직접 넣어 본 코드만 data/tested.json 에 적는다.
//   "게임id:코드" → { date: YYYY-MM-DD, result: ok | fail, note?: 짧은 메모, img?: /assets/tested/<파일> }
// 뱃지는 게임 페이지 코드 표 · 홈 쿠폰 창 · 오늘의 쿠폰에 같은 함수(testedBadgeHtml)로 나온다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const { testedBadgeHtml, TESTED, writeGamePages, evaluate, couponSourceHtml, headerHtml, footerHtml } = require('../scripts/game-pages');
const { writeTodayPage } = require('../scripts/today-page');

const page = loadPage();
const { TESTED_CODES } = page.state();
const FILE = path.join(ROOT, 'data', 'tested.json');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const kstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

test('data/tested.json 형식: 운영자가 넣어 본 날·결과만, 캡처는 assets/tested/ 안의 실제 파일', () => {
  const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.ok(j && typeof j === 'object' && !Array.isArray(j), '객체여야 함');
  for (const [k, v] of Object.entries(j)) {
    assert.match(k, /^[a-z0-9_-]+:.+$/, `키 '${k}' (게임id:코드)`);
    for (const f of Object.keys(v)) assert.ok(['date', 'result', 'note', 'img'].includes(f), `${k}: 모르는 필드 ${f}`);
    assert.ok(DATE.test(v.date) && new Date(v.date).toISOString().slice(0, 10) === v.date, `${k}: date '${v.date}'`);
    assert.ok(v.date <= kstToday, `${k}: date ${v.date} 가 오늘보다 뒤`);
    assert.ok(v.result === 'ok' || v.result === 'fail', `${k}: result 는 ok 또는 fail`);
    if (v.note !== undefined) assert.ok(typeof v.note === 'string' && v.note.trim() && v.note.length <= 60, `${k}: note 는 60자 안의 짧은 문구`);
    if (v.img !== undefined) {
      assert.match(v.img, /^\/assets\/tested\/[A-Za-z0-9._-]+\.(webp|png|jpe?g)$/, `${k}: img '${v.img}'`);
      assert.ok(fs.existsSync(path.join(ROOT, v.img)), `${k}: ${v.img} 파일이 없음`);
    }
  }
});

test('index.html 의 TESTED_CODES 가 data/tested.json 과 같다 (prerender 를 돌렸는지)', () => {
  assert.deepEqual(TESTED_CODES, JSON.parse(fs.readFileSync(FILE, 'utf8')));
  assert.deepEqual(TESTED, TESTED_CODES);
});

const SAMPLES = [
  undefined, null, {}, 'ok',
  { date: '2026-10-19', result: 'ok' },
  { date: '2026-10-19', result: 'fail' },
  { date: '2026-10-19', result: 'ok', note: '우편함으로 바로 왔어요', img: '/assets/tested/genshin-abc.webp' },
  { date: '2026-10-19', result: 'fail', note: '<b>이미 만료</b>', img: 'https://evil.example/x.webp' },
  { date: '2026-10-19', result: 'ok', img: '/assets/tested/../../x.webp' },
  { date: '2026-10-19', result: 'maybe' },
  { date: '2026/10/19', result: 'ok' },
  { result: 'ok' },
];

test('뱃지 규칙이 화면(index.html)과 빌드(scripts/game-pages.js)에서 같다', () => {
  for (const t of SAMPLES) assert.equal(page.fn.testedBadgeHtml(t), testedBadgeHtml(t), JSON.stringify(t));
});

test('뱃지: 성공·실패 글자와 날짜, 캡처가 있으면 새 탭 링크, 값이 틀리면 아무것도 찍지 않는다', () => {
  const ok = testedBadgeHtml({ date: '2026-10-19', result: 'ok' });
  assert.match(ok, /직접 입력해 봤어요 · 2026\.10\.19/);
  assert.doesNotMatch(ok, /<a /);
  const fail = testedBadgeHtml({ date: '2026-10-18', result: 'fail', note: '이미 만료' });
  assert.match(fail, /직접 넣어 보니 안 됐어요 · 2026\.10\.18/);
  assert.match(fail, /class="ecm-tested-note">이미 만료</);
  const shot = testedBadgeHtml({ date: '2026-10-19', result: 'ok', img: '/assets/tested/a.webp' });
  assert.match(shot, /<a class="ecm-tested is-ok" href="\/assets\/tested\/a\.webp" target="_blank" rel="noopener">/);
  // /assets/tested/ 밖의 주소는 링크로 만들지 않는다
  assert.doesNotMatch(testedBadgeHtml({ date: '2026-10-19', result: 'ok', img: 'https://evil.example/x.webp' }), /href=/);
  assert.doesNotMatch(testedBadgeHtml({ date: '2026-10-19', result: 'ok', img: '/assets/tested/../../x.webp' }), /href=/);
  assert.doesNotMatch(testedBadgeHtml({ date: '2026-10-19', result: 'fail', note: '<img src=x>' }), /<img/);
  for (const t of [undefined, null, {}, { result: 'ok' }, { date: '2026-10-19', result: 'maybe' }, { date: '2026/10/19', result: 'ok' }]) {
    assert.equal(testedBadgeHtml(t), '', JSON.stringify(t));
  }
});

test('홈 쿠폰 창이 같은 뱃지 함수와 장부를 쓴다', () => {
  assert.match(page.html, /\$\{testedBadgeHtml\(TESTED_CODES\[game\.id \+ ':' \+ c\.code\]\)\}/);
});

// 가짜 게임·장부로 게임 페이지와 오늘의 쿠폰을 따로 만들어 본다 (실제 장부는 건드리지 않는다)
function buildFixture(tested) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecm-tested-'));
  const games = [{
    id: 'zz-tested', title: '테스트 게임', publisher: '테스트', category: 'RPG', genre: 'rpg', platforms: ['mobile'], redeemHow: '설정 > 쿠폰',
    coupons: [
      { code: 'WORKS1', reward: '보석 100개', expireDate: '상시' },
      { code: 'NOPE2', reward: '골드', expireDate: '상시' },
      { code: 'PLAIN3', reward: '상자', expireDate: '상시' },
    ],
  }];
  try {
    writeGamePages(tmp, games, [], '2026-10-19', {}, {}, {}, tested);
    writeTodayPage(tmp, { games, firstSeen: {}, gamePageIds: ['zz-tested'], evaluate, couponSourceHtml, tested, testedBadgeHtml, headerHtml, footerHtml, version: '2026-10-19' });
    return {
      game: fs.readFileSync(path.join(tmp, 'game', 'zz-tested.html'), 'utf8'),
      today: fs.readFileSync(path.join(tmp, 'today', 'index.html'), 'utf8'),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('장부에 있는 코드만 게임 페이지·오늘의 쿠폰에 뱃지가 붙는다', () => {
  const { game, today } = buildFixture({
    'zz-tested:WORKS1': { date: '2026-10-19', result: 'ok', img: '/assets/tested/zz.webp' },
    'zz-tested:NOPE2': { date: '2026-10-18', result: 'fail' },
  });
  const row = code => (game.match(new RegExp(`<tr id="code-${code}"[\\s\\S]*?</tr>`)) || [''])[0];
  assert.match(row('WORKS1'), /직접 입력해 봤어요 · 2026\.10\.19/);
  assert.match(row('WORKS1'), /href="\/assets\/tested\/zz\.webp"/);
  assert.match(row('NOPE2'), /직접 넣어 보니 안 됐어요 · 2026\.10\.18/);
  assert.doesNotMatch(row('PLAIN3'), /ecm-tested/);
  assert.match(game, /표시가 있는 코드는 운영자가 게임에서 직접 넣어 본 코드/);
  // 오늘의 쿠폰: 미리 그린 HTML 과 브라우저가 다시 그릴 JSON 둘 다
  assert.match(today, /직접 입력해 봤어요 · 2026\.10\.19/);
  const data = JSON.parse(today.match(/<script type="application\/json" id="todayData">([\s\S]*?)<\/script>/)[1]);
  const by = Object.fromEntries(data.items.map(x => [x.c, x]));
  assert.match(by.WORKS1.b, /직접 입력해 봤어요/);
  assert.equal(by.PLAIN3.b, '');
});

test('장부가 비어 있으면 뱃지도 안내 문장도 나오지 않는다', () => {
  const { game, today } = buildFixture({});
  const body = s => s.replace(/<style>[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(body(game), /ecm-tested|직접 입력해 봤어요/);
  assert.doesNotMatch(body(today), /ecm-tested|직접 입력해 봤어요/);
  assert.match(game, /ECM이 모든 코드를 직접 입력해 보는 것은 아니어서/);
});
