/**
 * 카카오톡 채널 "소식" 글 초안을 만든다. (카카오 채널은 자동 게시 기능이 없어 사람이 붙여 넣는다)
 *
 *   node scripts/kakao-weekly.js           → 최근 7일 새 쿠폰 모음 (주간 소식)
 *   node scripts/kakao-weekly.js --days 3  → 기간 바꾸기
 *   node scripts/kakao-weekly.js --top 3   → 기간과 상관없이 지금 쓸 수 있는 쿠폰 중 만료가 먼 것 N개 (첫 소식용)
 *
 * 출력은 그대로 복사해 붙여 넣을 수 있는 글이다. 링크에는 utm_source=kakao 꼬리표를 붙인다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://ecm-coupon.com';
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : def; };

function loadCatalog() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const src = html.slice(html.indexOf('const initialGameCatalog = ['));
  const open = src.indexOf('[');
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']' && --depth === 0) { end = i + 1; break; }
  }
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${src.slice(open, end)});`)();
}

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const permanent = e => !e || e === '상시' || /9999/.test(e);
const alive = (e, today) => permanent(e) || String(e).slice(0, 10) >= today;
const link = (id, campaign) => {
  const page = fs.existsSync(path.join(ROOT, 'game', `${id}.html`)) ? `/game/${id}.html` : '/game/';
  return `${SITE}${page}?utm_source=kakao&utm_medium=channel_post&utm_campaign=${campaign}`;
};
const expText = e => (permanent(e) ? '상시' : `${md(String(e).slice(0, 10))}까지`);

function main() {
  const today = kstToday();
  const games = loadCatalog();
  const seen = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coupon-seen.json'), 'utf8'));
  const live = [];
  for (const g of games) for (const c of (g.coupons || [])) {
    if (alive(c.expireDate, today)) live.push({ g, c, seenAt: seen[`${g.id}:${c.code}`] || '' });
  }

  const top = arg('--top', 0);
  let picked, title, intro, campaign;
  if (top) {
    // 첫 소식: 로블록스보다 일반 게임을 먼저, 만료가 먼 순
    const score = x => (x.g.id.startsWith('roblox') ? 1 : 0);
    picked = live
      .filter(x => !permanent(x.c.expireDate))
      .sort((a, b) => score(a) - score(b) || String(b.c.expireDate).localeCompare(String(a.c.expireDate)))
      .filter((x, i, arr) => arr.findIndex(y => y.g.id === x.g.id) === i)
      .slice(0, top);
    campaign = 'hello';
    title = '🎟 ECM 게임 쿠폰 채널을 열었어요!';
    intro = [
      '매일 게임사 공식 채널에서 확인한 쿠폰 코드만 모아 알려 드려요.',
      '다른 곳에 떠도는 만료된 코드 때문에 헛걸음하지 않게, 등록일과 만료일을 함께 적어요.',
      '',
      '📌 지금 바로 쓸 수 있는 쿠폰',
    ];
  } else {
    const days = arg('--days', 7);
    const from = new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
    picked = live.filter(x => x.seenAt && x.seenAt >= from && x.seenAt <= today)
      .sort((a, b) => b.seenAt.localeCompare(a.seenAt));
    campaign = `weekly_${today}`;
    title = `🎟 이번 주 새 게임 쿠폰 (${md(from)}~${md(today)})`;
    intro = picked.length
      ? [`지난 ${days}일 동안 확인한 새 쿠폰 ${picked.length}개예요. 만료 전에 챙기세요!`, '']
      : ['이번 주에는 새로 확인된 쿠폰이 없어요. 새 코드가 나오면 바로 알려 드릴게요!'];
  }

  // 게임별로 묶기
  const byGame = new Map();
  for (const x of picked) {
    if (!byGame.has(x.g.id)) byGame.set(x.g.id, { g: x.g, items: [] });
    byGame.get(x.g.id).items.push(x);
  }
  // 소식 글이 너무 길면 읽히지 않는다: 게임 8개, 게임마다 코드 3개까지. 나머지는 사이트로 안내
  const MAX_GAMES = 8, MAX_CODES = 3;
  const groups = [...byGame.values()];
  const body = [];
  for (const { g, items } of groups.slice(0, MAX_GAMES)) {
    body.push(`▶ ${g.title}`);
    for (const { c } of items.slice(0, MAX_CODES)) body.push(`  ${c.code} · ${c.reward || '보상 확인 중'} (${expText(c.expireDate)})`);
    if (items.length > MAX_CODES) body.push(`  외 ${items.length - MAX_CODES}개 더`);
    body.push(`  입력 방법 👉 ${link(g.id, campaign)}`);
    body.push('');
  }
  if (groups.length > MAX_GAMES) body.push(`그 밖에 ${groups.length - MAX_GAMES}개 게임의 새 쿠폰도 사이트에 있어요.`, '');
  const outro = [
    '💡 새 쿠폰은 채널 친구에게 가장 먼저 알려 드려요.',
    `전체 쿠폰 모음 👉 ${SITE}/?utm_source=kakao&utm_medium=channel_post&utm_campaign=${campaign}`,
  ];
  console.log([title, '', ...intro, ...body, ...outro].join('\n'));
}

main();
