/**
 * 게임·쇼핑몰 아이콘: 이모지 대신 이름 첫 글자 타일.
 * 이모지는 기기마다 모양이 달라 값싸 보여서 2026-09-29 개편 때 바꿨다.
 * index.html 의 monoOf/monoBox 와 규칙이 같아야 한다 (같은 게임은 어디서나 같은 색).
 */
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HUES = [42, 18, 352, 330, 285, 250, 215, 195, 170, 145, 95, 28];

function monoOf(name) {
  const s = String(name || '').trim();
  const d = s.match(/^\d+/);
  const ch = d ? d[0].slice(0, 2) : (s.charAt(0) || '?').toUpperCase();
  let h = 0;
  for (const c of s) h = (h * 31 + c.codePointAt(0)) % 9973;
  return { ch, h: HUES[h % HUES.length] };
}

/** <span class="{cls} ecm-mono" style="--mh:…">원</span> */
function monoBox(cls, name, tag = 'span', extraStyle = '') {
  const m = monoOf(name);
  return `<${tag} class="${cls} ecm-mono" style="--mh:${m.h}${extraStyle ? ';' + extraStyle : ''}" aria-hidden="true">${esc(m.ch)}</${tag}>`;
}

module.exports = { monoOf, monoBox };
