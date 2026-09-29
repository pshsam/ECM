/**
 * 새 쿠폰이 사이트에 올라오면 텔레그램 채널에 알린다. (.github/workflows/telegram-notify.yml 이 실행)
 *
 * - 알릴 대상: data/coupon-seen.json 에 3일 안에 처음 등록됐고, 지금 카탈로그에 살아 있는 코드 중
 *   data/telegram-sent.json 에 아직 없는 것.
 * - 처음 실행하면 지금 있는 코드를 모두 "보낸 것"으로 적기만 하고 보내지 않는다 (옛 코드 폭탄 방지).
 * - 밤 9시~아침 8시(한국 시간)에는 보내지 않는다. 아침 8시 5분 예약 실행 때 모아서 보낸다.
 *
 * 환경변수: TELEGRAM_BOT_TOKEN (비밀), TELEGRAM_CHAT_ID (예: @ecm_coupon)
 *           DRY_RUN=1 이면 보내지 않고 화면에만 찍는다. FORCE=1 이면 밤 시간 규칙을 무시한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEEN = path.join(ROOT, 'data', 'coupon-seen.json');
const SENT = path.join(ROOT, 'data', 'telegram-sent.json');
const SITE = 'https://ecm-coupon.com';
const MAX_MESSAGES = 10; // 한 번에 보낼 최대 메시지 수 (게임 단위)

const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** index.html 의 initialGameCatalog 를 읽는다 */
function loadCatalog() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('const initialGameCatalog = [');
  if (start < 0) throw new Error('initialGameCatalog 를 찾지 못했어요');
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

/** 한국 시간 */
function kstNow() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

function isActive(expireDate, today) {
  if (!expireDate || expireDate === '상시' || /9999/.test(expireDate)) return true;
  const m = String(expireDate).match(/^(\d{4}-\d{2}-\d{2})/);
  return !m || m[1] >= today;
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const md = d => d.slice(5).replace('-', '/');

function messageFor(g, coupons, today) {
  // 짧게: .html 없이, 꼬리표는 출처(telegram) 하나만. 글에서는 주소 대신 "입력 방법 보기" 글자로 보인다
  const page = fs.existsSync(path.join(ROOT, 'game', `${g.id}.html`)) ? `/game/${g.id}` : '/game/';
  const url = `${SITE}${page}?utm_source=telegram`;
  const lines = coupons.map(c => {
    const exp = !c.expireDate || c.expireDate === '상시' || /9999/.test(c.expireDate) ? '상시' : `~${md(c.expireDate.slice(0, 10))}`;
    return `<code>${esc(c.code)}</code> · ${esc(c.reward || '보상 확인 중')} (${exp})`;
  });
  return [
    `🎟 <b>${esc(g.title)}</b> 새 쿠폰 ${coupons.length}개 (${md(today)} 확인)`,
    '',
    ...lines,
    '',
    `👉 <a href="${url}">입력 방법 보기</a>`,
    '<i>코드를 누르면 복사돼요 · 알림 그만 받기: 채널 나가기</i>',
  ].join('\n');
}

async function send(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`텔레그램 전송 실패 (${res.status}): ${body.description || ''}`);
}

async function main() {
  const dry = process.env.DRY_RUN === '1';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!dry && (!token || !chatId)) {
    console.log('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 설정되지 않아 건너뜁니다.');
    return;
  }

  if (process.env.TEST_MESSAGE === "1") {
    await send(token, chatId, [
      '✅ ECM 쿠폰 정찰병이 연결됐어요.',
      '이제 새 게임 쿠폰이 확인되면 이 채널로 바로 알려 드릴게요. 🎟',
      '',
      '👉 https://ecm-coupon.com/?utm_source=telegram&utm_medium=channel&utm_campaign=hello',
    ].join('\n'));
    console.log("테스트 메시지를 보냈어요.");
    return;
  }

  const { date: today, hour } = kstNow();
  const seen = JSON.parse(fs.readFileSync(SEEN, 'utf8'));
  const games = loadCatalog();
  const first = !fs.existsSync(SENT);
  const state = first ? { sent: [] } : JSON.parse(fs.readFileSync(SENT, 'utf8'));
  const sent = new Set(state.sent);

  // 지금 살아 있는 코드
  const live = [];
  for (const g of games) {
    for (const c of (g.coupons || [])) {
      if (!isActive(c.expireDate, today)) continue;
      live.push({ key: `${g.id}:${c.code}`, g, c });
    }
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

  // 게임별로 묶기
  const byGame = new Map();
  for (const x of fresh) {
    if (!byGame.has(x.g.id)) byGame.set(x.g.id, { g: x.g, items: [] });
    byGame.get(x.g.id).items.push(x);
  }
  let count = 0;
  for (const { g, items } of byGame.values()) {
    if (count >= MAX_MESSAGES) break;
    const text = messageFor(g, items.map(x => x.c), today);
    if (dry) console.log('--- (보내지 않음) ---\n' + text);
    else await send(token, chatId, text);
    items.forEach(x => sent.add(x.key));
    count++;
  }
  if (!dry) {
    state.sent = [...sent].sort();
    state.lastSentAt = today;
    fs.writeFileSync(SENT, JSON.stringify(state, null, 2) + '\n');
  }
  console.log(`${count}개 게임 알림 ${dry ? '(미리보기)' : '보냄'}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
