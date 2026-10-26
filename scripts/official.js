/**
 * 공식 출처 판정 (2026-10-27~, 애드센스 재심사: 공식 출처·직접 확인 중심).
 *
 * data/official-sources.json 의 games["게임id"] 는 그 게임의 공식 채널 목록이다(공식 홈페이지·쿠폰 입력 페이지·공식 X 계정·공식 카페 등).
 *   "lostark.game.onstove.com"      주소만 적으면 그 주소와 하위 주소(news.… 등) 전부
 *   "x.com/LOSTARK_KR"              경로까지 적으면 그 경로로 시작하는 글만 (대소문자 무시)
 * 코드의 src 주소가 이 목록에 맞으면 "공식 출처"다. 코드 정리 사이트(매체)는 공식이 아니다 — 후보를 찾는 단서로만 쓴다.
 *
 * index.html 의 srcKey / isOfficialSrc 와 같은 규칙이어야 한다 (tests/official.test.js 가 비교한다).
 * prerender.js 가 같은 목록을 index.html 의 OFFICIAL_SOURCES 에 써 넣는다.
 */
const fs = require('fs');
const path = require('path');

const OFFICIAL_SOURCES = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'official-sources.json'), 'utf8'));
    return j && j.games && typeof j.games === 'object' ? j.games : {};
  } catch (e) { return {}; }
})();

/** 주소 → "호스트/경로" (소문자, www./m./mobile. 빼고, twitter.com 은 x.com 으로). 주소가 아니면 '' */
function srcKey(u) {
  let x;
  try { x = new URL(u); } catch (e) { return ''; }
  let host = x.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  if (host === 'twitter.com') host = 'x.com';
  return (host + x.pathname.replace(/\/+$/, '')).toLowerCase();
}

/** 이 주소가 이 게임의 공식 채널인지 */
function isOfficialSrc(gameId, u, sources = OFFICIAL_SOURCES) {
  const key = srcKey(u);
  if (!key) return false;
  const host = key.split('/')[0];
  return (sources[gameId] || []).some(e => {
    const want = String(e).toLowerCase().replace(/\/+$/, '');
    if (!want) return false;
    if (want.includes('/')) return key === want || key.startsWith(want + '/');
    return host === want || host.endsWith('.' + want);
  });
}

/** 코드가 검색에 내보낼 근거를 갖췄는지: 공식 출처가 하나라도 있거나, 운영자가 직접 넣어 보고 됐다고 적은 코드 */
function hasOfficialBasis(gameId, c, tested = {}) {
  if (!c) return false;
  const t = tested[gameId + ':' + c.code];
  if (t && t.result === 'ok') return true;
  return (Array.isArray(c.src) ? c.src : []).some(u => isOfficialSrc(gameId, u));
}

module.exports = { OFFICIAL_SOURCES, srcKey, isOfficialSrc, hasOfficialBasis };
