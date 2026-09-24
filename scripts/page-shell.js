/**
 * 허브 페이지(게임 쿠폰 홈·쇼핑 할인 홈)와 쇼핑몰 페이지가 함께 쓰는 틀: <head>, 헤더, 푸터, 공통 스타일.
 * 헤더·푸터는 게임 페이지와 같은 것을 쓴다 (game-pages.js).
 */
const { GA_SNIPPET } = require('./analytics');

const SITE = 'https://ecm-coupon.com';
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = d => (d || '').replace(/-/g, '.');

/** 제목 후보 중 40자(네이버·구글 검색 결과 기준) 안에 드는 첫 번째 */
function fitTitle(cands) { return cands.find(t => t.length <= 40) || cands[cands.length - 1]; }
/** 메타 설명 후보 중 80자 안에 드는 첫 번째 */
function fitDesc(cands) { return cands.find(t => t.length <= 80) || cands[cands.length - 1].slice(0, 80); }

const HUB_CSS = `
    .ecm-hub { max-width: 72rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
    .hub-crumb { font-size: .8rem; color: var(--ink-3); margin: 0 0 .4rem; }
    .hub-crumb a { color: var(--ink-3); text-decoration: none; }
    .hub-crumb a:hover { color: var(--brown); text-decoration: underline; }
    .hub-head h1 { font-size: 1.75rem; font-weight: 900; letter-spacing: -.02em; line-height: 1.3; margin: .2rem 0 .4rem; }
    .hub-head h1 small { font-size: .9rem; font-weight: 600; color: var(--ink-3); }
    .hub-lede { color: var(--ink-2); font-size: .95rem; line-height: 1.75; margin: 0 0 1rem; max-width: 52rem; }
    .hub-stats { display: flex; flex-wrap: wrap; gap: .45rem; margin: 0 0 1.25rem; }
    .hub-stat { background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: .35rem .8rem; font-size: .8rem; font-weight: 700; color: var(--ink-2); }
    .hub-stat b { color: var(--brown); }
    .hub-chips { display: flex; gap: .4rem; overflow-x: auto; scrollbar-width: none; padding: .1rem 0 1rem; }
    .hub-chips::-webkit-scrollbar { display: none; }
    .hub-chip { flex: none; display: inline-flex; align-items: center; gap: .3rem; padding: .45rem .9rem; border-radius: 999px; border: 1px solid var(--line); background: #fff; font-weight: 700; font-size: .85rem; color: var(--ink); text-decoration: none; }
    .hub-chip:hover { border-color: var(--y-deep); background: var(--y-pale); }
    .hub-sec { margin: 1.5rem 0 2rem; scroll-margin-top: 84px; }
    .hub-sec > h2 { font-size: 1.2rem; font-weight: 900; margin: 0 0 .75rem; display: flex; align-items: baseline; gap: .45rem; flex-wrap: wrap; }
    .hub-sec > h2 small { font-weight: 600; color: var(--ink-3); font-size: .8rem; }
    .hub-sec h3 { font-size: .78rem; font-weight: 800; color: var(--ink-3); letter-spacing: .04em; margin: 1rem 0 .5rem; }
    .hub-more { font-size: .85rem; margin: .6rem 0 0; }
    .hub-more a, .hub-link { color: var(--brown); font-weight: 800; text-decoration: none; }
    .hub-more a:hover, .hub-link:hover { text-decoration: underline; }

    .hub-rows { display: grid; grid-template-columns: minmax(0, 1fr); gap: .5rem; }
    .hub-row { display: flex; align-items: center; gap: .75rem; min-width: 0; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: .7rem .9rem; color: inherit; text-decoration: none; }
    .hub-row:hover { border-color: var(--y-deep); }
    .hub-ico { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; background: var(--y-pale); display: grid; place-items: center; font-size: 1.2rem; }
    .hub-row .main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: .1rem; }
    .hub-row .t { font-weight: 800; font-size: .92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hub-row .d { font-size: .78rem; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hub-row .meta { flex-shrink: 0; display: flex; align-items: center; gap: .3rem; font-size: .75rem; font-weight: 800; color: var(--ink-3); }

    .hub-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
    .hub-tile { position: relative; display: flex; flex-direction: column; gap: .5rem; min-width: 0; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: .85rem; color: inherit; text-decoration: none; }
    .hub-tile:hover { border-color: var(--y-deep); box-shadow: 0 6px 16px rgba(0,0,0,.05); }
    .hub-tile .top { display: flex; align-items: center; gap: .55rem; min-width: 0; }
    .hub-tile .hub-ico { width: 36px; height: 36px; font-size: 1.1rem; border-radius: 10px; }
    .hub-tile .name { min-width: 0; font-weight: 800; font-size: .9rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hub-tile .sub { font-size: .75rem; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hub-tile .foot { display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; margin-top: auto; }
    .hub-badge { display: inline-flex; align-items: center; font-size: .72rem; font-weight: 800; padding: .15rem .55rem; border-radius: 999px; background: var(--y); color: var(--ink); white-space: nowrap; }
    .hub-badge.muted { background: #F4F2E8; color: var(--ink-3); }
    .hub-badge.due { background: #FFEDD5; color: #9A3412; }

    .hub-shops { display: grid; grid-template-columns: minmax(0, 1fr); gap: .6rem; }
    .hub-shop { display: flex; flex-direction: column; gap: .5rem; min-width: 0; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: .9rem 1rem; }
    .hub-shop .top { display: flex; align-items: center; gap: .65rem; min-width: 0; }
    .hub-shop .hub-ico { border-radius: 999px; }
    .hub-shop .name { font-weight: 800; font-size: .95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hub-shop .benefit { font-size: .78rem; font-weight: 800; color: var(--brown); }
    .hub-shop .tip { font-size: .83rem; color: var(--ink-2); line-height: 1.6; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .hub-shop .foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-top: auto; font-size: .75rem; color: var(--ink-3); }
    .hub-shop .foot a { color: var(--brown); font-weight: 800; text-decoration: none; white-space: nowrap; }
    .hub-shop .foot a:hover { text-decoration: underline; }
    .hub-checked { display: inline-flex; align-items: center; gap: .25rem; }
    .hub-checked.no { color: #B45309; }

    .hub-note { background: var(--y-pale); border: 1px solid #F3E9B8; border-radius: 14px; padding: .9rem 1.1rem; font-size: .85rem; color: var(--ink-2); line-height: 1.75; margin: 1rem 0; }
    .hub-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: .35rem; }
    .hub-list a { display: block; padding: .55rem .75rem; border-radius: 10px; background: #fff; border: 1px solid var(--line); color: var(--ink); font-weight: 700; font-size: .88rem; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hub-list a:hover { border-color: var(--y-deep); }

    .hub-table { width: 100%; border-collapse: collapse; font-size: .9rem; margin: .5rem 0 1rem; background: #fff; }
    .hub-table th, .hub-table td { border: 1px solid var(--line); padding: .55rem .7rem; text-align: left; vertical-align: top; line-height: 1.6; }
    .hub-table th { background: var(--y-pale); font-weight: 800; white-space: nowrap; }
    .ecm-nowrap { white-space: nowrap; }
    .hub-prose p, .hub-prose li { font-size: .95rem; line-height: 1.8; color: var(--ink-2); }
    .hub-prose ul, .hub-prose ol { padding-left: 1.3rem; margin: 0 0 1rem; }
    details.hub-faq { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: .7rem 1rem; margin-bottom: .5rem; }
    details.hub-faq summary { cursor: pointer; font-weight: 700; font-size: .95rem; }
    details.hub-faq p { margin: .6rem 0 0; font-size: .92rem; line-height: 1.75; color: var(--ink-2); }

    @media (min-width: 640px) {
      .hub-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .hub-shops { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hub-rows { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hub-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (min-width: 1024px) {
      .hub-head h1 { font-size: 2rem; }
      .hub-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .hub-shops { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
`;

/**
 * 페이지 한 장. path 는 사이트 안 주소('/game/', '/shop/musinsa.html'), ld 는 JSON-LD 객체 배열.
 * headerHtml·footerHtml 은 순환 참조를 피하려고 호출하는 쪽에서 넘긴다.
 */
function pageShell({ title, desc, path, ld = [], style = '', body, ogType = 'website', headerHtml, footerHtml }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  ${GA_SNIPPET}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="/assets/mascot.svg">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="ECM 쿠폰 (Every Coupon Matters)">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/ecm.css">
  <script src="/assets/ecm.js" defer></script>
  <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></noscript>
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"></noscript>
${ld.map(o => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n')}
  <style>${HUB_CSS}${style}
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
${headerHtml()}

  <main class="ecm-hub flex-1 w-full">
${body}
  </main>

${footerHtml()}
</body>
</html>
`;
}

function breadcrumbLd(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path })) };
}

/** 내용이 같으면 쓰지 않는다 (git 이력이 빌드마다 흔들리지 않게) */
function writeIfChanged(fs, file, html) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === html) return false;
  fs.writeFileSync(file, html);
  return true;
}

module.exports = { SITE, esc, fmt, fitTitle, fitDesc, pageShell, breadcrumbLd, writeIfChanged, HUB_CSS };
