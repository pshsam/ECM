/**
 * "이 코드 안 돼요" 신고 (2026-10-19, 만들어 두고 꺼 둠)
 *
 * REPORTS_ENABLED 는 이 파일 한 곳에만 둔다. prerender.js 가 같은 값을 index.html 의 REPORTS_ENABLED 에 써 넣고,
 * 게임 페이지(game-pages.js)·홈 쿠폰 창·매일 모음(reports-digest.js)이 모두 이 값을 본다. false 면 화면에 아무것도 그리지 않는다.
 *
 * 켜는 순서 (저장소 주인):
 *   1. docs/firestore-reports-rules.txt 의 reports 규칙을 파이어베이스 콘솔 → Firestore → 규칙에 붙여 넣고 게시한다
 *      (지금 있는 subscribers 규칙은 그대로 둔다)
 *   2. 아래 값을 true 로 바꾸고 node scripts/prerender.js → 테스트 → push
 *   3. .github/workflows/reports-digest.yml 은 이미 있는 FIREBASE_SERVICE_ACCOUNT 비밀값을 쓴다. 매일 07:20(한국) 에
 *      최근 14일 신고를 data/report-digest.json 으로 모은다(개수만, 기기 정보 없음)
 */
const REPORTS_ENABLED = true;

/** 신고 이유 (파이어스토어 규칙의 목록과 같아야 한다) */
const REPORT_REASONS = { expired: '만료됐대요', invalid: '잘못된 코드래요', other: '기타' };
/** 파이어스토어 규칙의 길이 제한과 같다 */
const LIMITS = { game: 60, code: 80 };

module.exports = { REPORTS_ENABLED, REPORT_REASONS, LIMITS };
