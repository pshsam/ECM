#!/usr/bin/env node
/**
 * index.html의 카탈로그를 HTML에 미리 박아 넣는다.
 *
 * 왜 필요한가:
 *   목록 7개(게임/패션/장보기/OTT/뷰티/배달/여행)가 전부 자바스크립트로만 그려져서,
 *   서버가 보내는 HTML에는 빈 <div>만 있었다. 구글은 자바스크립트를 실행해주지만
 *   네이버(Yeti)·빙·AI 크롤러 상당수는 실행하지 않는다. 한국 쿠폰 사이트인데
 *   정작 네이버가 쿠폰을 한 글자도 못 읽는 상태였다.
 *
 * 어떻게 하는가:
 *   마크업을 두 벌로 만들면 반드시 어긋나므로, 페이지의 스크립트를 그대로 실행한다.
 *   최소한의 DOM 흉내만 만들어 놓고 init()을 돌린 뒤, 각 그리드에 채워진 innerHTML을
 *   그대로 꺼내 <!--PRERENDER:xxx--> 마커 사이에 써 넣는다. 브라우저에서는 같은
 *   스크립트가 같은 자리를 다시 채우므로 화면 동작은 달라지지 않는다.
 *
 * 쿠폰을 갱신한 뒤에는 반드시 다시 실행해야 한다:
 *   node scripts/prerender.js
 */

const fs = require('fs');
const path = require('path');
const { writeGamePages, qualifies, headerHtml, footerHtml, evaluate, GENRE_LABELS } = require('./game-pages');
const { writeGameHub } = require('./hubs');
const { loadShopDetails, shopQualifies, writeShopHub, writeShopPages } = require('./shop-pages');
const { writeLlmsTxt } = require('./llms-txt');
const { ensureAnalytics } = require('./analytics');

const FILE = path.join(__dirname, '..', 'index.html');
// mega = 헤더 드롭다운 메뉴, updates = 최신 업데이트 목록. 둘 다 카탈로그에서 만들어지므로 같이 미리 렌더링한다.
const CATS = ['mega', 'updates', 'deadline', 'articles', 'tiles', 'game', 'fashion', 'grocery', 'ott', 'beauty', 'delivery', 'travel'];
const SEEN_FILE = path.join(__dirname, '..', 'data', 'coupon-seen.json');
// 글쓴이 표기. 여기만 바꾸면 모든 글의 글쓴이 줄과 스키마가 바뀐다.
const AUTHOR_NAME = '겜대';
const AUTHOR_ROLE = 'ECM 쿠폰 운영자';

function makeDom() {
  const grids = {};
  const byId = new Map();

  function el(id) {
    return {
      id,
      _html: '',
      innerText: '',
      textContent: '',
      className: '',
      value: id === 'sortSelect' ? 'popular' : 'all',
      hidden: false,
      disabled: false,
      dataset: {},
      style: {},
      get innerHTML() { return this._html; },
      set innerHTML(v) {
        this._html = v;
        const m = /^(.*)GridContainer$/.exec(id);
        if (m) grids[m[1]] = v;
      },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {},
      querySelector() { return el(id + ' >child'); },
      querySelectorAll() { return []; },
      appendChild() {},
      setAttribute() {},
      removeAttribute() {},
      cloneNode() { return el(id); },
      closest() { return null; },
    };
  }

  const document = {
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, el(id));
      return byId.get(id);
    },
    // 카테고리 라벨·옵션 텍스트를 고쳐 쓰는 용도로만 쓰이므로 빈 껍데기면 충분하다
    querySelector() { return el('sel'); },
    querySelectorAll() { return []; },
    createElement(tag) { return el(tag); },
    addEventListener() {},
    documentElement: el('html'),
    body: el('body'),
  };

  const listeners = {};
  const window = {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type) { (listeners[type] || []).forEach(fn => fn()); },
    getSelection() { return null; },
  };

  // 캐시가 비어 있어야 index.html에 적힌 initialGameCatalog가 그대로 쓰인다
  const localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

  return { document, window, localStorage, grids };
}

function run(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('페이지 스크립트를 찾지 못했습니다.');

  const dom = makeDom();
  const body = m[1] + `
    ;window.fire('DOMContentLoaded');
    return {
      games: games,
      version: CATALOG_VERSION,
      shop: { cats: SHOP_CATS, catalogs: SHOP_CATALOGS, subs: SUB_LABELS, labels: CATEGORY_MENU_LABEL, icons: CATEGORY_ICON },
      groups: [
        { label: '패션몰 할인', items: rawFashionCatalog, blurb: '쿠폰북·웰컴 혜택 정보를 제공합니다.' },
        { label: '장보기 & 마트', items: rawGroceryCatalog, blurb: '새벽배송·유기농·대용량 장보기 할인 바우처 정보를 제공합니다.' },
        { label: 'OTT·구독 서비스', items: rawOttCatalog, blurb: '번들 할인, 무료 체험, 결합 할인 정보를 제공합니다.' },
        { label: '뷰티·화장품 할인', items: rawBeautyCatalog, blurb: '세일·쿠폰 정보를 제공합니다.' },
        { label: '배달음식·외식 할인', items: rawDeliveryCatalog, blurb: '첫주문 쿠폰과 앱 전용 할인 정보를 제공합니다.' },
        { label: '여행·숙박 할인', items: rawTravelCatalog, blurb: '국내외 숙박·투어 예약 할인 정보를 제공합니다.' },
      ],
    };
  `;
  const fn = new Function('document', 'window', 'localStorage', 'console', 'navigator', body);
  const out = fn(dom.document, dom.window, dom.localStorage, console, { clipboard: null });
  return { grids: dom.grids, ...out };
}

/**
 * 검색엔진이 "이 페이지에 뭐가 몇 개 있는지" 바로 읽도록 목록 스키마를 만든다.
 *
 * 카드 마크업에는 게임 이름과 쿠폰 개수까지만 나오고 코드 자체는 클릭해야 열리는
 * 창 안에 있다. 코드는 방문자가 볼 수 있는 내용이므로, 여기 구조화 데이터에 같이
 * 실어서 크롤러도 읽을 수 있게 한다(숨긴 텍스트를 본문에 심는 방식은 쓰지 않는다).
 */
function itemListJsonLd(games) {
  const withCoupons = games.filter(g => (g.coupons || []).length > 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '게임 쿠폰 코드 목록',
    description: '현재 ECM에서 확인 가능한 게임별 쿠폰 코드 목록입니다.',
    numberOfItems: withCoupons.length,
    itemListElement: withCoupons.map((g, i) => {
      const codes = (g.coupons || [])
        .map(c => `${c.code} (${c.reward})`)
        .join(', ');
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Thing',
          name: `${g.title} 쿠폰 코드`,
          description: `${g.title}(${g.category}) 쿠폰 코드: ${codes}`,
          url: `https://ecm-coupon.com/game/${g.id}.html`,
        },
      };
    }),
  };
}

/**
 * 자바스크립트를 실행하지 않는 크롤러·브라우저용 요약.
 * 예전에는 손으로 적어둬서 제휴 수(50개/20개)와 게임 목록이 실제 데이터와 어긋나 있었다.
 * 이제 카탈로그에서 그대로 만들어 어긋날 수 없게 한다.
 */
function noscriptHtml(data) {
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const names = arr => arr.map(x => esc(x.title || x.name)).join(', ');
  const section = (heading, body) => `      <h2>${esc(heading)}</h2>\n      <p>${body}</p>\n`;

  let out = '';
  out += section(
    'ECM 쿠폰 (Every Coupon Matters) - 장르별 게임 쿠폰 & 올인원 할인 허브',
    'ECM은 MMORPG, 수집형 RPG, 액션, FPS, 스포츠 등 장르별 대작 게임의 실시간 검증 쿠폰과 패션·장보기 할인 정보를 한곳에 모은 사이트입니다.'
  );
  out += section(
    `게임 쿠폰 (${data.games.length}종)`,
    `${names(data.games)} 등 PC·모바일·PS5·닌텐도 스위치 게임의 쿠폰 코드를 장르별로 정리해 제공합니다.`
  );
  for (const g of data.groups) {
    out += section(`${g.label} (${g.items.length}곳)`, `${names(g.items)}의 ${g.blurb}`);
  }
  out += '      <p>자세한 실시간 쿠폰 코드는 JavaScript를 활성화한 브라우저에서 확인하실 수 있습니다.</p>\n';
  return '\n' + out + '    ';
}

/** 홈에서 블로그 글로 바로 가는 링크 (검색엔진이 따라갈 수 있는 정적 링크) */
function blogLinksHtml(dir) {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();
  return '\n' + files.map(f => {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = (m ? m[1] : f).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return `        <li><a href="/blog/${f}" class="ecm-guide">${title}</a></li>`;
  }).join('\n') + '\n      ';
}

/**
 * sitemap.xml을 실제 파일 목록과 수정일로 다시 만든다.
 * 손으로 관리하던 때는 글을 추가해도 사이트맵에 빠지거나, lastmod가 전부 같은
 * 날짜로 박혀 있어 검색엔진에 "언제 바뀌었는지" 신호를 주지 못했다.
 */
function writeSitemap(rootDir, gameIds = [], extra = []) {
  const { execFileSync } = require('child_process');

  const lastModified = (relPath) => {
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', relPath], {
        cwd: rootDir, encoding: 'utf8',
      }).trim();
      if (out) return out;
    } catch (_) { /* 커밋 이력이 없으면 파일 시각으로 대신한다 */ }
    return fs.statSync(path.join(rootDir, relPath)).mtime.toISOString().slice(0, 10);
  };

  const posts = fs.readdirSync(path.join(rootDir, 'blog'))
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();

  const entries = [
    { loc: '/', file: 'index.html', freq: 'daily', priority: '1.0' },
    { loc: '/blog/index.html', file: 'blog/index.html', freq: 'weekly', priority: '0.8' },
    { loc: '/about.html', file: 'about.html', freq: 'monthly', priority: '0.5' },
    { loc: '/contact.html', file: 'contact.html', freq: 'monthly', priority: '0.4' },
    { loc: '/privacy.html', file: 'privacy.html', freq: 'yearly', priority: '0.3' },
    { loc: '/terms.html', file: 'terms.html', freq: 'yearly', priority: '0.3' },
    ...extra,
    ...gameIds.map(id => ({ loc: `/game/${id}.html`, file: `game/${id}.html`, freq: 'daily', priority: '0.8' })),
    ...posts.map(f => ({
      loc: `/blog/${f}`,
      file: `blog/${f}`,
      // 쿠폰 코드 글은 내용이 자주 바뀌니 더 자주 들러 달라고 알린다
      freq: /coupon-codes|preregister/.test(f) ? 'weekly' : 'monthly',
      priority: /complete-guide/.test(f) ? '0.8' : /coupon-codes/.test(f) ? '0.7' : '0.6',
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(e => [
      '  <url>',
      `    <loc>https://ecm-coupon.com${e.loc}</loc>`,
      `    <lastmod>${lastModified(e.file)}</lastmod>`,
      `    <changefreq>${e.freq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), xml);
  return entries.length;
}

/**
 * 쿠폰 등록일 장부.
 *
 * NEW 뱃지와 '최신 업데이트'는 "이 코드가 언제 처음 올라왔는지"를 알아야 한다.
 * 카탈로그에는 등록일이 없으므로 여기서 따로 적어 둔다. 장부에 없는 코드는
 * git 이력에서 그 코드가 처음 나타난 커밋 날짜를 찾고, 그것도 없으면(아직 커밋
 * 전) 카탈로그 갱신일(CATALOG_VERSION)을 쓴다. 장부가 커밋되지 않아도 git 이력이
 * 같은 답을 주므로 날짜가 흔들리지 않는다.
 */
function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); } catch (_) { return {}; }
}

function gitFirstSeen(needle, rootDir) {
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync('git', ['log', '--reverse', '--format=%cs', '-S', needle, '--', 'index.html'], {
      cwd: rootDir, encoding: 'utf8',
    }).trim();
    return out ? out.split('\n')[0] : null;
  } catch (_) { return null; }
}

function updateSeen(games, version, rootDir) {
  const seen = loadSeen();
  const today = new Date().toISOString().slice(0, 10);
  const fallback = /^\d{4}-\d{2}-\d{2}$/.test(version) ? version : today;
  let added = 0;
  const note = (key, needle) => {
    if (seen[key]) return;
    seen[key] = gitFirstSeen(needle, rootDir) || fallback;
    added++;
  };
  for (const g of games) {
    note('game:' + g.id, `id: "${g.id}"`);
    for (const c of (g.coupons || [])) note(g.id + ':' + c.code, `code: "${c.code}"`);
  }
  if (added || !fs.existsSync(SEEN_FILE)) {
    fs.mkdirSync(path.dirname(SEEN_FILE), { recursive: true });
    fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2) + '\n');
  }
  return { seen, added };
}

/**
 * 새 글에 썸네일이 없으면 만든다 (scripts/thumbnail.py).
 *
 * blog/index.html 카드의 분류 라벨과 글의 제목으로 blog/images/<slug>/thumb.jpg 를 만들고,
 * 글의 og:image 와 목록 카드에 붙인다. 이미 있으면 아무것도 하지 않는다.
 * python 이나 Pillow 가 없는 환경(일부 클라우드)에서는 건너뛰고 알려만 준다.
 */
function ensureThumbnails(blogDir, rootDir) {
  const { spawnSync } = require('child_process');
  const idxPath = path.join(blogDir, 'index.html');
  let idx;
  try { idx = fs.readFileSync(idxPath, 'utf8'); } catch (_) { return { made: 0, skipped: 0 }; }
  const KIND = { 'cat-game': 'game', 'cat-life': 'life', 'cat-platform': 'platform', 'cat-guide': 'guide' };
  const cardRe = /(<a href="\/blog\/([^"]+)\.html"[^>]*class="post-card[^"]*"[^>]*>\s*)(<div class="flex items-center justify-between gap-2 mb-2">\s*(?:<span class="flex[^"]*">)?<span class="cat-pill (cat-[a-z]+)">(?:<i[^>]*><\/i>)?\s*([^<]*)<\/span>)/g;
  let made = 0, skipped = 0, changed = false;
  idx = idx.replace(cardRe, (all, head, slug, rest, cat, label) => {
    const thumb = path.join(blogDir, 'images', slug, 'thumb.jpg');
    const postPath = path.join(blogDir, slug + '.html');
    if (!fs.existsSync(postPath)) return all;
    let post = fs.readFileSync(postPath, 'utf8');
    if (!fs.existsSync(thumb)) {
      const h1 = post.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const title = (h1 ? h1[1] : slug).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const kind = KIND[cat] || 'guide';
      const chip = kind === 'game' ? '게임 쿠폰 · ' + label.trim() : label.trim();
      const args = [path.join(rootDir, 'scripts', 'thumbnail.py'), '--title', title, '--kind', kind, '--label', chip, '--out', thumb];
      if (kind !== 'game') {
        const img = post.match(/<img[^>]*src="(\/blog\/images\/[^"]+)"/);
        if (img) args.push('--bg', path.join(rootDir, img[1].replace(/^\//, '')));
      }
      let ok = false;
      for (const py of ['python', 'python3', 'py']) {
        const r = spawnSync(py, args, { encoding: 'utf8' });
        if (r.status === 0 && fs.existsSync(thumb)) { ok = true; break; }
      }
      if (!ok) { skipped++; return all; }
      made++;
    }
    // 글의 공유 이미지
    const url = `https://ecm-coupon.com/blog/images/${slug}/thumb.jpg`;
    const post2 = post
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${url}$2`);
    if (post2 !== post) fs.writeFileSync(postPath, post2);
    // 목록 카드에 그림이 없으면 붙인다
    if (/class="post-thumb"/.test(head + rest)) return all;
    changed = true;
    const alt = (post.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ['', slug])[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/"/g, '&quot;');
    return head + `<img class="post-thumb" src="/blog/images/${slug}/thumb.jpg" alt="${alt}" width="1200" height="630" loading="lazy">\n    ` + rest;
  });
  if (changed) fs.writeFileSync(idxPath, idx);
  return { made, skipped };
}

/**
 * 블로그 글마다 BlogPosting 스키마를 넣는다.
 *
 * 글에는 FAQ·HowTo 스키마는 있는데 "언제 쓰고 언제 고친 글인지"를 말하는 Article 계열이
 * 없었다. 작성일은 blog/index.html 카드의 날짜, 수정일은 git 의 마지막 커밋 날짜를 쓴다.
 * <!--PRERENDER:article--> 마커 사이에 써 넣고, 마커가 없으면 </head> 앞에 만든다.
 */
function ensureArticleSchema(blogDir, rootDir) {
  const { execFileSync } = require('child_process');
  let idx;
  try { idx = fs.readFileSync(path.join(blogDir, 'index.html'), 'utf8'); } catch (_) { return 0; }
  const cardRe = /<a href="\/blog\/([^"]+)\.html"[^>]*class="post-card[\s\S]*?post-date">([\d.]+)</g;
  let m, n = 0;
  while ((m = cardRe.exec(idx)) !== null) {
    const slug = m[1], published = m[2].replace(/\./g, '-');
    const postPath = path.join(blogDir, slug + '.html');
    if (!fs.existsSync(postPath)) continue;
    let post = fs.readFileSync(postPath, 'utf8');
    const original = post;
    const title = (post.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ['', slug])[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const desc = (post.match(/<meta name="description" content="([^"]*)"/) || ['', ''])[1];
    let modified = published;
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', `blog/${slug}.html`], { cwd: rootDir, encoding: 'utf8' }).trim();
      if (out && out > published) modified = out;
    } catch (_) { /* git 이 없으면 작성일로 */ }
    const image = fs.existsSync(path.join(blogDir, 'images', slug, 'thumb.jpg'))
      ? `https://ecm-coupon.com/blog/images/${slug}/thumb.jpg` : 'https://ecm-coupon.com/og-image.png';
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description: desc,
      image,
      datePublished: published,
      dateModified: modified,
      inLanguage: 'ko',
      author: { '@type': 'Person', name: AUTHOR_NAME, jobTitle: AUTHOR_ROLE, url: 'https://ecm-coupon.com/about.html' },
      publisher: { '@type': 'Organization', name: 'ECM 쿠폰 (Every Coupon Matters)', url: 'https://ecm-coupon.com',
        logo: { '@type': 'ImageObject', url: 'https://ecm-coupon.com/og-image.png' } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://ecm-coupon.com/blog/${slug}.html` },
    };
    const block = `<!--PRERENDER:article-->\n  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n  </script>\n  <!--/PRERENDER:article-->`;
    let post2;
    // 공유 제목(og:title·twitter:title)은 네이버 서치어드바이저 기준 40자 이내. 넘으면 <title>(40자 이내)과 같게 맞춘다.
    const pageTitle = (post.match(/<title>([\s\S]*?)<\/title>/) || ['', ''])[1].trim();
    if (pageTitle && pageTitle.length <= 40) {
      post = post.replace(/(<meta (?:property="og:title"|name="twitter:title") content=")([^"]*)(")/g,
        (all, a, v, b) => (v.length > 40 ? a + pageTitle + b : all));
    }
    if (post.includes('<!--PRERENDER:article-->')) {
      post2 = post.replace(/<!--PRERENDER:article-->[\s\S]*?<!--\/PRERENDER:article-->/, block);
    } else {
      post2 = post.replace('</head>', `  ${block}\n</head>`);
    }
    // 제목 아래 글쓴이 줄 (없으면 만들고, 있으면 날짜만 갱신)
    const fmt = d => d.replace(/-/g, '.');
    const byline = `<p class="ecm-byline"><img src="/assets/mascot.svg" alt="" width="22" height="22"><b>${AUTHOR_NAME}</b><span>·</span><span>${AUTHOR_ROLE}</span><span>·</span><time datetime="${published}">${fmt(published)} 작성</time>`
      + (modified !== published ? `<span>·</span><time datetime="${modified}">${fmt(modified)} 수정</time>` : '') + `</p>`;
    if (/<p class="ecm-byline">/.test(post2)) {
      post2 = post2.replace(/<p class="ecm-byline">[\s\S]*?<\/p>/, byline);
    } else {
      post2 = post2.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/, `$1\n    ${byline}`);
    }
    if (post2 !== original) { fs.writeFileSync(postPath, post2); n++; }
  }
  return n;
}

/** 홈의 '최신 업데이트'에 넣을 최근 블로그 글. blog/index.html 의 카드에서 제목·날짜를 읽는다. */
function recentPosts(blogDir, limit = 500) {
  let html;
  try { html = fs.readFileSync(path.join(blogDir, 'index.html'), 'utf8'); } catch (_) { return []; }
  const posts = [];
  const re = /<a href="(\/blog\/[^"]+\.html)"[^>]*class="post-card[\s\S]*?cat-pill (cat-[a-z]+)[^>]*>(?:<i[^>]*><\/i>)?\s*([^<]*)<\/span>[\s\S]*?post-date">([\d.]+)<[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[5].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const post = { url: m[1], title, date: m[4].replace(/\./g, '-'), category: m[3].trim(), cat: m[2].replace('cat-', '') };
    // 홈의 사진 카드용: 글의 첫 사진과 메타 설명
    try {
      const body = fs.readFileSync(path.join(blogDir, path.basename(m[1])), 'utf8');
      // 썸네일이 있으면 그것을, 없으면 글의 첫 사진을 카드에 쓴다
      const thumbRel = `/blog/images/${path.basename(m[1], '.html')}/thumb.jpg`;
      if (fs.existsSync(path.join(blogDir, '..', thumbRel.replace(/^\//, '')))) {
        post.image = thumbRel;
        post.imageAlt = title;
      } else {
        const img = body.match(/<img[^>]*src="(\/blog\/images\/[^"]+)"[^>]*>/);
        if (img) {
          post.image = img[1];
          const alt = img[0].match(/alt="([^"]*)"/);
          if (alt) post.imageAlt = alt[1];
        }
      }
      const desc = body.match(/<meta name="description" content="([^"]*)"/);
      if (desc) post.excerpt = desc[1];
    } catch (_) { /* 글 파일이 없으면 제목·날짜만 쓴다 */ }
    posts.push(post);
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  return posts.slice(0, limit);
}

/** 스크립트 안의 /*PRERENDER:key*​/ … /*​/PRERENDER:key*​/ 사이를 바꾼다 (HTML 주석은 스크립트 안에서 못 쓴다) */
function replaceJsBlock(html, key, content) {
  const open = `/*PRERENDER:${key}*/`;
  const close = `/*/PRERENDER:${key}*/`;
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (i < 0 || j < 0) throw new Error(`스크립트 마커를 찾지 못했습니다: ${key}`);
  return html.slice(0, i + open.length) + content + html.slice(j);
}

function replaceBlock(html, key, content) {
  const open = `<!--PRERENDER:${key}-->`;
  const close = `<!--/PRERENDER:${key}-->`;
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (i < 0 || j < 0) throw new Error(`마커를 찾지 못했습니다: ${key}`);
  return html.slice(0, i + open.length) + content + html.slice(j);
}

function main() {
  const rootDir = path.join(__dirname, '..');
  const blogDir = path.join(rootDir, 'blog');
  let html = fs.readFileSync(FILE, 'utf8');

  // 새 글 썸네일 (없을 때만 만든다), 글 스키마(작성일·수정일)
  const thumbs = ensureThumbnails(blogDir, rootDir);
  const articles = ensureArticleSchema(blogDir, rootDir);

  // 1차 실행: 카탈로그만 읽어 등록일 장부를 갱신하고, 그 결과를 스크립트에 써 넣는다
  const first = run(html);
  const { seen, added } = updateSeen(first.games, first.version, rootDir);
  html = replaceJsBlock(html, 'seen', `\n    const COUPON_FIRST_SEEN = ${JSON.stringify(seen)};\n    `);
  const posts = recentPosts(blogDir);
  html = replaceJsBlock(html, 'posts', `\n    const RECENT_BLOG_POSTS = ${JSON.stringify(posts)};\n    `);
  // 블로그·정보 페이지의 '블로그' 드롭다운은 이 파일을 읽어 채운다 (assets/ecm.js)
  fs.writeFileSync(path.join(rootDir, 'assets', 'posts.json'), JSON.stringify(posts.map(p => ({ url: p.url, title: p.title, date: p.date, category: p.category, cat: p.cat })), null, 0) + '\n');

  // 쇼핑몰 페이지가 있는 쇼핑몰: 메뉴·카드가 그 페이지로 링크하도록 스크립트에 넣는다
  const shopDetails = loadShopDetails(rootDir);
  const shopPageIds = [];
  for (const cat of first.shop.cats) for (const m of first.shop.catalogs[cat]) if (shopQualifies(shopDetails[m.id])) shopPageIds.push(m.id);
  html = replaceJsBlock(html, 'shoppages', `\n    const SHOP_PAGES = ${JSON.stringify(shopPageIds)};\n    `);

  // 2차 실행: 등록일·최근 글이 반영된 상태로 그리드를 채운다
  const data = run(html);
  const { grids, games, version } = data;

  let filled = 0;
  for (const c of CATS) {
    const markup = grids[c];
    if (!markup) throw new Error(`${c} 그리드가 비어 있습니다. 렌더 함수를 확인하세요.`);
    html = replaceBlock(html, c, markup);
    filled++;
  }

  const ld = `\n  <script type="application/ld+json">\n${JSON.stringify(itemListJsonLd(games), null, 2)}\n  </script>\n  `;
  // 블로그·정보 페이지의 드롭다운은 이 파일을 불러와 쓴다 (assets/ecm.js)
  fs.writeFileSync(path.join(rootDir, 'assets', 'menu.html'), grids.mega);
  html = replaceBlock(html, 'itemlist', ld);
  html = replaceBlock(html, 'noscript', noscriptHtml(data));

  const blogLinks = blogLinksHtml(blogDir);
  html = replaceBlock(html, 'bloglinks', blogLinks);

  fs.writeFileSync(FILE, html);

  // 게임별 쿠폰 페이지 (/game/<id>.html). 살아 있는 코드가 있거나 입력 방법이 확인된 게임만
  const gp = writeGamePages(rootDir, games, posts, version, seen);

  // 섹션 홈: 게임 쿠폰 홈(/game/), 쇼핑 할인 홈(/shop/), 쇼핑몰 페이지(/shop/<id>.html)
  const shopArgs = { shopCats: data.shop.cats, shopCatalogs: data.shop.catalogs, subLabels: data.shop.subs, catLabels: data.shop.labels, catIcons: data.shop.icons,
    details: shopDetails, posts, headerHtml, footerHtml };
  const sp = writeShopPages(rootDir, shopArgs);
  writeShopHub(rootDir, { ...shopArgs, pageIds: sp.ids });
  writeGameHub(rootDir, { games, posts, version, firstSeen: seen, gamePageIds: gp.ids, evaluate, GENRE_LABELS, headerHtml, footerHtml });

  const urls = writeSitemap(rootDir, gp.ids, [
    { loc: '/game/', file: 'game/index.html', freq: 'daily', priority: '0.9' },
    { loc: '/shop/', file: 'shop/index.html', freq: 'weekly', priority: '0.9' },
    ...sp.ids.map(id => ({ loc: `/shop/${id}.html`, file: `shop/${id}.html`, freq: 'weekly', priority: '0.7' })),
  ]);

  // AI 검색·답변 서비스용 사이트 요약 (/llms.txt)
  const llmsGames = writeLlmsTxt(rootDir, games, gp.ids, posts, version, { shops: sp.ids.map(id => ({ id, name: (Object.values(data.shop.catalogs).flat().find(m => m.id === id) || {}).name || id })) });

  const chars = CATS.reduce((n, c) => n + grids[c].length, 0);
  const shops = data.groups.reduce((n, g) => n + g.items.length, 0);
  console.log(`카탈로그 버전: ${version}`);
  console.log(`그리드 ${filled}개 · 게임 ${games.length}종 · 제휴몰 ${shops}곳을 HTML에 미리 렌더링 (+${chars.toLocaleString()}자)`);
  console.log(`쿠폰 스키마 ${itemListJsonLd(games).numberOfItems}건 · 블로그 링크 ${(blogLinks.match(/<li>/g) || []).length}개`);
  console.log(`sitemap.xml 재생성: ${urls}개 주소 · llms.txt 게임 ${llmsGames}개`);
  console.log(`게임 페이지: ${gp.ids.length}개 (새로 씀 ${gp.written}, 지움 ${gp.removed}) · 쇼핑몰 페이지: ${sp.ids.length}개 (새로 씀 ${sp.written}, 지움 ${sp.removed})`);
  console.log(`쿠폰 등록일 장부: ${Object.keys(seen).length}건 (새로 적음 ${added}건) · 최근 글 ${posts.length}개`);
  if (articles) console.log(`글 스키마 갱신: ${articles}개`);
  // 구글 애널리틱스 태그: 모든 페이지 (새 글·새 게임 페이지 포함)
  const ga = ensureAnalytics(rootDir);
  if (ga) console.log(`애널리틱스 태그: ${ga}개 페이지에 넣음`);
  if (thumbs.made || thumbs.skipped) console.log(`썸네일: 새로 만듦 ${thumbs.made}장` + (thumbs.skipped ? ` · 못 만듦 ${thumbs.skipped}장 (python/Pillow 필요)` : ''));
}

main();
