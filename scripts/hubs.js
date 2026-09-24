/**
 * 게임 쿠폰 홈 (/game/index.html). 상단 메뉴의 "게임 쿠폰"을 누르면 오는 곳.
 *
 * 새 쿠폰 → 마감 임박 → 장르별 게임 → 로블록스 → 등록 방법 가이드 순서. 전부 카탈로그와 등록일 장부에서 만든다.
 * prerender.js 가 게임 페이지를 쓴 다음에 부른다. 손으로 고치지 않는다.
 */
const fs = require('fs');
const path = require('path');
const { SITE, esc, fmt, fitTitle, fitDesc, pageShell, breadcrumbLd, writeIfChanged } = require('./page-shell');

const NEW_DAYS = 7;
const DUE_DAYS = 14;
const HOT_RANK = 8;
const BASELINE_DATE = '2026-09-21'; // 사이트를 연 날 한꺼번에 넣은 코드는 "새 쿠폰"으로 치지 않는다
const GENRE_ORDER = ['mmorpg', 'rpg', 'action', 'fps', 'sports'];
const GENRE_ICONS = { mmorpg: '⚔️', rpg: '📘', action: '🌍', fps: '🎯', sports: '⚽' };

function writeGameHub(rootDir, { games, posts, version, firstSeen, gamePageIds, evaluate, GENRE_LABELS, headerHtml, footerHtml }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pages = new Set(gamePageIds);
  const withPage = games.filter(g => pages.has(g.id));
  const activeOf = g => (g.coupons || []).map(c => ({ c, ev: evaluate(c.expireDate, today) })).filter(x => x.ev.active);
  const isRoblox = g => (g.platforms || []).includes('roblox');
  const daysAgo = d => (today.getTime() - new Date(d).getTime()) / 86400000;
  const newCodes = g => activeOf(g).filter(({ c }) => {
    const seen = firstSeen[g.id + ':' + c.code];
    return seen && seen > BASELINE_DATE && daysAgo(seen) <= NEW_DAYS;
  });
  const rank = new Map(games.map((g, i) => [g.id, i]));
  const isHot = g => (typeof g.hot === 'boolean' ? g.hot : activeOf(g).length > 0 && rank.get(g.id) < HOT_RANK);
  const totalActive = withPage.reduce((n, g) => n + activeOf(g).length, 0);
  const mon = `${today.getMonth() + 1}월`;
  const ym = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;

  // 새 쿠폰: 새 코드가 들어온 게임, 최근 등록 순
  const fresh = withPage.map(g => {
    const n = newCodes(g);
    const latest = n.map(({ c }) => firstSeen[g.id + ':' + c.code]).sort().pop();
    return { g, n: n.length, latest };
  }).filter(x => x.n > 0).sort((a, b) => (b.latest || '').localeCompare(a.latest || ''));

  // 마감 임박: 14일 안에 끝나는 코드가 있는 게임, 가장 빨리 끝나는 순
  const due = withPage.map(g => {
    const left = activeOf(g).map(x => x.ev.left).filter(l => l !== null && l <= DUE_DAYS);
    return { g, left: left.length ? Math.min(...left) : null, n: left.length };
  }).filter(x => x.left !== null).sort((a, b) => a.left - b.left);

  const row = (g, main, meta) => `      <a class="hub-row" href="/game/${esc(g.id)}.html"><span class="hub-ico">${g.icon || '🎮'}</span><span class="main"><span class="t">${esc(g.title)}</span><span class="d">${main}</span></span><span class="meta">${meta}</span></a>`;
  const tile = g => {
    const n = activeOf(g).length;
    const badges = (isHot(g) ? '<span class="ecm-pill hot">HOT</span>' : '') + (newCodes(g).length ? '<span class="ecm-pill new">NEW</span>' : '');
    return `      <a class="hub-tile" href="/game/${esc(g.id)}.html"><span class="top"><span class="hub-ico">${g.icon || '🎮'}</span><span class="name">${esc(g.title)}</span></span><span class="sub">${esc(g.category || GENRE_LABELS[g.genre] || '')}</span><span class="foot">${n ? `<span class="hub-badge">코드 ${n}개</span>` : '<span class="hub-badge muted">입력 방법</span>'}${badges}</span></a>`;
  };
  // 쿠폰 있는 게임 먼저, 그다음 카탈로그 순서(인기순)
  const order = list => list.slice().sort((a, b) => (activeOf(b).length > 0) - (activeOf(a).length > 0) || rank.get(a.id) - rank.get(b.id));

  const genreSecs = GENRE_ORDER.map(k => ({ k, list: order(withPage.filter(g => !isRoblox(g) && g.genre === k)) })).filter(s => s.list.length);
  const roblox = order(withPage.filter(isRoblox));
  const guides = posts.filter(p => p.cat === 'guide' && /등록|입력|교환|코드|쿠폰/.test(p.title)).slice(0, 8);
  const codeGuides = posts.filter(p => p.cat === 'game').slice(0, 6);

  const chips = [
    fresh.length ? '<a class="hub-chip" href="#new">🆕 새 쿠폰</a>' : '',
    due.length ? '<a class="hub-chip" href="#due">⏰ 마감 임박</a>' : '',
    ...genreSecs.map(s => `<a class="hub-chip" href="#${s.k}">${GENRE_ICONS[s.k]} ${esc(GENRE_LABELS[s.k])}</a>`),
    roblox.length ? '<a class="hub-chip" href="#roblox">🟥 로블록스</a>' : '',
    guides.length ? '<a class="hub-chip" href="#guides">📖 등록 방법</a>' : '',
  ].filter(Boolean).join('');

  const body = `    <nav class="hub-crumb" aria-label="현재 위치"><a href="/">ECM 쿠폰</a> › 게임 쿠폰</nav>
    <div class="hub-head">
      <h1>게임 쿠폰 코드 모음 <small>(${ym})</small></h1>
      <p class="hub-lede">ECM 쿠폰(Every Coupon Matters)이 ${esc(fmt(version))} 기준으로 확인한 게임 ${withPage.length}종의 쿠폰 코드와 입력 방법이에요. 코드는 게임사 공식 채널이나 독립된 출처 두 곳에서 확인한 것만 올리고, 만료되면 목록에서 내립니다.</p>
    </div>
    <div class="hub-stats"><span class="hub-stat">게임 <b>${withPage.length}</b>종</span><span class="hub-stat">지금 쓸 수 있는 코드 <b>${totalActive}</b>개</span><span class="hub-stat">새 쿠폰 게임 <b>${fresh.length}</b>곳</span><span class="hub-stat">마감 임박 <b>${due.length}</b>곳</span><span class="hub-stat">확인 ${esc(fmt(version))}</span></div>
    <nav class="hub-chips" aria-label="게임 쿠폰 바로가기">${chips}</nav>
${fresh.length ? `
    <section class="hub-sec" id="new" aria-labelledby="newTitle">
      <h2 id="newTitle">🆕 새 쿠폰 <small>최근 ${NEW_DAYS}일 안에 새로 확인된 코드</small></h2>
      <div class="hub-rows">
${fresh.slice(0, 12).map(x => row(x.g, `새 코드 ${x.n}개 · ${esc(x.g.category || '')}`, `<span class="ecm-pill new">NEW</span> ${esc(fmt(x.latest).slice(5))}`)).join('\n')}
      </div>
    </section>` : ''}
${due.length ? `
    <section class="hub-sec" id="due" aria-labelledby="dueTitle">
      <h2 id="dueTitle">⏰ 마감 임박 <small>${DUE_DAYS}일 안에 끝나는 코드가 있는 게임</small></h2>
      <div class="hub-rows">
${due.slice(0, 10).map(x => row(x.g, `곧 끝나는 코드 ${x.n}개`, `<span class="hub-badge due">${x.left === 0 ? '오늘 마감' : `D-${x.left}`}</span>`)).join('\n')}
      </div>
    </section>` : ''}
${genreSecs.map(s => `
    <section class="hub-sec" id="${s.k}" aria-labelledby="g-${s.k}">
      <h2 id="g-${s.k}">${GENRE_ICONS[s.k]} ${esc(GENRE_LABELS[s.k])} <small>${s.list.length}종</small></h2>
      <div class="hub-tiles">
${s.list.map(tile).join('\n')}
      </div>
    </section>`).join('')}
${roblox.length ? `
    <section class="hub-sec" id="roblox" aria-labelledby="g-roblox">
      <h2 id="g-roblox">🟥 로블록스 <small>${roblox.length}종 · 개발팀 공식 채널 기준, 하루 두 번 확인</small></h2>
      <div class="hub-tiles">
${roblox.map(tile).join('\n')}
      </div>
    </section>` : ''}
${guides.length || codeGuides.length ? `
    <section class="hub-sec" id="guides" aria-labelledby="guidesTitle">
      <h2 id="guidesTitle">📖 쿠폰 등록 방법과 코드 가이드</h2>
      <ul class="hub-list">
${guides.concat(codeGuides.filter(p => !guides.includes(p))).map(p => `        <li><a href="${esc(p.url)}">${esc(p.title)}</a></li>`).join('\n')}
      </ul>
      <p class="hub-more"><a href="/blog/index.html">블로그 전체 보기 →</a></p>
    </section>` : ''}
    <p class="hub-note">ECM 쿠폰은 게임사의 공식 파트너가 아니에요. 코드는 공개된 공식 안내를 확인해 정리한 것이고, 실제 입력은 각 게임의 공식 쿠폰 페이지나 게임 안에서 합니다. 확인 기준은 <a class="hub-link" href="/about.html">ECM 쿠폰 소개</a>에 적어 두었어요.</p>`;

  const title = fitTitle([`게임 쿠폰 코드 모음 (${mon}) — 입력 방법까지 | ECM 쿠폰`, `게임 쿠폰 코드 모음 (${mon}) | ECM 쿠폰`, '게임 쿠폰 코드 모음 | ECM 쿠폰']);
  const desc = fitDesc([`게임 ${withPage.length}종의 쿠폰 코드와 입력 방법을 한곳에. 새 쿠폰과 마감 임박 코드를 확인 날짜와 함께 봅니다.`, `게임 ${withPage.length}종 쿠폰 코드와 입력 방법. 새 쿠폰·마감 임박 코드를 날짜와 함께.`]);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '게임 쿠폰 코드 모음', description: desc, url: SITE + '/game/', inLanguage: 'ko', dateModified: version,
      isPartOf: { '@type': 'WebSite', name: 'ECM 쿠폰', url: SITE + '/' } },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '게임별 쿠폰 코드 페이지', numberOfItems: withPage.length,
      itemListElement: withPage.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: `${g.title} 쿠폰 코드`, url: `${SITE}/game/${g.id}.html` })) },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '게임 쿠폰', path: '/game/' }]),
  ];
  const html = pageShell({ title, desc, path: '/game/', ld, body, headerHtml, footerHtml });
  const dir = path.join(rootDir, 'game');
  fs.mkdirSync(dir, { recursive: true });
  return writeIfChanged(fs, path.join(dir, 'index.html'), html);
}

module.exports = { writeGameHub };
