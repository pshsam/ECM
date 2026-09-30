/**
 * 홈 화면에 설치하는 웹앱 태그. 모든 페이지의 <head> 에 매니페스트·테마 색·아이폰 아이콘을 넣는다.
 * prerender.js 가 빌드 끝에 ensurePwaHead 로 채운다(글쓰기 루틴이 새 글을 올려도 빌드가 돌므로 자동으로 들어간다).
 * 서비스 워커 등록은 assets/ecm.js 가 한다. 설정: /manifest.webmanifest, /sw.js
 */
const fs = require('fs');
const path = require('path');

const PWA_SNIPPET = `<!-- PWA -->
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#FFFFFF">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="ECM 쿠폰">
  <!-- /PWA -->`;
const BLOCK_RE = /<!-- PWA -->[\s\S]*?<!-- \/PWA -->/;

function withPwa(html) {
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, PWA_SNIPPET);
  // 문자 인코딩·뷰포트 메타 다음 줄에 넣는다(없으면 <head> 바로 뒤)
  const vp = html.match(/<meta name="viewport"[^>]*>/i);
  if (vp) return html.replace(vp[0], `${vp[0]}\n  ${PWA_SNIPPET}`);
  return html.replace(/<head>/i, `<head>\n  ${PWA_SNIPPET}`);
}

/** 사이트의 HTML 페이지에 태그가 있게 한다(내부용 radar/ 는 빼고). 바꾼 파일 수를 돌려준다. */
function ensurePwaHead(rootDir) {
  const dirs = ['', 'blog', 'game', 'shop', 'today', 'free'].map(d => path.join(rootDir, d));
  let n = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.html') || f === 'offline.html') continue;
      const p = path.join(d, f);
      const html = fs.readFileSync(p, 'utf8');
      if (!/<head>/i.test(html)) continue;
      const out = withPwa(html);
      if (out !== html) { fs.writeFileSync(p, out); n++; }
    }
  }
  return n;
}

module.exports = { PWA_SNIPPET, withPwa, ensurePwaHead };
