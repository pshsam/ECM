/**
 * "이 코드 안 돼요" 신고 매일 모음 (.github/workflows/reports-digest.yml 이 매일 07:20 KST 에 실행)
 *
 * 파이어스토어 reports 에서 최근 14일 신고를 읽어 data/report-digest.json 에 코드별 개수만 적는다.
 *   { "게임id:코드": { "count": n, "reasons": { "expired": n, ... }, "last": "YYYY-MM-DD" } }
 * 기기·사람을 알 수 있는 값은 없다(신고 문서에도 game·code·reason·ts 뿐이다). last 는 마지막 신고의 한국 날짜.
 *
 * 조용히 끝나는 경우(파일을 건드리지 않는다):
 *   - scripts/reports.js 의 REPORTS_ENABLED 가 false
 *   - FIREBASE_SERVICE_ACCOUNT 비밀값이 없음
 *   - 최근 14일 신고가 없음
 * 인증은 notify-push.js 와 같은 서비스 계정 JWT 방식이다(서비스 계정은 보안 규칙과 상관없이 읽을 수 있다).
 */
const fs = require('fs');
const path = require('path');
const { REPORTS_ENABLED, REPORT_REASONS, LIMITS } = require('./reports');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'report-digest.json');
const WINDOW_DAYS = 14;

/** 파이어스토어 REST 문서 → { game, code, reason, ts(ISO) } (형식이 틀리면 null) */
function parseReportDoc(doc) {
  const f = (doc && doc.fields) || {};
  const s = k => (f[k] && typeof f[k].stringValue === 'string' ? f[k].stringValue : null);
  const ts = f.ts && typeof f.ts.timestampValue === 'string' ? f.ts.timestampValue : null;
  const r = { game: s('game'), code: s('code'), reason: s('reason'), ts };
  return r.game && r.code && r.reason && r.ts ? r : null;
}

const kstDate = iso => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);

/**
 * 신고 목록 → 코드별 모음. 최근 days 일(now 기준) 안의 신고만, 이유는 정해진 세 가지만 센다.
 * 키는 정렬해서 내므로 같은 신고면 언제나 같은 JSON 이 나온다.
 */
function aggregateReports(reports, { now = new Date(), days = WINDOW_DAYS } = {}) {
  const since = now.getTime() - days * 86400e3;
  const out = {};
  for (const r of reports || []) {
    if (!r || typeof r.game !== 'string' || typeof r.code !== 'string') continue;
    if (!r.game || !r.code || r.game.length > LIMITS.game || r.code.length > LIMITS.code) continue;
    if (!Object.prototype.hasOwnProperty.call(REPORT_REASONS, r.reason)) continue;
    const t = Date.parse(r.ts);
    if (isNaN(t) || t < since || t > now.getTime() + 5 * 60e3) continue;
    const key = `${r.game}:${r.code}`;
    const d = out[key] || (out[key] = { count: 0, reasons: {}, last: '' });
    d.count++;
    d.reasons[r.reason] = (d.reasons[r.reason] || 0) + 1;
    const day = kstDate(r.ts);
    if (day > d.last) d.last = day;
  }
  const sorted = {};
  for (const k of Object.keys(out).sort()) {
    const d = out[k];
    sorted[k] = { count: d.count, reasons: Object.fromEntries(Object.keys(d.reasons).sort().map(x => [x, d.reasons[x]])), last: d.last };
  }
  return sorted;
}

/** 최근 신고 문서 (ts >= since). 서비스 계정 토큰으로 runQuery */
async function fetchReports(projectId, token, sinceIso) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'reports' }],
      where: { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: sinceIso } } },
      limit: 10000,
    } }),
  });
  if (!res.ok) throw new Error(`신고 읽기 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map(x => x.document && parseReportDoc(x.document)).filter(Boolean);
}

async function main() {
  if (!REPORTS_ENABLED) { console.log('신고 기능이 꺼져 있어(scripts/reports.js 의 REPORTS_ENABLED 가 false) 건너뜀'); return; }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.log('FIREBASE_SERVICE_ACCOUNT 가 없어 건너뜀'); return; }
  const sa = JSON.parse(raw);
  const { accessToken } = require('./notify-push');
  const token = await accessToken(sa);
  const now = new Date();
  const reports = await fetchReports(sa.project_id, token, new Date(now.getTime() - WINDOW_DAYS * 86400e3).toISOString());
  if (!reports.length) { console.log(`최근 ${WINDOW_DAYS}일 신고 없음`); return; }
  const digest = aggregateReports(reports, { now });
  const json = JSON.stringify(digest, null, 2) + '\n';
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (prev === json) { console.log(`신고 ${reports.length}건 · 바뀐 것 없음`); return; }
  fs.writeFileSync(OUT, json);
  console.log(`신고 ${reports.length}건 → 코드 ${Object.keys(digest).length}개 (data/report-digest.json)`);
}

// 테스트(tests/reports.test.js)가 모으는 규칙을 확인할 수 있게 내보낸다. 직접 실행할 때만 파이어스토어를 읽는다.
module.exports = { aggregateReports, parseReportDoc, WINDOW_DAYS };
if (require.main === module) main().catch(err => { console.error(err.message); process.exit(1); });
