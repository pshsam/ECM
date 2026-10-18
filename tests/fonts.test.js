// 글꼴 태그 (2026-10-18, 페이지 무게 4.7MB → Pretendard 동적 서브셋 + 아이콘 부분집합)
//   - 모든 페이지가 scripts/font-head.js 의 FONT_HEAD 를 쓴다 (옛 CDN 전체 글꼴 줄이 남아 있으면 안 된다)
//   - 템플릿·스크립트가 쓰는 Font Awesome 아이콘은 모두 assets/fa.css 부분집합에 있어야 화면에 보인다
//     (없으면: python scripts/fa-subset.py <Font Awesome 6.5.1 package 폴더> 로 다시 만든다)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./page');
const { FONT_HEAD, withFonts, missingIcons } = require('../scripts/font-head');

const FA_CSS = fs.readFileSync(path.join(ROOT, 'assets', 'fa.css'), 'utf8');
const htmlIn = dir => fs.existsSync(path.join(ROOT, dir))
  ? fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(dir, f)) : [];
const pages = ['', 'game', 'today', 'free', 'blog'].flatMap(htmlIn);

test('옛 글꼴 CDN 줄(Font Awesome 전체·Pretendard 전체)이 남은 페이지가 없다', () => {
  const OLD = /cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome|pretendard\/dist\/web\/static\/pretendard\.css/;
  const bad = pages.filter(p => OLD.test(fs.readFileSync(path.join(ROOT, p), 'utf8')));
  assert.deepEqual(bad, []);
  for (const f of ['scripts/page-shell.js', 'scripts/game-pages.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), OLD, f);
  }
});

test('Font Awesome 을 쓰는 페이지는 /assets/fa.css 를 불러온다', () => {
  const bad = pages.filter(p => {
    const h = fs.readFileSync(path.join(ROOT, p), 'utf8');
    return /class="[^"]*\bfa-(solid|regular|brands)\b/.test(h) && !h.includes('href="/assets/fa.css"');
  });
  assert.deepEqual(bad, []);
});

test('withFonts: 옛 두 줄을 새 줄로 바꾸고, 이미 바뀐 페이지는 그대로 둔다', () => {
  const old = '<head>\n  <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></noscript>\n'
    + '  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"></noscript>\n</head>';
  const out = withFonts(old);
  assert.equal(out, '<head>\n  ' + FONT_HEAD + '\n</head>');
  assert.equal(withFonts(out), out);
  assert.equal(withFonts(old.replace(/\n/g, '\r\n')), out.replace(/\n/g, '\r\n'));
});

test('템플릿·스크립트·사이트 페이지가 쓰는 아이콘은 모두 assets/fa.css 에 있다', () => {
  // 블로그 글은 루틴이 쓰므로 여기서 막지 않고 prerender 가 알려 준다
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js')).map(f => 'scripts/' + f),
    ...fs.readdirSync(path.join(ROOT, 'assets')).filter(f => /\.(js|html)$/.test(f)).map(f => 'assets/' + f),
    ...pages.filter(p => !p.startsWith('blog/') || p === 'blog/index.html'),
  ];
  const missing = {};
  for (const f of files) {
    const m = missingIcons(fs.readFileSync(path.join(ROOT, f), 'utf8'), FA_CSS);
    if (m.length) missing[f] = m;
  }
  assert.deepEqual(missing, {}, 'assets/fa.css 에 없는 아이콘 — python scripts/fa-subset.py 로 다시 만든다');
});
