# ECM 작업 안내 (AI·사람 공용)

이 저장소는 그대로 https://ecm-coupon.com 에 공개된다(GitHub Pages, 공개 저장소).
**여기 적는 것, 커밋하는 것은 전부 누구나 볼 수 있다.** 비밀번호·토큰·개인 메모는 절대 넣지 않는다.
비밀값은 GitHub Actions Secrets 에만 둔다(`TELEGRAM_BOT_TOKEN`, `FIREBASE_SERVICE_ACCOUNT`).
`assets/push-config.js` 의 파이어베이스 값은 공개용이라 괜찮다. 보안은 파이어스토어 규칙이 맡는다.

자세한 빌드 설명은 [README.md](README.md), 사람용 폴더 설명은 [폴더_안내.md](폴더_안내.md).

## 작업 전후 순서

1. **먼저 `git pull`** — 쿠폰·블로그·레이더 루틴이 하루에도 여러 번 push 한다.
2. 고친다.
3. 카탈로그·블로그를 건드렸으면 `node scripts/prerender.js`
4. `node --test "tests/*.test.js"` — 전부 통과해야 올린다.
5. 커밋·push. push 하면 바로 사이트에 반영되고, GitHub Actions 가 테스트를 한 번 더 돌린다.

## 구조 한눈에

```
index.html              홈. 게임 카탈로그 데이터 + 화면 스크립트가 전부 이 안에 있다
  initialGameCatalog      게임 목록 (id, title, category, platforms, genre, coupons[...], redeemHow ...)
  <!--PRERENDER:x-->      빌드가 채우는 자리. 손으로 고치지 않는다
scripts/prerender.js    빌드. index.html 스크립트를 가짜 DOM 에서 실행해 HTML 을 미리 그리고,
                        아래 페이지 생성기를 차례로 부른다
  game-pages.js           /game/<id>.html  (게임별 쿠폰 페이지, evaluate = 빌드 쪽 만료 판정)
  hubs.js                 /game/            today-page.js  /today/
  free-pages.js           /free/
  llms-txt.js · analytics.js · pwa.js · media.js(+python) · mono.js
  widget-feed.js          /app/widget.json  (아이폰 앱 위젯용 쿠폰 요약. 코드 문자열은 넣지 않는다)
scripts/notify-*.js     새 쿠폰 텔레그램·푸시 알림 (.github/workflows 가 실행). 앱 기기는 ua native-android / native-ios
data/                   빌드·알림이 쓰는 장부 (coupon-seen = 코드 첫 등록일, coupon-history = 지난 코드의 보상·끝난 날,
                        game-listing = 코드가 없어도 목록에 남길 게임, *-sent = 알림 보낸 기록)
assets/ecm.js           모든 페이지 공통 스크립트 (메뉴, 내 게임, 서비스 워커 등록)
assets/ecm-app.js       ECM 쿠폰 앱(안드로이드·아이폰) 안에서만 (탭 바, 아이폰 위젯에 내 게임 넘기기)
assets/ecm-push.js      웹 푸시 구독 → 파이어스토어 subscribers/{토큰} 에 {games, updated, ua} 만 저장
blog/                   블로그 글 (정적 HTML, 글쓰기 루틴이 추가). 옮긴 글은 noindex + 새로고침 이동 안내만 남긴다(사이트맵에서 빠짐)
shop/index.html         쇼핑 할인은 2026-10 에 없앴다. 예전 헤더 링크용으로 홈(/)으로 보내는 안내만 남김
radar/                  내부용 트렌드 레이더 (noindex)
tests/                  자동 테스트 (node 내장 테스트, 설치할 것 없음)
```

## 데이터가 흐르는 길

쿠폰 하나가 `initialGameCatalog` 에 들어가면:
홈 화면(브라우저가 그림) → `prerender.js` 가 같은 결과를 HTML 에 박음(네이버 등 JS 안 읽는 검색엔진용)
→ 게임 페이지·오늘의 쿠폰·허브·sitemap·llms.txt 재생성 → push → 텔레그램·푸시 알림 워크플로.

## 두 곳에 같은 규칙이 있는 것 (하나만 고치면 어긋난다)

| 규칙 | 화면 (index.html) | 빌드 (scripts/) | 테스트 |
|---|---|---|---|
| 쿠폰 만료 판정 | `evaluateCoupon` | `game-pages.js` `evaluate` | tests/coupon.test.js |
| 글자 타일 | `monoOf` | `mono.js` | tests/data.test.js |
| 코드 앵커 | `codeAnchor` | `game-pages.js` `codeAnchor` | tests/data.test.js |
| 코드별 확인일·출처 줄 | `couponSourceHtml` (홈 쿠폰 창) | `game-pages.js` `couponSourceHtml` (코드 표) | tests/data.test.js |
| 목록에 보일 게임 (아래 "코드 없는 게임") | `isListedGame` | `game-pages.js` `isListed` | tests/listing.test.js |
| 위젯 요약 형식·"새 코드" 3일 | (앱 저장소 `ios/App/Shared/CouponFeed.swift`) | `widget-feed.js`, `notify-*.js` | tests/widget.test.js |

## 코드 없는 게임 (2026-10-15~, 애드센스 "가치가 별로 없는 콘텐츠" 대응)

빌드할 때마다 자동으로 정한다. 손으로 숨기거나 되살리지 않는다.

- **A (남김)**: `data/game-listing.json` 의 `keepListedWithoutCodes` 게임. 이 목록은 **이 파일 한 곳에만** 둔다
  (prerender.js 가 index.html 의 `KEEP_LISTED_WITHOUT_CODES` 에 써 넣는다). 코드가 없어도 홈·메뉴·/game/·사이트맵·llms.txt 에 남고,
  페이지에 상태 한 줄 · 지난 코드 기록 · 코드가 나온 흐름 · 넣는 곳 · 새 코드 알림을 보여 준다.
- **B (숨김)**: 그 밖의 게임은 살아 있는 코드(`evaluate`/`evaluateCoupon` 기준)가 0개면 홈 목록·검색·헤더 메뉴(assets/menu.html)·/game/·
  사이트맵·llms.txt·관련 게임 칩·무료 혜택 링크·noscript 요약에서 빠진다. `/game/<id>.html` 은 지우지 않고 `noindex` 로 남긴다(북마크·옮긴 글 이동 안내용).
  코드가 다시 생기면 다음 `node scripts/prerender.js` 에서 저절로 돌아온다. A 게임도 목록에서 빼면 B 를 따른다.
- 앱 위젯 요약(/app/widget.json)은 숨긴 게임도 그대로 넣고, 내 게임 목록(localStorage ecm:fav)·푸시 구독(subscribers.games)은 건드리지 않는다.
  숨긴 게임에 새 코드가 생기면 알림이 그대로 가고, 그 빌드에서 게임도 목록에 돌아온다.
- 블로그 글 본문이 숨긴 게임 페이지로 링크하면 prerender 가 "숨긴 게임으로 가는 블로그 링크"로 알려 준다. 본문은 자동으로 고치지 않는다.
- 지난 코드 기록의 근거는 `data/coupon-seen.json`(등록일)과 `data/coupon-history.json`(보상·공식 만료일·목록에서 내린 날, prerender 가 관리)뿐이다.
  사이트를 연 날(2026-09-21) 첫 커밋에만 있던 예시 코드는 기록에 넣지 않는다.

## 쿠폰 데이터 규칙

- `expireDate`: **공식 만료일만**. `"상시"` 또는 `YYYY-MM-DD`. 공지가 없으면 필드를 뺀다(→ "만료일 미공개").
- `recheckBy`: 내부 재확인 기한. 화면에 날짜로 안 보인다. 지나면 "재확인 필요"로 목록에서 내려간다.
- `src` / `verified` / `cond` (2026-10-13~, 쿠폰 루틴이 채움): 근거로 센 출처 글 주소 1~3개 / 출처로 확인한 날 / 조건(선택).
  게임 페이지 코드 표와 홈 쿠폰 창의 보상 아래에 "확인 YYYY.MM.DD · 출처 도메인" (+ "조건: …")으로 보인다. 없으면 아무것도 안 찍는다.
  형식은 tests/data.test.js 가 검사한다.
  `checked`(게임 단위 조사일)와 다르다. 루틴 지침: 블로그 오토 저장소 `automation/routines/쿠폰_검증_루틴_지침.md`, `로블록스_쿠폰_루틴_지침.md`.
- 날짜는 한국 시간 기준. 만료 후 90일이 지나면 목록에서 지운다.
- 공식 공지나 서로 다른 출처 2곳에서 확인된 코드만 올린다(/about.html#criteria).

## 디자인 규칙

- "클린 노랑": 바탕·헤더는 흰색, 노랑은 로고·주요 버튼·강조에만. 노란 헤더로 되돌리지 않는다.
- 새 화면에 이모지를 쓰지 않는다. 아이콘은 글자 타일(mono)과 Font Awesome.
- Font Awesome 은 쓰는 아이콘만 남긴 `assets/fa.css`(+ `assets/fonts/fa-*.woff`)다. 새 아이콘을 쓰면 `python scripts/fa-subset.py <Font Awesome 6.5.1 package 폴더>` 로 다시 만든다
  (없는 아이콘은 빈칸으로 보이고, tests/fonts.test.js 가 잡는다). 글꼴 `<head>` 줄은 `scripts/font-head.js` 한 곳에서 관리한다 (Pretendard 동적 서브셋).
- `assets/styles.css` 는 미리 빌드한 Tailwind. 새 Tailwind 클래스는 동작하지 않으니 `<style>` 이나 `ecm.css` 에 쓴다.

## 검색 규칙

- 홈 검색(`searchKey`/`searchHit`)과 앱 첫 화면 검색(`assets/ecm-app.js`)은 대소문자·띄어쓰기·문장부호를 무시한다.
  ('펫시뮬레이터' → '펫 시뮬레이터 99', '붕괴 스타레일' → '붕괴: 스타레일'). 두 곳 규칙을 같이 고친다.
- 데이터의 `choseong` 필드는 아직 검색에 안 쓴다.
