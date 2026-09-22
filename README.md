# ECM (Every Coupon Matters)

게임 쿠폰과 쇼핑 할인 정보를 모은 정적 사이트입니다. GitHub Pages로 <https://ecm-coupon.com> 에 배포됩니다.

## ⚠️ 쿠폰을 수정했다면 반드시 이 명령을 실행하세요

```bash
node scripts/prerender.js
```

**왜 필요한가요?**

목록(게임/패션/장보기/OTT/뷰티/배달/여행)은 화면에서 자바스크립트가 그립니다.
그런데 네이버 크롤러(Yeti)와 빙, AI 크롤러 상당수는 자바스크립트를 실행하지 않습니다.
그대로 두면 검색엔진에는 **빈 페이지**로 보입니다.

그래서 `scripts/prerender.js`가 같은 결과를 HTML에 미리 써 넣습니다.
`index.html`의 `initialGameCatalog`이나 다른 카탈로그를 고쳤다면,
**커밋하기 전에 반드시 이 명령을 실행**해야 검색엔진이 보는 내용과 실제 내용이 일치합니다.

이 명령 하나가 다음을 전부 다시 만듭니다.

| 대상 | 내용 |
|---|---|
| 목록 7개 | 카드 HTML을 `<!--PRERENDER:...-->` 마커 사이에 써 넣음 |
| 쿠폰 스키마 | 쿠폰 코드가 담긴 `ItemList` JSON-LD |
| `<noscript>` 요약 | 게임·제휴몰 개수와 이름 (예전엔 손으로 적어 실제와 어긋났음) |
| 블로그 링크 | 홈에서 블로그 글로 가는 링크 목록 |
| `sitemap.xml` | 파일 목록과 git 수정일 기준으로 재생성 |

마크업을 따로 관리하지 않습니다. 페이지의 렌더 함수를 그대로 실행해서 결과를 꺼내므로,
카드 디자인을 바꾸면 미리 렌더링된 HTML도 자동으로 따라갑니다.

## 확인 방법

```bash
# 자바스크립트 문법 검사
node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])"

# 검색엔진이 보는 내용에 게임이 들어갔는지 (0이 아니어야 정상)
node -e "const h=require('fs').readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,''); console.log((h.match(/활성 쿠폰/g)||[]).length)"
```

## 폴더 구조

```
index.html          메인 (카탈로그 데이터 + 렌더 스크립트가 여기 다 들어있음)
blog/               블로그 글 (정적 HTML)
assets/styles.css   미리 빌드된 Tailwind (tailwind.config.js 기준)
scripts/prerender.js 위에서 설명한 빌드 스크립트
sitemap.xml         prerender.js가 생성 (직접 고치지 마세요)
og-image.png        공유 카드 이미지 1200x630
```

### Tailwind 주의

`assets/styles.css`는 미리 빌드된 결과물입니다.
HTML에 **새로운 Tailwind 클래스를 추가해도 CSS가 생성되지 않습니다.**
새 스타일이 필요하면 `index.html`의 `<style>` 블록에 직접 쓰거나,
Tailwind를 다시 빌드하세요.

## 검색엔진 등록

- 네이버: <https://searchadvisor.naver.com> — 소유확인 태그는 `index.html`의 `<!-- SITE-VERIFICATION -->` 아래에 있습니다
- 구글: <https://search.google.com/search-console>
