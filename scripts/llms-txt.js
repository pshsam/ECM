/**
 * llms.txt 를 만든다: AI 검색·답변 서비스가 사이트를 요약해 읽는 파일 (https://llmstxt.org 형식).
 *
 * 사이트가 무엇이고, 어떤 기준으로 코드를 확인하며, 어떤 페이지가 있는지를 짧게 적는다.
 * prerender.js 가 게임 페이지·최근 글 목록을 넘겨 호출한다. 손으로 고치지 않는다.
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://ecm-coupon.com';

function isActive(c, today) {
  if (!c.expireDate || c.expireDate === '상시' || /9999/.test(c.expireDate)) return true;
  const t = new Date(c.expireDate);
  return isNaN(t.getTime()) || t.getTime() >= today.getTime();
}

function writeLlmsTxt(rootDir, games, gamePageIds, posts, version, extra = {}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ids = new Set(gamePageIds);
  const pageGames = games.filter(g => ids.has(g.id));
  const abs = u => (u.startsWith('http') ? u : SITE + u);

  const lines = [];
  lines.push('# ECM 쿠폰 (Every Coupon Matters)');
  lines.push('');
  lines.push('> 한국어 게임 쿠폰 코드·생활 할인 정보 사이트(ecm-coupon.com). 게임사 공식 채널 등 출처 등급 기준을 통과한 코드만 올리고, 코드마다 등록일과 만료일을 적는다. 전자담배 쇼핑몰 ECM Vape 와는 관련이 없다.');
  lines.push('');
  lines.push('- 운영: 겜대 (1인 운영), 2026년 9월 개설');
  lines.push(`- 마지막 쿠폰 확인일: ${version}`);
  lines.push('- 갱신 주기: 게임 쿠폰 4시간마다, 로블록스 코드 하루 2번, 게임 목록 매일');
  lines.push('- 등록 기준: 1급 게임사 공식 채널 1곳, 또는 2급 매체 기사 1곳 + 독립된 다른 출처 1곳. 유저 게시글만으로는 등록하지 않는다. 자세한 기준: ' + SITE + '/about.html');
  lines.push('- 게임사 공식 파트너가 아니며, 코드 입력은 각 게임사 공식 페이지나 게임 안에서 한다.');
  lines.push('');
  lines.push('## 섹션 홈');
  lines.push('');
  lines.push(`- [게임 쿠폰 코드 모음](${SITE}/game/): 게임별 쿠폰 페이지, 새 쿠폰, 마감 임박 코드`);
  lines.push(`- [쇼핑 할인·쿠폰 모음](${SITE}/shop/): 쇼핑몰별 정기 쿠폰·가입 혜택과 확인일`);
  lines.push(`- [ECM 쿠폰 블로그](${SITE}/blog/index.html): 쿠폰 등록 방법·코드 가이드·알뜰 쇼핑 글`);
  lines.push('');
  if (extra.shops && extra.shops.length) {
    lines.push('## 쇼핑몰별 혜택 페이지');
    lines.push('');
    for (const sh of extra.shops) lines.push(`- [${String(sh.name).split(' (')[0]} 쿠폰·할인 혜택](${SITE}/shop/${sh.id}.html)`);
    lines.push('');
  }
  lines.push('## 게임별 쿠폰 코드 페이지');
  lines.push('');
  for (const g of pageGames) {
    const n = (g.coupons || []).filter(c => isActive(c, today)).length;
    const what = n ? `지금 쓸 수 있는 코드 ${n}개, 보상·만료일, 입력 방법` : '입력 방법, 코드가 나오는 곳, 지난 코드 이력';
    lines.push(`- [${g.title} 쿠폰 코드](${SITE}/game/${g.id}.html): ${what}`);
  }
  lines.push('');
  lines.push('## 가이드 글');
  lines.push('');
  for (const p of posts) lines.push(`- [${p.title}](${abs(p.url)}): ${p.category || ''} · ${p.date}`);
  lines.push('');
  lines.push('## 사이트 정보');
  lines.push('');
  lines.push(`- [ECM 쿠폰 소개와 확인 기준](${SITE}/about.html)`);
  lines.push(`- [문의·제보](${SITE}/contact.html)`);
  lines.push(`- [개인정보처리방침](${SITE}/privacy.html)`);
  lines.push(`- [이용약관](${SITE}/terms.html)`);
  lines.push(`- [사이트맵](${SITE}/sitemap.xml)`);
  lines.push('');

  const out = lines.join('\n');
  const file = path.join(rootDir, 'llms.txt');
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev !== out) fs.writeFileSync(file, out);
  return pageGames.length;
}

module.exports = { writeLlmsTxt };
