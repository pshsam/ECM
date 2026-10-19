/**
 * 쿠폰 마감 캘린더 구독: /calendar/ecm-expiring.ics (2026-10-19~)
 *
 * 지금 쓸 수 있는 코드 중 게임사가 공지한 만료일(expireDate: YYYY-MM-DD)이 있는 코드마다 그날 하루짜리 일정 하나.
 * "상시"·만료일 미공개 코드는 넣지 않는다(날짜를 짐작해 만들지 않는다).
 * 구글 캘린더 "URL로 추가"·아이폰 "캘린더 구독"으로 받으면 쿠폰 루틴이 목록을 고칠 때마다 저절로 따라온다.
 *
 * 형식은 RFC 5545: 줄 끝 CRLF, 75바이트마다 줄 접기(다음 줄은 공백 하나로 시작), 글자 안의 \ ; , 줄바꿈은 이스케이프.
 * UID 는 게임 id + 코드로 만들어 늘 같다(같은 코드가 다시 빌드돼도 일정이 두 번 생기지 않는다).
 * DTSTAMP 는 빌드 시각인데, 일정 내용이 그대로면 파일을 다시 쓰지 않는다(루틴이 돌 때마다 커밋이 생기지 않게).
 * 사이트맵에는 넣지 않는다. 저장소의 .gitattributes 가 이 파일의 CRLF 를 그대로 둔다.
 * prerender.js 가 부른다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = 'https://ecm-coupon.com';
const CAL_FILE = 'calendar/ecm-expiring.ics';
const CAL_URL = `${SITE}/${CAL_FILE}`;
const CAL_NAME = 'ECM 쿠폰 마감 알림';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 게임 페이지 코드 줄의 앵커 (game-pages.js codeAnchor 와 같은 규칙)
const codeAnchor = code => 'code-' + [...String(code)].map(ch => /[A-Za-z0-9_-]/.test(ch) ? ch : '.' + ch.codePointAt(0).toString(16)).join('');

/** TEXT 값 이스케이프 (RFC 5545 3.3.11): \ → \\, ; → \;, , → \,, 줄바꿈 → \n */
function icsEscape(t) {
  return String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** 줄 접기 (RFC 5545 3.1): 한 줄은 75바이트(UTF-8)까지. 넘으면 CRLF + 공백 하나를 넣고 이어 쓴다. 글자 중간(멀티바이트)에서 자르지 않는다 */
function foldLine(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (bytes + b > 75) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join('\r\n');
}

const compact = d => d.replace(/-/g, '');
function nextDay(d) {
  const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1));
  return t.toISOString().slice(0, 10);
}
/** UTC 시각 → 20261019T031500Z */
const utcStamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/** 늘 같은 UID: 게임 id + 코드(대소문자 그대로)의 해시 */
function uidFor(gameId, code) {
  const h = crypto.createHash('sha1').update(`${gameId}:${code}`, 'utf8').digest('hex').slice(0, 16);
  return `${gameId}-${h}@ecm-coupon.com`;
}

/**
 * 일정에 넣을 코드: 살아 있고(evaluate().active) 공식 만료일이 YYYY-MM-DD 인 코드. 만료일·게임 이름·코드 순.
 * pageIds: 게임 페이지가 있는(목록에 보이는) 게임 id. 있으면 그 코드 줄로, 없으면 /game/ 으로 링크한다.
 */
function expiringEvents(games, { evaluate, pageIds = [] }) {
  const pages = new Set(pageIds);
  const out = [];
  for (const g of games || []) {
    for (const c of g.coupons || []) {
      if (!DATE.test(c.expireDate || '')) continue;
      if (!evaluate(c).active) continue;
      out.push({
        gameId: g.id, title: g.title, code: c.code, reward: c.reward || '', date: c.expireDate,
        url: pages.has(g.id) ? `${SITE}/game/${g.id}.html#${codeAnchor(c.code)}` : `${SITE}/game/`,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ko') || a.code.localeCompare(b.code));
}

/** .ics 본문 (CRLF). now = DTSTAMP 로 쓸 시각 */
function buildIcs(events, now = new Date()) {
  const stamp = utcStamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ECM Coupon//Expiring Coupon Codes//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${icsEscape(CAL_NAME)}`,
    `X-WR-CALNAME:${icsEscape(CAL_NAME)}`,
    `X-WR-CALDESC:${icsEscape('ECM(ecm-coupon.com)에 올라온 게임 쿠폰 코드 중 게임사가 만료일을 공지한 코드의 마감일. 만료일 미공개·상시 코드는 없습니다.')}`,
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    `URL:${SITE}/today/`,
  ];
  for (const e of events) {
    const desc = [`코드: ${e.code}`, `보상: ${e.reward || '확인 중'}`, `공식 만료일: ${e.date.replace(/-/g, '.')}`, e.url].join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidFor(e.gameId, e.code)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
      `SUMMARY:${icsEscape(`${e.title} 쿠폰 코드 마감`)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      `URL:${e.url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** DTSTAMP 줄만 빼고 비교 (일정 내용이 같으면 파일을 그대로 둔다) */
const withoutStamp = s => String(s || '').replace(/^DTSTAMP:.*\r?\n/gm, '');

/** /calendar/ecm-expiring.ics 를 쓴다. @returns {{ events: number, written: boolean }} */
function writeCalendar(rootDir, { games, evaluate, pageIds, now = new Date() }) {
  const events = expiringEvents(games, { evaluate, pageIds });
  const ics = buildIcs(events, now);
  const file = path.join(rootDir, CAL_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev !== null && withoutStamp(prev) === withoutStamp(ics)) return { events: events.length, written: false };
  fs.writeFileSync(file, ics);
  return { events: events.length, written: true };
}

module.exports = { writeCalendar, buildIcs, expiringEvents, foldLine, icsEscape, uidFor, CAL_FILE, CAL_URL, CAL_NAME };
