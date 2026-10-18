/**
 * assets/pretendard.css 를 만든다: jsDelivr 의 Pretendard 동적 서브셋 CSS 를 이 사이트에 맞게 줄인 것.
 *
 *   node scripts/pretendard-css.js <pretendard-dynamic-subset.css 파일>
 *   (받는 곳: https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css)
 *
 * 바꾸는 것 (글꼴 파일 자체는 그대로 jsDelivr 에서 받는다)
 * - font-display: swap → optional (2026-10-19).
 *   swap 이면 시스템 글꼴로 먼저 그렸다가 Pretendard 가 오면 글자 폭이 바뀌어 줄바꿈이 달라지고(게임 페이지 h1 이 두 줄 → 한 줄,
 *   아래 표가 33px 위로 튐 = CLS 0.2), 서브셋이 도착할 때마다 페이지 전체를 다시 배치했다(홈 0.5~0.7초씩, 4배 느린 휴대폰 기준).
 *   optional 은 처음 그릴 때 글꼴이 준비돼 있으면 쓰고, 아니면 그 페이지는 시스템 글꼴로 끝까지 간다(받은 글꼴은 다음 페이지부터).
 * - 굵기 100·200·300 은 사이트에서 안 써서 뺀다. woff(옛 브라우저용) 주소도 뺀다.
 * - 상대 주소를 jsDelivr 절대 주소로.
 */
const fs = require('fs');
const path = require('path');

const VERSION = 'v1.3.9';
const BASE = `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@${VERSION}/packages/pretendard/dist/web/static/woff2-dynamic-subset/`;
const WEIGHTS = new Set(['400', '500', '600', '700', '800', '900']);

function build(src) {
  const license = (src.match(/^\/\*[\s\S]*?\*\//) || [''])[0];
  const rules = src.match(/@font-face\s*\{[^}]*\}/g) || [];
  const out = [];
  for (const r of rules) {
    const weight = (r.match(/font-weight:\s*(\d+)/) || [])[1];
    if (!WEIGHTS.has(weight)) continue;
    const file = (r.match(/woff2-dynamic-subset\/([^)]+\.woff2)\)/) || [])[1];
    const range = (r.match(/unicode-range:\s*([^;]+);/) || [])[1];
    if (!file || !range) throw new Error('알 수 없는 @font-face: ' + r.slice(0, 120));
    const subset = +(file.match(/\.subset\.(\d+)\.woff2$/) || [])[1];
    out.push({ subset, weight: +weight, css: `@font-face{font-family:'Pretendard';font-style:normal;font-display:optional;font-weight:${weight};src:url(${BASE}${file}) format('woff2');unicode-range:${range.replace(/\s+/g, '')}}` });
  }
  if (!out.length) throw new Error('@font-face 를 하나도 못 찾았다');
  // 같은 조각(같은 unicode-range)의 굵기 6개를 붙여 둔다. 굵기별로 모아 두면 같은 긴 글자 범위가 55KB 씩 떨어져 있어
  // gzip(32KB 창)이 못 줄인다. 규칙 순서는 글꼴 고르기에 영향이 없다(굵기·글자 범위로 고른다)
  out.sort((a, b) => a.subset - b.subset || a.weight - b.weight);
  return `${license}\n/* Pretendard ${VERSION} 동적 서브셋, 굵기 400-900, font-display: optional. scripts/pretendard-css.js 가 만든다 */\n${out.map(o => o.css).join('\n')}\n`;
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) { console.error('사용법: node scripts/pretendard-css.js <pretendard-dynamic-subset.css>'); process.exit(1); }
  const css = build(fs.readFileSync(input, 'utf8'));
  const dest = path.join(__dirname, '..', 'assets', 'pretendard.css');
  fs.writeFileSync(dest, css);
  console.log(`${dest} (${css.length.toLocaleString()} bytes, @font-face ${css.split('@font-face').length - 1}개)`);
}

module.exports = { build, BASE };
