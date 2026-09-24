/**
 * 구글 애널리틱스(GA4) 태그. 모든 페이지의 <head> 바로 뒤에 들어간다.
 *
 * - 게임 페이지는 game-pages.js 가 이 조각을 직접 넣는다.
 * - 나머지 페이지(홈·블로그·정보 페이지)는 prerender.js 가 빌드 끝에 ensureAnalytics 로 채운다.
 *   글쓰기 루틴이 새 글을 올려도 빌드를 돌리므로 자동으로 들어간다.
 * 인라인 스크립트에 id="ga4" 를 붙인 이유: prerender·점검·루틴이 속성 없는 <script> 를 본문 코드로 찾기 때문에
 *   그 검색에 걸리지 않게 한다.
 * 측정 ID 를 바꿀 때는 GA_ID 한 곳만 고치고 빌드하면 된다(예전 ID 가 든 태그는 새것으로 바뀐다).
 */
const fs = require('fs');
const path = require('path');

const GA_ID = 'G-0GRNJG8K06';

const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script id="ga4">
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  </script>
  <!-- /Google tag -->`;

const BLOCK_RE = /<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- \/Google tag -->/;

/** html 문자열에 태그를 넣거나(없으면) 새것으로 바꾼다(있으면). */
function withAnalytics(html) {
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, GA_SNIPPET);
  return html.replace(/<head>/i, `<head>\n  ${GA_SNIPPET}`);
}

/** 사이트의 모든 HTML 페이지에 태그가 있게 한다. 바꾼 파일 수를 돌려준다. */
function ensureAnalytics(rootDir) {
  const dirs = [rootDir, path.join(rootDir, 'blog'), path.join(rootDir, 'game'), path.join(rootDir, 'shop')];
  let n = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.html')) continue;
      const p = path.join(d, f);
      const html = fs.readFileSync(p, 'utf8');
      if (!/<head>/i.test(html)) continue;
      const out = withAnalytics(html);
      if (out !== html) { fs.writeFileSync(p, out); n++; }
    }
  }
  return n;
}

module.exports = { GA_ID, GA_SNIPPET, withAnalytics, ensureAnalytics };
