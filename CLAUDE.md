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
index.html              홈. 게임·쇼핑 카탈로그 데이터 + 화면 스크립트가 전부 이 안에 있다
  initialGameCatalog      게임 목록 (id, title, category, platforms, genre, coupons[...], redeemHow ...)
  raw*Catalog             쇼핑몰 6분야 (fashion·grocery·ott·beauty·delivery·travel)
  <!--PRERENDER:x-->      빌드가 채우는 자리. 손으로 고치지 않는다
scripts/prerender.js    빌드. index.html 스크립트를 가짜 DOM 에서 실행해 HTML 을 미리 그리고,
                        아래 페이지 생성기를 차례로 부른다
  game-pages.js           /game/<id>.html  (게임별 쿠폰 페이지, evaluate = 빌드 쪽 만료 판정)
  hubs.js                 /game/            today-page.js  /today/
  shop-pages.js           /shop/            free-pages.js  /free/
  llms-txt.js · analytics.js · pwa.js · media.js(+python) · mono.js
scripts/notify-*.js     새 쿠폰 텔레그램·푸시 알림 (.github/workflows 가 실행)
data/                   빌드·알림이 쓰는 장부 (coupon-seen = 코드 첫 등록일, *-sent = 알림 보낸 기록)
assets/ecm.js           모든 페이지 공통 스크립트 (메뉴, 내 게임, 서비스 워커 등록)
assets/ecm-app.js       안드로이드 앱 안에서만 (쇼핑 숨김, 탭 바)
assets/ecm-push.js      웹 푸시 구독 → 파이어스토어 subscribers/{토큰} 에 {games, updated, ua} 만 저장
blog/                   블로그 글 (정적 HTML, 글쓰기 루틴이 추가)
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

## 쿠폰 데이터 규칙

- `expireDate`: **공식 만료일만**. `"상시"` 또는 `YYYY-MM-DD`. 공지가 없으면 필드를 뺀다(→ "만료일 미공개").
- `recheckBy`: 내부 재확인 기한. 화면에 날짜로 안 보인다. 지나면 "재확인 필요"로 목록에서 내려간다.
- 날짜는 한국 시간 기준. 만료 후 90일이 지나면 목록에서 지운다.
- 공식 공지나 서로 다른 출처 2곳에서 확인된 코드만 올린다(/about.html#criteria).

## 디자인 규칙

- "클린 노랑": 바탕·헤더는 흰색, 노랑은 로고·주요 버튼·강조에만. 노란 헤더로 되돌리지 않는다.
- 새 화면에 이모지를 쓰지 않는다. 아이콘은 글자 타일(mono)과 Font Awesome.
- `assets/styles.css` 는 미리 빌드한 Tailwind. 새 Tailwind 클래스는 동작하지 않으니 `<style>` 이나 `ecm.css` 에 쓴다.

## 검색 규칙

- 홈 검색(`searchKey`/`searchHit`)과 앱 첫 화면 검색(`assets/ecm-app.js`)은 대소문자·띄어쓰기·문장부호를 무시한다.
  ('펫시뮬레이터' → '펫 시뮬레이터 99', '붕괴 스타레일' → '붕괴: 스타레일'). 두 곳 규칙을 같이 고친다.
- 데이터의 `choseong` 필드는 아직 검색에 안 쓴다.
