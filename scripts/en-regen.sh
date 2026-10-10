#!/usr/bin/env bash
# 영어판 /en/ 페이지를 미국 코드 카탈로그 최신본으로 다시 만들어 en-site 브랜치에 올린다.
# 애드센스 승인 전까지 main 에는 절대 올리지 않는다(GitHub Pages 가 main 을 그대로 공개한다).
# 사용: bash scripts/en-regen.sh <ecm-blog-posting>/automation/us/catalog.json
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:?카탈로그 경로를 넘겨 주세요}"
[ -f "$src" ] || { echo "카탈로그 없음: $src"; exit 1; }
br="$(git rev-parse --abbrev-ref HEAD)"
[ "$br" = "en-site" ] || { echo "지금 브랜치가 en-site 가 아님($br) — 중단"; exit 1; }
git pull --ff-only origin en-site
cp "$src" data/en-catalog.json
node scripts/en-pages.js
git add en data/en-catalog.json
if git diff --cached --quiet; then echo "바뀐 것 없음 — 커밋하지 않음"; exit 0; fi
git commit -q -m "영어판 페이지 다시 만들기 ($(TZ=Asia/Seoul date +%F))"
git push origin HEAD:en-site
echo "en-site 반영: $(git rev-parse --short HEAD)"
