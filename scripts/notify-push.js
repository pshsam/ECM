/**
 * 새 쿠폰이 올라오면 그 게임을 "내 게임"에 담아 둔 사람에게 웹 푸시로 알린다. (.github/workflows/push-notify.yml 이 실행)
 *
 * - 알릴 대상: data/coupon-seen.json 에 3일 안에 처음 등록됐고 지금 살아 있는 코드 중 data/push-sent.json 에 아직 없는 것.
 *   텔레그램 알림(notify-telegram.js)과 같은 기준이다.
 * - 받는 사람: 파이어스토어 subscribers 문서 중 games 배열에 그 게임 id 가 있는 기기.
 * - 처음 실행하면 지금 있는 코드를 모두 "보낸 것"으로 적기만 한다(옛 코드 폭탄 방지).
 * - 밤 9시~아침 8시(한국 시간)에는 보내지 않고, 아침 8시 5분 예약 실행 때 모아서 보낸다.
 * - 알림을 누르면 그 게임 페이지의 "그날 추가된 코드 묶음"(#added-날짜)으로 간다.
 * - 끊긴 기기(토큰 만료)는 구독 문서를 지운다.
 * - ECM 쿠폰 안드로이드 앱(구독 문서 ua: native-android)에는 웹 푸시 대신 "데이터 메시지"를 보낸다.
 *   앱이 직접 알림을 만들어 [코드 복사] [입력하러 가기] 버튼을 붙인다 (앱 저장소 EcmMessagingService.java).
 *
 * 환경변수: FIREBASE_SERVICE_ACCOUNT (비밀, 서비스 계정 JSON 전체). 없으면 조용히 건너뛴다.
 *           DRY_RUN=1 이면 보내지 않고 화면에만 찍는다. FORCE=1 이면 밤 시간 규칙을 무시한다.
 *           CHECK=1 이면 구글 인증과 구독 기기 수만 확인한다(보내지 않음).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { evaluate } = require('./game-pages');

const ROOT = path.join(__dirname, '..');
const SEEN = path.join(ROOT, 'data', 'coupon-seen.json');
const SENT = path.join(ROOT, 'data', 'push-sent.json');
const SITE = 'https://ecm-coupon.com';
const MAX_GAMES = 10;

function loadCatalog() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('const initialGameCatalog = [');
  const src = html.slice(start);
  const open = src.indexOf('[');
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']' && --depth === 0) { end = i + 1; break; }
  }
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${src.slice(open, end)});`)();
}

function kstNow() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// ── 구글 인증: 서비스 계정으로 서명한 JWT 를 액세스 토큰으로 바꾼다(추가 라이브러리 없이) ──
async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('구글 인증 실패: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

/** games 배열에 gameId 가 있는 구독 문서들 */
async function subscribersOf(projectId, token, gameId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'subscribers' }],
      where: { fieldFilter: { field: { fieldPath: 'games' }, op: 'ARRAY_CONTAINS', value: { stringValue: gameId } } },
      limit: 5000,
    } }),
  });
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('구독자 조회 실패: ' + JSON.stringify(rows).slice(0, 200));
  return rows.filter(r => r.document).map(r => ({
    name: r.document.name,
    fcm: decodeURIComponent(r.document.name.split('/').pop()),
    native: ((r.document.fields || {}).ua || {}).stringValue === 'native-android',
  }));
}

/** 앱 기기용 데이터 메시지 (모든 값은 문자열이어야 한다) */
function nativeMessage(fcm, msg) {
  const data = { title: msg.title, body: msg.appBody || msg.body, link: msg.link, tag: msg.tag };
  if (msg.code) data.code = msg.code;
  if (msg.redeem) data.redeem = msg.redeem;
  return { token: fcm, data, android: { priority: 'HIGH', ttl: '86400s' } };
}

async function sendOne(projectId, token, fcm, msg, native = false) {
  const message = native ? nativeMessage(fcm, msg) : { token: fcm, webpush: {
    notification: { title: msg.title, body: msg.body, icon: `${SITE}/assets/icon-192.png`, badge: `${SITE}/assets/icon-192.png`, tag: msg.tag },
    fcm_options: { link: msg.link },
  } };
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (res.ok) return 'ok';
  const t = await res.text();
  return /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(t) ? 'gone' : 'fail:' + res.status;
}

async function main() {
  const dry = process.env.DRY_RUN === '1';
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw && !dry) { console.log('푸시 알림 설정 전이라 건너뜀 (FIREBASE_SERVICE_ACCOUNT 없음)'); return; }
  const sa = raw ? JSON.parse(raw) : null;

  // 연결 점검: 구글 인증 + 구독 기기 수만 확인하고 끝낸다(알림은 보내지 않음). 워크플로 수동 실행의 check 옵션
  if (process.env.CHECK === '1') {
    const auth = await accessToken(sa);
    const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runAggregationQuery`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'subscribers' }] }, aggregations: [{ alias: 'n', count: {} }] } }) });
    const j = await res.json();
    const n = Array.isArray(j) && j[0] && j[0].result ? j[0].result.aggregateFields.n.integerValue : null;
    console.log(n !== null ? `연결 점검 통과: 프로젝트 ${sa.project_id}, 알림 켠 기기 ${n}대` : '연결 점검 실패: ' + JSON.stringify(j).slice(0, 200));
    if (n === null) process.exit(1);
    return;
  }

  const { date: today, hour } = kstNow();
  const seen = JSON.parse(fs.readFileSync(SEEN, 'utf8'));
  const games = loadCatalog();
  const first = !fs.existsSync(SENT);
  const state = first ? { sent: [] } : JSON.parse(fs.readFileSync(SENT, 'utf8'));
  const sent = new Set(state.sent);

  const live = [];
  for (const g of games) for (const c of g.coupons || []) {
    if (evaluate(c).active) live.push({ key: `${g.id}:${c.code}`, g, c });
  }
  if (first) {
    state.sent = live.map(x => x.key).sort();
    state.startedAt = today;
    fs.writeFileSync(SENT, JSON.stringify(state, null, 2) + '\n');
    console.log(`처음 실행: 지금 있는 코드 ${state.sent.length}개를 보낸 것으로 기록만 했어요.`);
    return;
  }
  const fresh = live.filter(x => !sent.has(x.key) && seen[x.key] && daysBetween(seen[x.key], today) <= 3);
  if (!fresh.length) { console.log('새로 알릴 코드가 없어요.'); return; }
  if (!dry && process.env.FORCE !== '1' && (hour >= 21 || hour < 8)) {
    console.log(`밤 시간(${hour}시)이라 보내지 않아요. 새 코드 ${fresh.length}개는 아침에 보냅니다.`);
    return;
  }

  const byGame = new Map();
  for (const x of fresh) {
    if (!byGame.has(x.g.id)) byGame.set(x.g.id, { g: x.g, items: [] });
    byGame.get(x.g.id).items.push(x);
  }
  const auth = sa ? await accessToken(sa) : null;
  let games_ = 0, delivered = 0, removed = 0;
  for (const { g, items } of byGame.values()) {
    if (games_ >= MAX_GAMES) break;
    const date = items.map(x => seen[x.key]).sort().pop();
    const rewards = items.map(x => x.c.reward).filter(Boolean);
    const msg = {
      title: `${g.title} 새 쿠폰 ${items.length}개`,
      body: (cut(rewards[0] || '보상은 페이지에서 확인하세요', 50)) + (rewards.length > 1 ? ` 외 ${rewards.length - 1}개` : '') + ' · 눌러서 코드 복사',
      link: `${SITE}/game/${g.id}.html?utm_source=push#added-${date}`,
      tag: `ecm-${g.id}-${date}`,
      // 앱 알림: 첫 코드를 바로 복사할 수 있게, 공식 입력 페이지가 있으면 [입력하러 가기]
      code: items[0].c.code,
      redeem: /^https:\/\//.test(g.redeemUrl || '') ? g.redeemUrl : '',
      appBody: `${items[0].c.code} · ${cut(rewards[0] || '보상은 페이지에서 확인하세요', 44)}` + (items.length > 1 ? ` 외 ${items.length - 1}개` : ''),
    };
    if (dry) { console.log('--- (보내지 않음) ---', JSON.stringify(msg)); items.forEach(x => sent.add(x.key)); games_++; continue; }
    const subs = await subscribersOf(sa.project_id, auth, g.id);
    for (const s of subs) {
      const r = await sendOne(sa.project_id, auth, s.fcm, msg, s.native);
      if (r === 'ok') delivered++;
      else if (r === 'gone') {
        await fetch(`https://firestore.googleapis.com/v1/${s.name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth}` } });
        removed++;
      }
    }
    console.log(`${g.title}: 구독 기기 ${subs.length}대`);
    items.forEach(x => sent.add(x.key));
    games_++;
  }
  if (!dry) {
    state.sent = [...sent].sort();
    state.lastSentAt = today;
    fs.writeFileSync(SENT, JSON.stringify(state, null, 2) + '\n');
  }
  console.log(`${games_}개 게임 알림 ${dry ? '(미리보기)' : `보냄 · 전달 ${delivered}건 · 끊긴 기기 정리 ${removed}대`}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
