/**
 * index.html 의 페이지 스크립트를 브라우저 없이 실행해서 안쪽 함수를 꺼내 준다.
 * scripts/prerender.js 와 같은 DOM 흉내(makeDom)를 쓰므로, 빌드가 보는 것과 테스트가 보는 것이 같다.
 *
 *   const page = loadPage({ search: '?q=원신' });
 *   page.fn.matchesGameSearch(...)   // 안쪽 함수
 *   page.state()                     // games·searchQuery·currentMainCategory 현재 값
 *   page.grids.game                  // 그리드에 그려진 HTML
 */
const fs = require('fs');
const path = require('path');
const { makeDom } = require('../scripts/prerender');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

// 꺼내 쓸 안쪽 함수. 이름이 바뀌면 여기서 바로 깨져서 알 수 있다.
const FNS = [
  'evaluateCoupon', 'countActiveCoupons', 'purgeOldCoupons',
  'matchesGameSearch', 'matchesShopSearch', 'searchCounts', 'handleSearch', 'clearSearch',
  'renderGames', 'monoOf', 'codeAnchor', 'esc',
];

function pageScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('index.html 에서 페이지 스크립트를 찾지 못했습니다.');
  return m[1];
}

/**
 * @param {object} opt
 * @param {string} [opt.search]  주소의 ?q= 부분 (예: '?q=원신'). 주면 location 도 흉내 낸다.
 * @param {string} [opt.hash]
 */
function loadPage(opt = {}) {
  const html = fs.readFileSync(INDEX, 'utf8');
  const dom = makeDom();
  const location = (opt.search != null || opt.hash != null)
    ? { search: opt.search || '', hash: opt.hash || '', pathname: '/' }
    : undefined;
  const body = pageScript(html) + `
    ;window.fire('DOMContentLoaded');
    return {
      fn: { ${FNS.join(', ')} },
      setQuery(q) { searchQuery = q; },
      state() { return { games, searchQuery, currentMainCategory, initialGameCatalog, SHOP_CATS, SHOP_CATALOGS, COUPON_FIRST_SEEN }; },
    };
  `;
  const run = new Function('document', 'window', 'localStorage', 'console', 'navigator', 'location', body);
  const quiet = { log() {}, info() {}, warn() {}, error: console.error };
  const out = run(dom.document, dom.window, dom.localStorage, quiet, { clipboard: null }, location);
  return { ...out, grids: dom.grids, document: dom.document, html };
}

module.exports = { loadPage, ROOT, INDEX };
