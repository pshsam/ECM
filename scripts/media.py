# -*- coding: utf-8 -*-
"""이미지 일괄 작업 (prerender.js 가 부른다).

  python scripts/media.py og   < jobs.json   게임·쇼핑몰 공유 이미지(1200×630 JPG)를 만든다.
        jobs.json: [{"out": "game/og/genshin.jpg", "title": "...", "kind": "game", "genre": "rpg", "label": "..."}]
        디자인은 블로그 썸네일(scripts/thumbnail.py)과 같다: 철모 병아리 + 큰 제목 + 분류 색.
  python scripts/media.py webp <폴더>...      폴더 안 JPG·PNG 옆에 같은 이름의 WebP 를 만든다(없거나 원본이 더 새것일 때만).
        공유 이미지(og)는 메신저 호환 때문에 JPG 그대로 두고, 페이지 안 이미지만 <picture> 로 WebP 를 먼저 준다.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def og(jobs):
    sys.path.insert(0, HERE)
    from thumbnail import make
    n = 0
    for j in jobs:
        out = os.path.join(ROOT, j["out"])
        make(j["title"], j.get("kind", "game"), j.get("genre"), j.get("label", ""), None, out)
        n += 1
    print(f"공유 이미지 {n}장 만듦")


def webp(dirs, quality=80):
    made = 0
    for d in dirs:
        base = os.path.join(ROOT, d)
        for dp, _, files in os.walk(base):
            for f in files:
                if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue
                src = os.path.join(dp, f)
                dst = os.path.splitext(src)[0] + ".webp"
                if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                    continue
                im = Image.open(src)
                if im.mode not in ("RGB", "RGBA"):
                    im = im.convert("RGB")
                im.save(dst, "WEBP", quality=quality, method=6)
                made += 1
    print(f"WebP {made}장 만듦")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "og":
        og(json.loads(sys.stdin.buffer.read().decode("utf-8")))  # 윈도우 기본 인코딩(cp949)으로 읽지 않게
    elif mode == "webp":
        webp(sys.argv[2:])
    else:
        print(__doc__)
        sys.exit(2)
