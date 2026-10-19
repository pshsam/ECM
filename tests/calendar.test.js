// 쿠폰 마감 캘린더 구독 /calendar/ecm-expiring.ics (2026-10-19~, scripts/calendar.js)
//   공식 만료일(YYYY-MM-DD)이 있는 살아 있는 코드만 · RFC 5545 (CRLF, 75바이트 줄 접기, 이스케이프) · UID 는 늘 같다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const { evaluate } = require('../scripts/game-pages');
const { buildIcs, expiringEvents, foldLine, icsEscape, uidFor, writeCalendar, CAL_FILE, CAL_URL } = require('../scripts/calendar');

const page = loadPage();
const { initialGameCatalog: catalog } = page.state();

/** 접힌 줄을 펴서 [이름(매개변수 포함), 값] 목록으로 */
function unfold(ics) {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n').filter(Boolean).map(l => {
    const i = l.indexOf(':');
    return [l.slice(0, i), l.slice(i + 1)];
  });
}
function events(ics) {
  const out = [];
  let cur = null;
  for (const [k, v] of unfold(ics)) {
    if (k === 'BEGIN' && v === 'VEVENT') cur = {};
    else if (k === 'END' && v === 'VEVENT') { out.push(cur); cur = null; }
    else if (cur) cur[k] = v;
  }
  return out;
}
/** RFC 5545 형식 검사: CRLF 만, 한 줄 75바이트 이하, BEGIN/END 짝, 필수 속성 */
function assertValidIcs(ics) {
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'BEGIN:VCALENDAR 로 시작');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'), 'END:VCALENDAR + CRLF 로 끝');
  assert.doesNotMatch(ics, /[^\r]\n/, 'CR 없는 줄바꿈이 있음');
  assert.doesNotMatch(ics, /\r(?!\n)/, 'LF 없는 CR 이 있음');
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `75바이트 넘는 줄: ${line}`);
  const props = unfold(ics);
  for (const k of ['VERSION', 'PRODID']) assert.ok(props.some(([n]) => n === k), `${k} 없음`);
  assert.equal(props.filter(([k, v]) => k === 'BEGIN' && v === 'VEVENT').length, props.filter(([k, v]) => k === 'END' && v === 'VEVENT').length, 'VEVENT 짝이 안 맞음');
  for (const e of events(ics)) {
    for (const k of ['UID', 'DTSTAMP', 'DTSTART;VALUE=DATE', 'DTEND;VALUE=DATE', 'SUMMARY']) assert.ok(e[k], `일정에 ${k} 없음: ${JSON.stringify(e)}`);
    assert.match(e.DTSTAMP, /^\d{8}T\d{6}Z$/);
    assert.match(e['DTSTART;VALUE=DATE'], /^\d{8}$/);
  }
}

const FIXTURE = [
  { id: 'zz-a', title: '가 게임', coupons: [
    { code: 'DATED1', reward: '보석 100개, 골드 5,000', expireDate: '2099-12-31' },
    { code: 'FOREVER', reward: '상시 보상', expireDate: '상시' },
    { code: 'UNKNOWN', reward: '미공개 보상' },
    { code: 'OLD', reward: '끝난 보상', expireDate: '2020-01-01' },
  ] },
  { id: 'zz-b', title: '나 게임; 특별판', coupons: [
    { code: 'semi;colon,\\back', reward: '줄\n바꿈', expireDate: '2099-01-15' },
    { code: 'LONGREWARD', reward: '아주 긴 보상 설명 '.repeat(12), expireDate: '2099-06-30' },
  ] },
];

test('공식 만료일(YYYY-MM-DD)이 있는 살아 있는 코드만 일정이 된다 (상시·미공개·끝난 코드는 빠짐)', () => {
  const ev = expiringEvents(FIXTURE, { evaluate, pageIds: ['zz-a'] });
  assert.deepEqual(ev.map(e => e.code), ['semi;colon,\\back', 'LONGREWARD', 'DATED1']);
  assert.equal(ev.find(e => e.code === 'DATED1').url, 'https://ecm-coupon.com/game/zz-a.html#code-DATED1');
  assert.equal(ev.find(e => e.code === 'LONGREWARD').url, 'https://ecm-coupon.com/game/', '페이지가 없는 게임은 게임 쿠폰 홈으로');
});

test('ICS 형식: CRLF, 75바이트 줄 접기, 이스케이프, 하루짜리 일정, 캘린더 이름', () => {
  const now = new Date(Date.UTC(2026, 9, 19, 3, 4, 5));
  const ics = buildIcs(expiringEvents(FIXTURE, { evaluate, pageIds: ['zz-a', 'zz-b'] }), now);
  assertValidIcs(ics);
  const props = Object.fromEntries(unfold(ics).filter(([k]) => !['BEGIN', 'END'].includes(k)));
  assert.equal(props['X-WR-CALNAME'], 'ECM 쿠폰 마감 알림');
  const evs = events(ics);
  assert.equal(evs.length, 3);
  const a = evs.find(e => e.SUMMARY === '가 게임 쿠폰 코드 마감');
  assert.equal(a['DTSTART;VALUE=DATE'], '20991231');
  assert.equal(a['DTEND;VALUE=DATE'], '21000101', 'DTEND 는 다음 날(하루짜리 일정)');
  assert.equal(a.DTSTAMP, '20261019T030405Z');
  assert.equal(a.DESCRIPTION, '코드: DATED1\\n보상: 보석 100개\\, 골드 5\\,000\\n공식 만료일: 2099.12.31\\nhttps://ecm-coupon.com/game/zz-a.html#code-DATED1');
  const b = evs.find(e => e.DESCRIPTION.startsWith('코드: semi'));
  assert.equal(b.SUMMARY, '나 게임\\; 특별판 쿠폰 코드 마감');
  assert.ok(b.DESCRIPTION.startsWith('코드: semi\\;colon\\,\\\\back\\n보상: 줄\\n바꿈\\n'), b.DESCRIPTION);
  // 긴 줄은 접혀 있고, 펴면 원래 값이 그대로
  const long = evs.find(e => e.DESCRIPTION.includes('LONGREWARD'));
  assert.ok(long.DESCRIPTION.includes('아주 긴 보상 설명 '.repeat(12).trim()));
  assert.ok(ics.split('\r\n').some(l => l.startsWith(' ')), '접힌 줄이 없음');
});

test('줄 접기는 한글(3바이트) 글자 중간에서 자르지 않고, 이어지는 줄은 공백 하나로 시작한다', () => {
  const line = 'DESCRIPTION:' + '가'.repeat(60);
  const folded = foldLine(line);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(Buffer.byteLength(p, 'utf8') <= 75);
  for (const p of parts.slice(1)) assert.match(p, /^ [^ ]/);
  assert.equal(parts.map((p, i) => i ? p.slice(1) : p).join(''), line);
  assert.equal(foldLine('SHORT:abc'), 'SHORT:abc');
  assert.equal(icsEscape('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
});

test('UID 는 게임 id + 코드로 늘 같고, 대소문자가 다르면 다르다', () => {
  assert.equal(uidFor('zz-a', 'DATED1'), uidFor('zz-a', 'DATED1'));
  assert.notEqual(uidFor('zz-a', 'fortunate'), uidFor('zz-a', 'FORTUNATE'));
  assert.notEqual(uidFor('zz-a', 'X'), uidFor('zz-b', 'X'));
  assert.match(uidFor('zz-a', '한글 코드!'), /^zz-a-[0-9a-f]{16}@ecm-coupon\.com$/);
});

test('일정 내용이 그대로면 DTSTAMP 만 바뀌어도 파일을 다시 쓰지 않는다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecm-cal-'));
  try {
    const first = writeCalendar(tmp, { games: FIXTURE, evaluate, pageIds: [], now: new Date(Date.UTC(2026, 9, 19)) });
    assert.deepEqual(first, { events: 3, written: true });
    const before = fs.readFileSync(path.join(tmp, CAL_FILE), 'utf8');
    assert.equal(writeCalendar(tmp, { games: FIXTURE, evaluate, pageIds: [], now: new Date(Date.UTC(2026, 9, 20)) }).written, false);
    assert.equal(fs.readFileSync(path.join(tmp, CAL_FILE), 'utf8'), before);
    const more = [...FIXTURE, { id: 'zz-c', title: '다 게임', coupons: [{ code: 'NEW1', reward: 'r', expireDate: '2099-02-02' }] }];
    assert.deepEqual(writeCalendar(tmp, { games: more, evaluate, pageIds: [], now: new Date(Date.UTC(2026, 9, 21)) }), { events: 4, written: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('사이트의 캘린더 파일: 형식이 맞고, 공식 만료일이 있는 살아 있는 코드 수와 일정 수가 같다 (prerender 를 돌렸는지)', () => {
  const file = path.join(ROOT, CAL_FILE);
  assert.ok(fs.existsSync(file), 'node scripts/prerender.js 로 만드세요');
  const ics = fs.readFileSync(file, 'utf8');
  assertValidIcs(ics);
  const expected = catalog.flatMap(g => g.coupons.filter(c => /^\d{4}-\d{2}-\d{2}$/.test(c.expireDate || '') && evaluate(c).active));
  assert.equal(events(ics).length, expected.length);
  const uids = events(ics).map(e => e.UID);
  assert.equal(new Set(uids).size, uids.length, 'UID 가 겹침');
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'), /\.ics/, '사이트맵에 캘린더가 들어감');
  assert.match(fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8'), /^\*\.ics -text$/m, '.ics 줄 끝(CRLF)을 git 이 바꾸지 않게');
});

test('오늘의 쿠폰에 캘린더로 받기 링크와 안내가 있다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'today', 'index.html'), 'utf8');
  assert.ok(html.includes(`href="${CAL_URL.replace(/^https:/, 'webcal:')}"`), 'webcal 구독 링크 없음');
  assert.ok(html.includes(`data-copy-url="${CAL_URL}"`), '주소 복사 버튼 없음');
  assert.match(html, /캘린더로 받기/);
  assert.match(html, /URL로 추가/);
  // 이번 주 마감 칸 바로 아래
  assert.ok(html.indexOf('id="calendar"') > html.indexOf('id="tdWeek"'));
});
