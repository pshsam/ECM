/**
 * 한 번만 돌리는 정리 스크립트 (2026-09-30).
 *
 * 예전 규칙: 공식 만료일이 없는 코드도 expireDate 에 "확인일 + 30일"을 적고 reward 끝에 "(만료일 미공지)"를 붙였다.
 * 그 날짜가 화면에서 공식 만료일처럼 D-day 로 보였다(신도 라이프: "만료일 미공지"인데 "D-25 / 2026-10-25").
 *
 * 새 규칙:
 *   expireDate  공식 만료일만 (YYYY-MM-DD 또는 "상시"). 없으면 필드를 두지 않는다 → 화면에 "만료일 미공개".
 *   recheckBy   내부 재확인 기한. 화면에 날짜로 보여 주지 않는다. 지나면 "확인이 오래된 코드"로 목록에서 내린다.
 *
 * 이 스크립트가 하는 일
 *   1. reward 에 "만료일 미공지"가 적힌 코드 → expireDate 를 recheckBy 로 옮기고, reward 에서 그 표시를 지운다.
 *   2. 표시는 없지만 expireDate 가 "처음 본 날 + 30일"과 정확히 같은 코드 → 추정값으로 보고 1과 같이 옮긴다.
 *   3. 표시 없이 날짜가 있는 나머지 → 공식 날짜로 두되, data/expiry-review.json 에 "재확인 권장"으로 따로 적는다.
 *
 * 사용: node scripts/migrate-expiry.js   (index.html 과 data/expiry-review.json 을 고친다)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'index.html');
const src = fs.readFileSync(file, 'utf8');
const seen = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coupon-seen.json'), 'utf8'));

const start = src.indexOf('const initialGameCatalog');
const open = src.indexOf('[', start);
let depth = 0, end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']' && --depth === 0) { end = i + 1; break; }
}
let block = src.slice(open, end);

const MARK = /\s*\(만료일 미공[지개]\)|,\s*만료일 미공[지개](?=\))/;
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const review = { generated: new Date().toISOString().slice(0, 10), moved_by_marker: 0, moved_by_pattern: [], kept_as_official: [] };

// 게임 id 는 각 게임 객체의 id: "..." 에서. 코드 줄보다 앞에 나오므로 순서대로 따라간다.
let gameId = '';
block = block.replace(/id: "([^"]+)"|\{ code: "((?:[^"\\]|\\.)*)", reward: "((?:[^"\\]|\\.)*)", expireDate: "([^"]*)" \}/g, (m, id, code, reward, exp) => {
  if (id) { gameId = id; return m; }
  const official = !exp || exp === '상시' || /9999/.test(exp);
  if (official) return m;
  if (MARK.test(reward)) {
    review.moved_by_marker++;
    return `{ code: "${code}", reward: "${reward.replace(MARK, '')}", recheckBy: "${exp}" }`;
  }
  const first = seen[`${gameId}:${code}`];
  if (first && addDays(first, 30) === exp) {
    review.moved_by_pattern.push({ game: gameId, code, date: exp, first_seen: first, why: '처음 본 날 + 30일과 같아 추정값으로 봄' });
    return `{ code: "${code}", reward: "${reward}", recheckBy: "${exp}" }`;
  }
  review.kept_as_official.push({ game: gameId, code, expireDate: exp, first_seen: first || null, why: '만료일 미공지 표시가 없어 공식 날짜로 둠 — 공식 공지로 한 번 더 확인 권장' });
  return m;
});

fs.writeFileSync(file, src.slice(0, open) + block + src.slice(end));
fs.writeFileSync(path.join(ROOT, 'data', 'expiry-review.json'), JSON.stringify(review, null, 1) + '\n');
console.log(`표시로 옮김 ${review.moved_by_marker}개, 날짜 패턴으로 옮김 ${review.moved_by_pattern.length}개, 공식으로 둠(재확인 권장) ${review.kept_as_official.length}개`);
