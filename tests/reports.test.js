// "이 코드 안 돼요" 신고 (2026-10-19 만들고, 같은 날 규칙 게시 후 켬). 스위치는 scripts/reports.js 의 REPORTS_ENABLED 한 곳.
//   화면: 게임 페이지 코드 표 · 홈 쿠폰 창의 "안 돼요" 버튼 (꺼져 있으면 아무것도 안 그린다)
//   보내기: assets/ecm-report.js → 파이어스토어 reports/{id} = { game, code, reason, ts(서버 시각) }
//   모으기: scripts/reports-digest.js (.github/workflows/reports-digest.yml) → data/report-digest.json
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadPage, ROOT } = require('./page');
const { REPORTS_ENABLED, REPORT_REASONS, LIMITS } = require('../scripts/reports');
const { reportButtonHtml, writeGamePages } = require('../scripts/game-pages');
const client = require('../assets/ecm-report');
const { aggregateReports, parseReportDoc } = require('../scripts/reports-digest');

const page = loadPage();
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('신고 스위치는 2026-10-19부터 켜져 있고, index.html 의 값이 scripts/reports.js 와 같다 (prerender 를 돌렸는지)', () => {
  assert.equal(REPORTS_ENABLED, true, '2026-10-19 파이어스토어 규칙 게시 후 켬 (docs/firestore-reports-rules.txt)');
  assert.equal(page.state().REPORTS_ENABLED, REPORTS_ENABLED);
  // 스위치는 한 곳에만: 다른 파일에서 값을 따로 정하지 않는다
  for (const f of ['index.html', 'scripts/game-pages.js', 'scripts/reports-digest.js', 'assets/ecm-report.js']) {
    const src = read(f).replace(/\/\*PRERENDER:reports\*\/[\s\S]*?\/\*\/PRERENDER:reports\*\//, '');
    assert.doesNotMatch(src, /REPORTS_ENABLED\s*=\s*(true|false)/, `${f}: REPORTS_ENABLED 를 따로 정함`);
  }
});

test('신고 버튼 규칙이 화면(index.html)과 빌드(scripts/game-pages.js)에서 같고, 꺼져 있으면 빈 문자열', () => {
  const samples = [['genshin', 'ABC123'], ['roblox-king-legacy', '<3LEEPUNGG'], ['roblox-99-nights-in-the-forest', 'yay fishing'], ['x', 'a"b']];
  for (const [g, c] of samples) {
    for (const on of [true, false]) assert.equal(page.fn.reportButtonHtml(g, c, on), reportButtonHtml(g, c, on), `${g} ${c} ${on}`);
    assert.equal(reportButtonHtml(g, c, false), '', '꺼져 있으면 아무것도 안 그림');
    assert.equal(page.fn.reportButtonHtml(g, c, false), '');
    assert.equal(reportButtonHtml(g, c), reportButtonHtml(g, c, REPORTS_ENABLED), '기본값은 scripts/reports.js 의 스위치를 따른다');
  }
  const on = reportButtonHtml('roblox-king-legacy', '<3LEEPUNGG', true);
  assert.match(on, /data-report-game="roblox-king-legacy" data-report-code="&lt;3LEEPUNGG"/);
  assert.match(on, />안 돼요<\/button>/);
  assert.match(page.html, /\$\{reportButtonHtml\(game\.id, c\.code\)\}/, '홈 쿠폰 창이 같은 함수를 쓰지 않음');
});

test('꺼져 있는 동안 사이트 페이지에 신고 버튼·스크립트가 없다', { skip: REPORTS_ENABLED && '신고가 켜져 있음' }, () => {
  const pages = fs.readdirSync(path.join(ROOT, 'game')).filter(f => f.endsWith('.html')).map(f => 'game/' + f);
  for (const p of [...pages, 'index.html', 'today/index.html']) {
    const html = read(p).replace(/<script>[\s\S]*?<\/script>/g, '');
    assert.doesNotMatch(html, /data-report-code|ecm-report\.js/, p);
  }
});

test('켜면(가짜 게임으로 시험) 살아 있는 코드마다 버튼이 생기고 신고 스크립트를 불러온다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecm-report-'));
  try {
    const games = [{ id: 'zz-rep', title: '신고 시험', publisher: 't', category: 'RPG', genre: 'rpg', platforms: ['pc'], redeemHow: '설정 > 쿠폰',
      coupons: [{ code: 'A1', reward: 'r', expireDate: '상시' }, { code: 'B2', reward: 'r', expireDate: '상시' }] }];
    writeGamePages(tmp, games, [], '2026-10-19', {}, {}, {}, {}, { reportsEnabled: true });
    const on = fs.readFileSync(path.join(tmp, 'game', 'zz-rep.html'), 'utf8');
    assert.equal((on.match(/data-report-code=/g) || []).length, 2);
    assert.match(on, /<script src="\/assets\/ecm-report\.js" defer><\/script>/);
    writeGamePages(tmp, games, [], '2026-10-19', {}, {}, {}, {}, { reportsEnabled: false });
    const off = fs.readFileSync(path.join(tmp, 'game', 'zz-rep.html'), 'utf8');
    assert.doesNotMatch(off, /data-report-code|ecm-report\.js/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('보내는 쪽: 이유·길이 제한이 scripts/reports.js 와 같다', () => {
  assert.deepEqual(client.REASONS, REPORT_REASONS);
  assert.deepEqual(client.LIMITS, LIMITS);
});

test('보내는 쪽: 새 문서 하나, 필드는 game·code·reason 과 서버 시각 ts 뿐', () => {
  const id = client.randomId();
  assert.match(id, /^[A-Za-z0-9]{20}$/);
  const body = client.reportPayload('ecm-coupon', id, 'genshin', 'VesnaOnPatrol', 'expired');
  assert.equal(body.writes.length, 1);
  const w = body.writes[0];
  assert.equal(w.update.name, `projects/ecm-coupon/databases/(default)/documents/reports/${id}`);
  assert.deepEqual(w.update.fields, { game: { stringValue: 'genshin' }, code: { stringValue: 'VesnaOnPatrol' }, reason: { stringValue: 'expired' } });
  assert.deepEqual(w.updateTransforms, [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }]);
  assert.deepEqual(w.currentDocument, { exists: false });
  assert.deepEqual(Object.keys(w).sort(), ['currentDocument', 'update', 'updateTransforms']);
  assert.equal(client.commitUrl({ projectId: 'ecm-coupon', apiKey: 'K' }), 'https://firestore.googleapis.com/v1/projects/ecm-coupon/databases/(default)/documents:commit?key=K');
  // 규칙에 안 맞는 값은 보내지 않는다
  assert.equal(client.reportPayload('ecm-coupon', id, 'genshin', 'X', 'spam'), null);
  assert.equal(client.reportPayload('ecm-coupon', id, 'Genshin!', 'X', 'other'), null);
  assert.equal(client.reportPayload('ecm-coupon', id, 'g'.repeat(61), 'X', 'other'), null);
  assert.equal(client.reportPayload('ecm-coupon', id, 'genshin', '', 'other'), null);
  assert.equal(client.reportPayload('ecm-coupon', id, 'genshin', 'c'.repeat(81), 'other'), null);
  assert.equal(client.reportPayload('ecm-coupon', 'bad/id', 'genshin', 'X', 'other'), null);
  assert.ok(client.reportPayload('ecm-coupon', id, 'roblox-99-nights-in-the-forest', 'yay fishing', 'invalid'));
  // 한 기기 한 번: 저장 키
  assert.equal(client.reportKey('genshin', 'ABC'), 'genshin:ABC');
});

test('파이어스토어 규칙 제안: reports 는 정해진 네 필드로 만들기만, 읽기·고치기·지우기 금지, subscribers 는 건드리지 않음', () => {
  const rules = read('docs/firestore-reports-rules.txt');
  assert.match(rules, /match \/reports\/\{id\}/);
  assert.match(rules, /keys\(\)\.hasOnly\(\['game', 'code', 'reason', 'ts'\]\)/);
  assert.match(rules, /keys\(\)\.hasAll\(\['game', 'code', 'reason', 'ts'\]\)/);
  const list = rules.match(/reason in \[([^\]]+)\]/)[1].split(',').map(s => s.trim().replace(/'/g, ''));
  assert.deepEqual(list, Object.keys(REPORT_REASONS));
  assert.match(rules, new RegExp(`game\\.size\\(\\) <= ${LIMITS.game}\\b`));
  assert.match(rules, new RegExp(`code\\.size\\(\\) <= ${LIMITS.code}\\b`));
  assert.match(rules, /ts == request\.time/);
  assert.match(rules, /allow read, update, delete: if false;/);
  assert.doesNotMatch(rules.replace(/\/\/.*$/gm, ''), /match \/subscribers/, 'subscribers 규칙을 짐작으로 적지 않는다(콘솔의 것을 그대로 둔다)');
  assert.match(rules, /subscribers/, '기존 subscribers 블록을 남기라는 안내가 있어야 함');
  assert.doesNotMatch(rules, /AIza|private_key|BEGIN PRIVATE/, '비밀값 없음');
});

test('매일 모음: 최근 14일 신고만 코드별로 세고, 이유는 정해진 것만, 마지막 날은 한국 날짜', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const reports = [
    { game: 'genshin', code: 'ABC', reason: 'expired', ts: '2026-10-19T16:30:00Z' },  // 한국 10-20 01:30
    { game: 'genshin', code: 'ABC', reason: 'expired', ts: '2026-10-18T03:00:00Z' },
    { game: 'genshin', code: 'ABC', reason: 'invalid', ts: '2026-10-10T03:00:00Z' },
    { game: 'genshin', code: 'abc', reason: 'other', ts: '2026-10-15T03:00:00Z' },     // 대소문자 다르면 다른 코드
    { game: 'zzz', code: 'OLD', reason: 'expired', ts: '2026-10-01T00:00:00Z' },        // 14일 전보다 앞 → 뺀다
    { game: 'zzz', code: 'BAD', reason: 'spam', ts: '2026-10-19T00:00:00Z' },           // 모르는 이유 → 뺀다
    { game: 'zzz', code: 'NOTS', reason: 'other', ts: 'not-a-date' },
    null,
  ];
  const d = aggregateReports(reports, { now });
  assert.deepEqual(d, {
    'genshin:ABC': { count: 3, reasons: { expired: 2, invalid: 1 }, last: '2026-10-20' },
    'genshin:abc': { count: 1, reasons: { other: 1 }, last: '2026-10-15' },
  });
  assert.deepEqual(Object.keys(d), Object.keys(d).slice().sort());
  assert.deepEqual(aggregateReports([], { now }), {});
  // 파이어스토어 REST 문서 읽기
  assert.deepEqual(parseReportDoc({ fields: { game: { stringValue: 'genshin' }, code: { stringValue: 'ABC' }, reason: { stringValue: 'expired' }, ts: { timestampValue: '2026-10-19T16:30:00.123456Z' } } }),
    { game: 'genshin', code: 'ABC', reason: 'expired', ts: '2026-10-19T16:30:00.123456Z' });
  assert.equal(parseReportDoc({ fields: { game: { stringValue: 'genshin' } } }), null);
  assert.equal(parseReportDoc(undefined), null);
});

test('매일 모음: 꺼져 있으면 비밀값이 있어도 아무 파일도 쓰지 않고 조용히 끝난다', { skip: REPORTS_ENABLED && '신고가 켜져 있음' }, () => {
  const out = path.join(ROOT, 'data', 'report-digest.json');
  const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  const log = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'reports-digest.js')], {
    env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: '{"project_id":"x","client_email":"x","private_key":"x"}' }, encoding: 'utf8',
  });
  assert.match(log, /건너뜀/);
  assert.equal(fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null, before);
});

test('매일 모음 워크플로: 07:20 KST · 손으로 실행 · 같은 비밀값 · 바뀐 경우만 [skip ci] 커밋 · pull --rebase 뒤 push', () => {
  const y = read('.github/workflows/reports-digest.yml');
  assert.match(y, /cron: '20 22 \* \* \*'/);
  assert.match(y, /workflow_dispatch:/);
  assert.match(y, /FIREBASE_SERVICE_ACCOUNT: \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT \}\}/);
  assert.match(y, /node scripts\/reports-digest\.js/);
  assert.match(y, /git status --porcelain data\/report-digest\.json/);
  assert.match(y, /\[skip ci\]/);
  assert.ok(y.indexOf('git pull --rebase origin main') < y.indexOf('git push origin HEAD:main'));
});

test('신고 모음: 카탈로그에 없는 게임·코드 신고(시험·장난)는 세지 않는다', () => {
  const { aggregateReports } = require('../scripts/reports-digest');
  const now = new Date('2026-10-19T12:00:00Z');
  const ts = '2026-10-19T03:00:00Z';
  const known = new Set(['genshin:REALCODE']);
  const out = aggregateReports([
    { game: 'genshin', code: 'REALCODE', reason: 'expired', ts },
    { game: 'ecm-selftest', code: 'SELFTEST', reason: 'other', ts },
  ], { now, known });
  assert.deepEqual(Object.keys(out), ['genshin:REALCODE']);
});

test('켜져 있으면 살아 있는 코드가 있는 게임 페이지에 신고 버튼이 있다', { skip: !REPORTS_ENABLED && '신고가 꺼져 있음' }, () => {
  const pages = fs.readdirSync(path.join(ROOT, 'game')).filter(f => f.endsWith('.html')).map(f => 'game/' + f);
  const withButtons = pages.filter(p => /data-report-code=/.test(read(p)));
  assert.ok(withButtons.length > 0, '신고 버튼이 있는 게임 페이지가 하나도 없음');
});
