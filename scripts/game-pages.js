/**
 * 게임별 쿠폰 페이지를 만든다: /game/<id>.html
 *
 * 쿠폰이 전부 첫 화면 한 장에 몰려 있으면 "원신 쿠폰"으로 검색한 사람이 메인에 떨어져
 * 헤맨다. 게임마다 페이지를 두면 검색은 그 페이지로 바로 오고, 검색엔진에도 페이지가
 * 게임 수만큼 생긴다. 내용이 없는 페이지를 만들면 오히려 손해라, 살아 있는 코드가 있거나
 * 입력 방법이 확인된 게임만 만든다. 조건에서 빠진 게임의 페이지는 지운다.
 *
 * prerender.js 가 호출한다. 카탈로그가 바뀔 때마다 다시 생성되므로 손으로 고치지 않는다.
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://ecm-coupon.com';
const AUTHOR_NAME = '겜대';

const GENRE_LABELS = { mmorpg: 'MMORPG', rpg: '수집형/RPG', action: '액션/오픈월드', fps: 'FPS/슈팅', sports: '스포츠/전략' };
const PLATFORM_LABELS = { pc: 'PC', mobile: '모바일', ps5: 'PS5', switch: '닌텐도 스위치', cross: '크로스플랫폼', roblox: '로블록스' };

const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = d => (d || '').replace(/-/g, '.');

/** 페이지를 만들 자격: 살아 있는 코드가 있거나, 입력 방법이 확인된 게임 */
function qualifies(g, activeOf) {
  return activeOf(g).length > 0 || !!(g.redeemHow && g.redeemHow.trim());
}

function evaluate(expireDate, today) {
  if (!expireDate || expireDate === '상시' || /9999/.test(expireDate)) return { active: true, text: '상시 유효', left: null };
  const t = new Date(expireDate);
  if (isNaN(t.getTime())) return { active: true, text: '상시 유효', left: null };
  const left = Math.ceil((t.getTime() - today.getTime()) / 86400000);
  if (left >= 0) return { active: true, text: left === 0 ? '오늘 마감' : `D-${left}`, left };
  return { active: false, text: `${-left}일 전 만료`, left };
}

function headerHtml() {
  return `  <header id="siteHeader" class="ecm-header">
    <div class="ecm-header-inner">
      <a href="/" class="ecm-logo" aria-label="ECM 홈">
        <img class="ecm-logo-mark" src="/assets/mascot.svg" alt="" width="36" height="36">
        <span>ECM</span>
      </a>
      <nav class="ecm-menu" aria-label="주 메뉴">
        <button type="button" class="ecm-menu-btn" data-menu="games" aria-haspopup="true" aria-expanded="false">게임 쿠폰 <i class="fa-solid fa-chevron-down"></i></button>
        <button type="button" class="ecm-menu-btn" data-menu="shops" aria-haspopup="true" aria-expanded="false">쇼핑 할인 <i class="fa-solid fa-chevron-down"></i></button>
        <button type="button" class="ecm-menu-btn" data-menu="blog" aria-haspopup="true" aria-expanded="false">블로그 <i class="fa-solid fa-chevron-down"></i></button>
      </nav>
      <form class="ecm-search" role="search" action="/" method="get">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="search" name="q" placeholder="ECM에서 검색" aria-label="ECM에서 검색" autocomplete="off">
      </form>
      <a href="/" class="ecm-report"><i class="fa-solid fa-ticket"></i> 쿠폰 모음</a>
      <button type="button" id="burgerBtn" class="ecm-burger" aria-label="메뉴 열기" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
    </div>
    <div id="megaMenuWrap" class="ecm-mega-wrap">
      <div class="ecm-drawer">
        <div class="ecm-drawer-head"><span>메뉴</span><button type="button" class="ecm-drawer-close" data-close-menu aria-label="메뉴 닫기"><i class="fa-solid fa-xmark"></i></button></div>
        <div id="megaGridContainer"></div>
        <div class="ecm-drawer-links">
          <a href="/#games">🎮 게임 쿠폰</a>
          <a href="/#fashion">🛍️ 쇼핑 할인</a>
          <a href="/">🏠 홈</a>
        </div>
      </div>
    </div>
  </header>`;
}

function footerHtml() {
  return `  <footer class="bg-white border-t border-slate-200 py-8 text-slate-500 text-xs">
    <div class="max-w-7xl mx-auto px-4 space-y-3 text-center sm:text-left">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>&copy; 2026 ecm-coupon.com (ECM). All rights reserved.</p>
        <nav class="flex flex-wrap justify-center gap-4" aria-label="사이트 정보">
          <a href="/about.html" class="ecm-link">ECM 소개</a>
          <a href="/contact.html" class="ecm-link">문의·제보</a>
          <a href="/privacy.html" class="ecm-link">개인정보처리방침</a>
          <a href="/terms.html" class="ecm-link">이용약관</a>
        </nav>
      </div>
      <p class="text-[11px] leading-relaxed">ECM은 각 게임사·쇼핑몰의 공식 파트너가 아니며, 게시된 쿠폰·혜택 정보는 공개된 자료를 확인해 정리한 참고용 정보입니다. 실제 적용 여부는 각 공식 사이트에서 다시 확인해 주세요. 운영자: ${AUTHOR_NAME} · 문의: contact@ecm-coupon.com</p>
    </div>
  </footer>`;
}

/** 게임 성격에 따라 다른 주의사항. 페이지마다 같은 문장이 반복되면 검색엔진이 얇은 페이지로 본다. */
function tipsFor(g) {
  const isRoblox = (g.platforms || []).includes('roblox');
  const tips = [];
  if (isRoblox) {
    tips.push('로블록스 코드는 <strong>대소문자를 구분</strong>합니다. 복사 버튼으로 옮기면 틀릴 일이 없습니다.');
    tips.push('코드는 개발팀이 예고 없이 닫습니다. 위 표의 만료일은 공지가 없을 때 <strong>확인일 기준 30일</strong>로 적은 것이라, 그 전에 닫힐 수도 있습니다.');
    tips.push('코드 입력 칸은 게임마다 다른 곳에 있습니다. 위 "입력 방법"의 버튼 위치를 그대로 따라가세요.');
    tips.push('한 코드는 계정당 한 번만 됩니다. "이미 사용됨"이 뜨면 그 계정으로는 받은 겁니다.');
  } else {
    tips.push('코드는 계정당 <strong>한 번</strong>만 쓸 수 있습니다. 같은 코드를 다른 서버·캐릭터에서 다시 넣어도 받지 못합니다.');
    tips.push('보상은 보통 게임 안 <strong>우편함</strong>으로 옵니다. 우편함이 가득 차 있으면 못 받는 경우가 있으니 먼저 비우세요.');
    if ((g.platforms || []).includes('cross')) tips.push('여러 플랫폼으로 나온 게임은 <strong>같은 계정</strong>이면 어디서 넣어도 한 번으로 칩니다.');
    tips.push('만료일이 "상시"인 코드도 게임사가 예고 없이 닫을 수 있습니다. 안 되면 만료된 것입니다.');
  }
  return tips;
}

function faqFor(g) {
  const isRoblox = (g.platforms || []).includes('roblox');
  const name = g.title;
  const faq = [
    { q: `${name} 쿠폰은 어디서 입력하나요?`,
      a: g.redeemHow ? `${g.redeemHow}${g.redeemUrl ? ' 입력 페이지 주소는 위 "입력 방법"에 있습니다.' : ''}` : '입력 위치는 확인 중입니다. 공식 홈페이지나 게임 안 설정 메뉴에서 쿠폰/교환 코드 입력란을 찾아 주세요.' },
    { q: '코드를 넣었는데 "유효하지 않은 코드"라고 나와요.',
      a: isRoblox ? '대소문자·띄어쓰기를 확인하고, 그래도 안 되면 개발팀이 코드를 닫은 것입니다. 이 페이지는 하루 두 번 다시 확인해 닫힌 코드를 내립니다.'
                  : '대소문자·공백을 확인하세요. 코드가 정확한데도 안 되면 만료됐거나 이미 그 계정으로 사용한 코드입니다.' },
    { q: '새 코드는 언제 올라오나요?',
      a: isRoblox ? '개발팀이 업데이트·좋아요 달성·버그 보상으로 수시로 냅니다. ECM은 개발팀 공식 채널과 코드 전문 매체를 하루 두 번 확인해 올립니다.'
                  : '게임사가 업데이트·방송·이벤트 때 냅니다. ECM은 공식 채널을 4시간마다 확인해서 확인된 코드만 올립니다.' },
  ];
  return faq;
}

function pageHtml(g, ctx) {
  const { today, posts, allGames, version, firstSeen } = ctx;
  const coupons = g.coupons || [];
  const evald = coupons.map(c => ({ c, ev: evaluate(c.expireDate, today) }));
  const active = evald.filter(x => x.ev.active);
  const expired = evald.filter(x => !x.ev.active);
  const isRoblox = (g.platforms || []).includes('roblox');
  const ym = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
  const url = `${SITE}/game/${g.id}.html`;
  const redeemUrl = g.redeemUrl || g.officialUrl || '';
  const platforms = (g.platforms || []).map(p => PLATFORM_LABELS[p] || p).join(' · ');
  const related = posts.filter(p => p.title.includes(g.title.split(' (')[0].split(':')[0]));
  const siblings = allGames.filter(x => x.id !== g.id && x.genre === g.genre && qualifies(x, ctx.activeOf)).slice(0, 6);

  const title = active.length
    ? `${g.title} 쿠폰 코드 ${active.length}개 (${ym}) — 입력 방법 | ECM`
    : `${g.title} 쿠폰 코드 입력 방법 (${ym}) | ECM`;
  const desc = active.length
    ? `${g.title}에서 지금 쓸 수 있는 쿠폰 코드 ${active.length}개와 보상, 만료일, 입력 방법. 공식 채널 확인 후 갱신.`
    : `${g.title} 쿠폰(교환 코드) 입력 위치와 방법. 새 코드가 확인되면 이 페이지에 올라옵니다.`;

  const codeRows = active.map(({ c, ev }) => {
    const seen = firstSeen[g.id + ':' + c.code];
    const isNew = seen && (today.getTime() - new Date(seen).getTime()) / 86400000 <= 7 && seen > '2026-09-21';
    return `<tr>
          <td><code class="ecm-code">${esc(c.code)}</code>${isNew ? ' <span class="ecm-pill new">NEW</span>' : ''}</td>
          <td>${esc(c.reward || '보상 확인')}</td>
          <td class="ecm-nowrap">${esc(ev.text)}${c.expireDate && c.expireDate !== '상시' ? `<br><small>${esc(c.expireDate)}</small>` : ''}</td>
          <td class="ecm-nowrap"><button type="button" class="ecm-btn-primary" data-copy="${esc(c.code)}"><i class="fa-regular fa-copy"></i> 복사</button></td>
        </tr>`;
  }).join('\n');

  const expiredRows = expired.map(({ c, ev }) => `<tr><td><code class="ecm-code is-dead">${esc(c.code)}</code></td><td>${esc(c.reward || '')}</td><td>${esc(ev.text)}</td></tr>`).join('\n');

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url,
      dateModified: version, inLanguage: 'ko',
      author: { '@type': 'Person', name: AUTHOR_NAME, url: `${SITE}/about.html` },
      publisher: { '@type': 'Organization', name: 'ECM (Every Coupon Matters)', url: SITE },
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ECM', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '게임 쿠폰', item: SITE + '/#games' },
        { '@type': 'ListItem', position: 3, name: g.title, item: url },
      ] },
    },
    active.length ? {
      '@context': 'https://schema.org', '@type': 'ItemList', name: `${g.title} 쿠폰 코드`, numberOfItems: active.length,
      itemListElement: active.map(({ c }, i) => ({ '@type': 'ListItem', position: i + 1, name: c.code, description: c.reward || '' })),
    } : null,
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqFor(g).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="/assets/mascot.svg">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="ECM (Every Coupon Matters)">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/ecm.css">
  <script src="/assets/ecm.js" defer></script>
  <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></noscript>
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"></noscript>
${ld.map(o => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n')}
  <style>
    .ecm-page { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
    .ecm-page h1 { font-size: 1.7rem; font-weight: 900; letter-spacing: -.02em; margin: .5rem 0 .4rem; line-height: 1.3; }
    .ecm-page h2 { font-size: 1.15rem; font-weight: 800; margin: 2rem 0 .6rem; }
    .ecm-page p, .ecm-page li { font-size: .95rem; line-height: 1.8; color: var(--ink-2); }
    .ecm-page ul, .ecm-page ol { padding-left: 1.3rem; margin: 0 0 1rem; }
    .ecm-page a { color: var(--brown); font-weight: 700; }
    .ecm-game-head { display: flex; align-items: center; gap: .8rem; }
    .ecm-game-head .ecm-icon { width: 52px; height: 52px; font-size: 1.6rem; border-radius: 14px; }
    .ecm-game-meta { font-size: .8rem; color: var(--ink-3); display: flex; flex-wrap: wrap; gap: .4rem .8rem; margin: .2rem 0 1.2rem; }
    .ecm-page table { width: 100%; border-collapse: collapse; font-size: .9rem; margin: .5rem 0 1rem; background: #fff; }
    .ecm-page th, .ecm-page td { border: 1px solid var(--line); padding: .55rem .7rem; text-align: left; vertical-align: top; line-height: 1.6; }
    .ecm-page th { background: var(--y-pale); font-weight: 800; white-space: nowrap; }
    .ecm-code { font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 700; background: #F4F2E8; padding: .15rem .45rem; border-radius: 6px; word-break: break-all; }
    .ecm-code.is-dead { text-decoration: line-through; color: var(--ink-3); font-weight: 500; }
    .ecm-redeem-box { background: var(--y-pale); border: 1px solid #F3E9B8; border-radius: 14px; padding: 1rem 1.2rem; margin: .5rem 0 1rem; }
    .ecm-redeem-box p { margin: 0 0 .5rem; }
    .ecm-redeem-box p:last-child { margin: 0; }
    .ecm-empty { background: #fff; border: 1px dashed var(--line); border-radius: 14px; padding: 1rem 1.2rem; color: var(--ink-3); }
    .ecm-page .ecm-btn-primary { font-size: .75rem; padding: .35rem .7rem; }
    .ecm-nowrap { white-space: nowrap; }
    .ecm-sib { display: flex; flex-wrap: wrap; gap: .4rem; }
    .ecm-sib a { display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .75rem; border: 1px solid var(--line); border-radius: 999px; background: #fff; font-size: .85rem; text-decoration: none; }
    .ecm-sib a:hover { border-color: var(--y-deep); background: var(--y-pale); }
    details.ecm-faq { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: .7rem 1rem; margin-bottom: .5rem; }
    details.ecm-faq summary { cursor: pointer; font-weight: 700; font-size: .95rem; }
    details.ecm-faq p { margin: .6rem 0 0; }
    @media (max-width: 640px) { .ecm-page table { font-size: .82rem; } .ecm-page th, .ecm-page td { padding: .45rem .5rem; } }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
${headerHtml()}

  <main class="ecm-page flex-1 w-full">
    <article>
    <nav aria-label="현재 위치" style="font-size:.8rem;color:var(--ink-3);margin-bottom:.5rem"><a href="/">ECM</a> › <a href="/#games">게임 쿠폰</a> › ${esc(g.title)}</nav>
    <div class="ecm-game-head">
      <div class="ecm-icon">${g.icon || '🎮'}</div>
      <div>
        <h1>${esc(g.title)} 쿠폰 코드${active.length ? ` ${active.length}개` : ''} <small style="font-weight:600;color:var(--ink-3);font-size:.9rem">(${ym})</small></h1>
      </div>
    </div>
    <div class="ecm-game-meta">
      <span>${esc(g.publisher || '')}</span><span>·</span><span>${esc(g.category || GENRE_LABELS[g.genre] || '')}</span><span>·</span><span>${esc(platforms)}</span><span>·</span><span>쿠폰 확인 ${esc(fmt(version))}</span>
    </div>

    <h2 id="codes">지금 쓸 수 있는 코드${active.length ? ` (${active.length})` : ''}</h2>
${active.length ? `    <table>
      <thead><tr><th>코드</th><th>보상</th><th>만료</th><th></th></tr></thead>
      <tbody>
${codeRows}
      </tbody>
    </table>
    <p style="font-size:.82rem;color:var(--ink-3)">코드는 ${isRoblox ? '개발팀 공식 채널과 코드 전문 매체 2곳' : '게임사 공식 채널'}에서 확인한 것만 올립니다. 등록일이 7일 안이면 NEW 표시가 붙습니다.</p>`
: `    <div class="ecm-empty">지금은 살아 있는 코드가 없습니다. ${isRoblox ? '개발팀이 새 코드를 내면' : '게임사가 새 코드를 내면'} 이 페이지에 바로 올라옵니다. 아래 입력 방법을 미리 알아 두면 코드가 나왔을 때 바로 쓸 수 있습니다.</div>`}

    <h2 id="how">입력 방법</h2>
    <div class="ecm-redeem-box">
      <p><strong>🧭 어디서:</strong> ${g.redeemHow ? esc(g.redeemHow) : '확인 중 — 공식 사이트나 게임 안 설정 메뉴에서 쿠폰/교환 코드 입력란을 찾아 주세요.'}</p>
      ${redeemUrl ? `<p><a href="${esc(redeemUrl)}" target="_blank" rel="noopener noreferrer">${g.redeemUrl ? '쿠폰 입력 페이지 열기' : '공식 사이트 열기'} ↗</a></p>` : ''}
    </div>
    <ol>
      <li>위 표에서 <strong>복사</strong>를 누릅니다. 코드가 그대로 복사됩니다.</li>
      <li>${g.redeemHow ? esc(g.redeemHow.split(' → ')[0].split(' > ')[0]) : '쿠폰 입력 화면'}으로 갑니다.</li>
      <li>붙여 넣고 확인을 누릅니다. 보상은 ${isRoblox ? '바로 지급되거나 게임 안 알림으로' : '보통 게임 안 우편함으로'} 옵니다.</li>
    </ol>

    <h2 id="tips">주의할 점</h2>
    <ul>
${tipsFor(g).map(t => `      <li>${t}</li>`).join('\n')}
    </ul>

${expired.length ? `    <h2 id="expired">최근 만료된 코드</h2>
    <p>다시 넣어도 되지 않습니다. 다른 곳에서 "아직 된다"고 적혀 있어도 이 목록에 있으면 끝난 코드입니다.</p>
    <table>
      <thead><tr><th>코드</th><th>보상이었던 것</th><th>만료</th></tr></thead>
      <tbody>
${expiredRows}
      </tbody>
    </table>
` : ''}
${related.length ? `    <h2 id="related">${esc(g.title)} 관련 글</h2>
    <ul>
${related.map(p => `      <li><a href="${esc(p.url)}">${esc(p.title)}</a> <small>${esc(fmt(p.date))}</small></li>`).join('\n')}
    </ul>
` : ''}
    <h2 id="faq">자주 묻는 질문</h2>
${faqFor(g).map(f => `    <details class="ecm-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}

${siblings.length ? `    <h2 id="more">같은 장르의 다른 게임 쿠폰</h2>
    <div class="ecm-sib">
${siblings.map(x => `      <a href="/game/${esc(x.id)}.html">${x.icon || '🎮'} ${esc(x.title)}${ctx.activeOf(x).length ? ` <span class="ecm-count">${ctx.activeOf(x).length}</span>` : ''}</a>`).join('\n')}
    </div>
` : ''}
    <p style="margin-top:2rem;font-size:.85rem"><a href="/#games">← 전체 게임 쿠폰 목록</a></p>
    </article>
  </main>

${footerHtml()}
  <div id="copyToast" class="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-50 hidden px-4 py-2 rounded-full ecm-toast text-xs font-bold shadow-2xl">복사했습니다</div>
  <script>
    // 복사 버튼: 코드를 그대로 클립보드로
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-copy]');
      if (!b) return;
      navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
        var t = document.getElementById('copyToast');
        t.classList.remove('hidden');
        setTimeout(function () { t.classList.add('hidden'); }, 1500);
      });
    });
  </script>
</body>
</html>
`;
}

/**
 * 게임 페이지를 만들고, 자격을 잃은 게임의 페이지는 지운다.
 * @returns {{written: number, removed: number, ids: string[]}}
 */
function writeGamePages(rootDir, games, posts, version, firstSeen) {
  const dir = path.join(rootDir, 'game');
  fs.mkdirSync(dir, { recursive: true });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeOf = g => (g.coupons || []).filter(c => evaluate(c.expireDate, today).active);
  const ctx = { today, posts, allGames: games, version, firstSeen, activeOf };
  const keep = new Set();
  let written = 0;
  for (const g of games) {
    if (!qualifies(g, activeOf)) continue;
    const file = path.join(dir, `${g.id}.html`);
    const html = pageHtml(g, ctx);
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (prev !== html) { fs.writeFileSync(file, html); written++; }
    keep.add(`${g.id}.html`);
  }
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html') && !keep.has(f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
  }
  return { written, removed, ids: [...keep].map(f => f.replace(/\.html$/, '')) };
}

module.exports = { writeGamePages, qualifies };
