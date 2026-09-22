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

const FILE = path.join(__dirname, '..', 'index.html');
const CATS = ['game', 'fashion', 'grocery', 'ott', 'beauty', 'delivery', 'travel'];

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
          url: `https://ecm-coupon.com/#${g.id}`,
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
    'ECM (Every Coupon Matters) - 장르별 게임 쿠폰 & 올인원 할인 허브',
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
    return `        <li><a href="/blog/${f}" class="text-slate-600 hover:text-purple-700 hover:underline">${title}</a></li>`;
  }).join('\n') + '\n      ';
}

/**
 * sitemap.xml을 실제 파일 목록과 수정일로 다시 만든다.
 * 손으로 관리하던 때는 글을 추가해도 사이트맵에 빠지거나, lastmod가 전부 같은
 * 날짜로 박혀 있어 검색엔진에 "언제 바뀌었는지" 신호를 주지 못했다.
 */
function writeSitemap(rootDir) {
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

function replaceBlock(html, key, content) {
  const open = `<!--PRERENDER:${key}-->`;
  const close = `<!--/PRERENDER:${key}-->`;
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (i < 0 || j < 0) throw new Error(`마커를 찾지 못했습니다: ${key}`);
  return html.slice(0, i + open.length) + content + html.slice(j);
}

function main() {
  let html = fs.readFileSync(FILE, 'utf8');
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
  html = replaceBlock(html, 'itemlist', ld);
  html = replaceBlock(html, 'noscript', noscriptHtml(data));

  const blogDir = path.join(__dirname, '..', 'blog');
  const blogLinks = blogLinksHtml(blogDir);
  html = replaceBlock(html, 'bloglinks', blogLinks);

  fs.writeFileSync(FILE, html);

  const urls = writeSitemap(path.join(__dirname, '..'));

  const chars = CATS.reduce((n, c) => n + grids[c].length, 0);
  const shops = data.groups.reduce((n, g) => n + g.items.length, 0);
  console.log(`카탈로그 버전: ${version}`);
  console.log(`그리드 ${filled}개 · 게임 ${games.length}종 · 제휴몰 ${shops}곳을 HTML에 미리 렌더링 (+${chars.toLocaleString()}자)`);
  console.log(`쿠폰 스키마 ${itemListJsonLd(games).numberOfItems}건 · 블로그 링크 ${(blogLinks.match(/<li>/g) || []).length}개`);
  console.log(`sitemap.xml 재생성: ${urls}개 주소`);
}

main();
