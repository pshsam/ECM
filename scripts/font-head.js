/**
 * 글꼴 태그: 모든 페이지 <head> 에 같은 줄을 넣는다.
 *
 * - Pretendard: 동적 서브셋. 페이지에 실제로 나오는 글자 조각만 받는다
 *   (예전 static/pretendard.css 는 굵기마다 한글 전체 글꼴을 받아 한 페이지 3.8MB 였다).
 *   CSS 는 /assets/pretendard.css (scripts/pretendard-css.js 가 만든다, font-display: optional — 글꼴이 늦게 와도 줄바꿈이 안 바뀐다).
 *   글꼴 파일은 jsDelivr 에서 받는다.
 * - Font Awesome: 이 사이트가 쓰는 아이콘만 남긴 /assets/fa.css (scripts/fa-subset.py 가 만든다).
 *
 * 블로그 글은 글쓰기 루틴이 템플릿(블로그 오토 automation/routines/ecm_post_template.html)으로 만든다.
 * 템플릿이 옛 줄을 갖고 있어도 prerender 가 ensureFonts 로 새 줄로 바꿔 놓는다.
 */
const fs = require('fs');
const path = require('path');

const PRETENDARD_CSS = '/assets/pretendard.css';

// 화면을 막지 않게 불러온다. 일반 stylesheet(10-19 하루)로 두면 첫 배치 때 이미 글꼴 규칙이 있어
// optional 의 대기 시간(최대 0.1초) + 552개 규칙 처리만큼 첫 화면이 늦었다(홈 FCP·LCP +0.3초, devtools 스로틀).
// 늦게 붙어도 처음 온 방문자는 그 페이지를 시스템 글꼴로 끝까지 보고(optional), 캐시가 있으면 처음부터 Pretendard — 어느 쪽도 화면이 튀지 않았다
const PRETENDARD_LINK = `<link rel="preload" as="style" href="${PRETENDARD_CSS}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${PRETENDARD_CSS}"></noscript>`;
// 2026-10-19 하루 쓴 줄 (화면을 막는 일반 stylesheet). <noscript> 안의 같은 줄은 건드리지 않는다
const OLD_BLOCKING = '(?<!<noscript>)<link rel="stylesheet" href="\\/assets\\/pretendard\\.css">';
const FONT_HEAD = `<link rel="stylesheet" href="/assets/fa.css">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  ${PRETENDARD_LINK}`;

// 예전 CDN 줄 (Font Awesome 전체, Pretendard 전체 글꼴)
const OLD_FA = '<link rel="preload" as="style" href="https:\\/\\/cdnjs\\.cloudflare\\.com\\/ajax\\/libs\\/font-awesome\\/[^"]+"[^>]*><noscript><link rel="stylesheet" href="https:\\/\\/cdnjs\\.cloudflare\\.com\\/ajax\\/libs\\/font-awesome\\/[^"]+"><\\/noscript>';
const OLD_PRETENDARD = '<link rel="preload" as="style" href="https:\\/\\/cdn\\.jsdelivr\\.net\\/gh\\/orioncactus\\/pretendard\\/dist\\/web\\/static\\/pretendard\\.css"[^>]*><noscript><link rel="stylesheet" href="https:\\/\\/cdn\\.jsdelivr\\.net\\/gh\\/orioncactus\\/pretendard\\/dist\\/web\\/static\\/pretendard\\.css"><\\/noscript>';
const OLD_FA_LINE = new RegExp('[ \\t]*' + OLD_FA + '\\r?\\n');
// 2026-10-18~19 의 줄 (jsDelivr 동적 서브셋 CSS 를 그대로, font-display: swap). 블로그 템플릿이 아직 이 줄을 쓸 수 있다
const OLD_SUBSET = '<link rel="preload" as="style" href="https:\\/\\/cdn\\.jsdelivr\\.net\\/gh\\/orioncactus\\/pretendard@[^"/]+\\/dist\\/web\\/static\\/pretendard-dynamic-subset\\.css"[^>]*><noscript><link rel="stylesheet" href="https:\\/\\/cdn\\.jsdelivr\\.net\\/gh\\/orioncactus\\/pretendard@[^"/]+\\/dist\\/web\\/static\\/pretendard-dynamic-subset\\.css"><\\/noscript>';

/** 옛 글꼴 줄을 FONT_HEAD 로 바꾼 html (이미 바뀌었으면 그대로) */
function withFonts(html) {
  html = html.replace(new RegExp(OLD_SUBSET + '|' + OLD_BLOCKING, 'g'), () => PRETENDARD_LINK);
  const hasFa = new RegExp(OLD_FA).test(html), hasPre = new RegExp(OLD_PRETENDARD).test(html);
  if (!hasFa && !hasPre) return html;
  const head = /\r\n/.test(html) ? FONT_HEAD.replace(/\n/g, '\r\n') : FONT_HEAD;
  if (hasFa && hasPre && OLD_FA_LINE.test(html)) {
    return html.replace(OLD_FA_LINE, '').replace(new RegExp(OLD_PRETENDARD), () => head);
  }
  // 한쪽만 있거나 같은 줄에 붙어 있으면: 첫 번째를 새 줄로, 나머지는 지운다
  let done = false;
  return html.replace(new RegExp(OLD_FA + '|' + OLD_PRETENDARD, 'g'), () => (done ? '' : (done = true, head)));
}

function ensureFonts(rootDir) {
  const dirs = ['', 'blog', 'game', 'today', 'free'].map(d => path.join(rootDir, d));
  let n = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.html')) continue;
      const p = path.join(d, f);
      const html = fs.readFileSync(p, 'utf8');
      const out = withFonts(html);
      if (out !== html) { fs.writeFileSync(p, out); n++; }
    }
  }
  return n;
}

/** html(또는 스크립트) 안의 fa-이름 중 fa.css 부분집합에 없는 것 (fa-subset.py 같은 파일 이름은 뺀다) */
function missingIcons(text, faCss) {
  const names = new Set(text.match(/\bfa-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w-]*\.(?:py|woff2?|css|ttf)\b)/g) || []);
  return [...names].filter(n => !new RegExp('\\.' + n + '(?![\\w-])|keyframes ' + n + '(?![\\w-])').test(faCss)).sort();
}

/** 블로그 글이 fa.css 에 없는 아이콘을 쓰면 [{ post, icons }] — prerender 가 알려만 준다 */
function blogMissingIcons(rootDir) {
  const blogDir = path.join(rootDir, 'blog');
  let css;
  try { css = fs.readFileSync(path.join(rootDir, 'assets', 'fa.css'), 'utf8'); } catch (_) { return []; }
  if (!fs.existsSync(blogDir)) return [];
  return fs.readdirSync(blogDir).filter(f => f.endsWith('.html')).sort()
    .map(f => ({ post: f, icons: missingIcons(fs.readFileSync(path.join(blogDir, f), 'utf8'), css) }))
    .filter(x => x.icons.length);
}

module.exports = { PRETENDARD_CSS, PRETENDARD_LINK, FONT_HEAD, withFonts, ensureFonts, missingIcons, blogMissingIcons };
