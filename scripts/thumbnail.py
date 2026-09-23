# -*- coding: utf-8 -*-
"""블로그 글 썸네일(1200×630)을 만든다: 철모 병아리 + 큰 제목 + 분류별 색.

게임 글에 스톡 사진을 쓰면 사무실 블로그처럼 보이고, 게임사 이미지를 쓰면 저작권이
걸린다. 그래서 우리 마스코트와 글자로 만든다. 직접 찍은 화면이 있으면 배경으로 깐다.

사용법:
  python scripts/thumbnail.py --title "원신 쿠폰 코드 총정리" --kind game --genre action \
      --label "게임 쿠폰 · 코드 총정리" --out blog/images/genshin-impact-coupon-codes/thumb.png
  python scripts/thumbnail.py ... --bg 내가찍은화면.png     # 배경 사진 위에 얹기
"""
import argparse
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1200, 630

# 분류별 배경색 (진한 색, 흰 글자가 잘 읽히는 톤)
PALETTE = {
    # 게임: 장르별
    "mmorpg": ("#4B3FA8", "#6D5BD0"),
    "rpg":    ("#1F5FBF", "#3D8BFF"),
    "action": ("#C75A1A", "#F2994A"),
    "fps":    ("#B83232", "#EB5757"),
    "sports": ("#1E8A4C", "#27AE60"),
    "game":   ("#4B3FA8", "#6D5BD0"),
    # 생활
    "fashion":  ("#B0306A", "#E0559A"),
    "grocery":  ("#1E7A4A", "#2FA86A"),
    "ott":      ("#9E1F2E", "#D63A4A"),
    "beauty":   ("#B03A78", "#E36AA8"),
    "delivery": ("#C0561B", "#F0894A"),
    "travel":   ("#1E6FA8", "#3E9BD9"),
    "life":     ("#1E7A4A", "#2FA86A"),
    # 가이드·플랫폼: 브랜드 노랑을 어둡게
    "guide":    ("#8A6A00", "#C49A00"),
    "platform": ("#2B3A55", "#4A5E85"),
}
YELLOW = "#FFE14D"
INK = "#1A1600"


def font(size, bold=True):
    """Pretendard 가 있으면 쓰고, 없으면 나눔고딕."""
    cands = [
        os.path.join(HERE, "fonts", "Pretendard-ExtraBold.otf" if bold else "Pretendard-Medium.otf"),
        os.path.join(HERE, "fonts", "NanumGothic-Bold.ttf" if bold else "NanumGothic-Regular.ttf"),
        os.path.join(HERE, "..", "..", "블로그 오토", "automation", "scripts", "fonts",
                     "NanumGothic-Bold.ttf" if bold else "NanumGothic-Regular.ttf"),
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
    ]
    for p in cands:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ───────── 마스코트 (assets/mascot.svg 와 같은 좌표계 0~200) ─────────
def _bezier(p0, p1, p2, p3, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def _ellipse_pts(cx, cy, rx, ry, deg=0, n=64, start=0, end=360):
    a = math.radians(deg)
    pts = []
    for i in range(n + 1):
        t = math.radians(start + (end - start) * i / n)
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return pts


def draw_mascot(size):
    """size×size RGBA 이미지에 마스코트를 그린다. 4배로 그려 줄여서 계단 현상을 없앤다."""
    S = 4
    s = size * S / 200.0
    img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    P = lambda x, y: (x * s, y * s)
    poly = lambda pts, fill: d.polygon([P(*p) for p in pts], fill=fill)
    ell = lambda cx, cy, rx, ry, fill: d.ellipse([P(cx - rx, cy - ry), P(cx + rx, cy + ry)], fill=fill)

    def line(pts, fill, w):
        pts = [P(*p) for p in pts]
        d.line(pts, fill=fill, width=int(w * s), joint="curve")
        r = w * s / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    # 발
    for x in (86, 114):
        line([(x, 180), (x, 190)], "#C8783C", 4.5)
        for dx, dy in ((-11, 7), (0, 9), (11, 7)):
            line([(x, 190), (x + dx, 190 + dy)], "#C8783C", 4.5)
    # 몸통·배·날개·머리
    ell(100, 142, 50, 42, "#FFE14D")
    ell(100, 158, 24, 16, "#FFF3B0")
    poly(_ellipse_pts(78, 150, 13, 23, 40), "#F7C600")
    poly(_ellipse_pts(122, 150, 13, 23, -40), "#F7C600")
    ell(100, 92, 40, 40, "#FFE14D")
    # 눈·부리·입
    ell(86, 99, 3.6, 3.6, INK)
    ell(114, 99, 3.6, 3.6, INK)
    poly([(93, 106), (107, 106), (100, 117)], "#F28C00")
    mouth = _bezier((94, 123), (98, 126), (102, 126), (106, 123), 16)
    line(mouth, "#C87A5A", 2)
    # 철모: 뒤 테, 돔
    ell(100, 78, 60, 11, "#5E7A38")
    dome = _bezier((46, 78), (46, 22), (154, 22), (154, 78)) + [(46, 78)]
    poly(dome, "#86A85A")
    # 그물망 (돔 안에만)
    net = Image.new("RGBA", img.size, (0, 0, 0, 0))
    nd = ImageDraw.Draw(net)
    for i in range(7):
        x = 30 + 14 * i
        nd.line([P(x, 22), P(x + 58, 80)], fill=(107, 75, 42, 180), width=int(1.8 * s))
        x = 86 + 14 * i
        nd.line([P(x, 22), P(x - 58, 80)], fill=(107, 75, 42, 180), width=int(1.8 * s))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon([P(*p) for p in dome], fill=255)
    img.paste(net, (0, 0), Image.composite(net.split()[3], Image.new("L", img.size, 0), mask))
    d = ImageDraw.Draw(img)
    # 철모: 앞 테 + 밝은 선
    poly(_ellipse_pts(100, 78, 60, 11, 0, 48, 0, 180), "#5E7A38")
    d.line([P(*p) for p in _ellipse_pts(100, 77, 58, 9, 0, 48, 180, 360)], fill=(157, 189, 112, 200), width=int(2 * s))
    # ECM 패치
    d.rounded_rectangle([P(81, 52), P(119, 67)], radius=3 * s, fill="#F3ECD2", outline="#3F4A1E", width=int(1.5 * s))
    f = font(int(11 * s))
    d.text(P(100, 59.5), "ECM", font=f, fill="#3F4A1E", anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


# ───────── 글자 줄바꿈 ─────────
def wrap(text, f, max_w):
    """한글은 띄어쓰기가 드물어 글자 단위로 자르되, 공백이 있으면 거기서 먼저 자른다."""
    lines, cur = [], ""
    for word in text.split(" "):
        trial = (cur + " " + word).strip()
        if f.getlength(trial) <= max_w:
            cur = trial
            continue
        if cur:
            lines.append(cur)
            cur = ""
        # 단어 하나가 한 줄보다 길면 글자로 자른다
        while f.getlength(word) > max_w:
            for i in range(len(word), 0, -1):
                if f.getlength(word[:i]) <= max_w:
                    lines.append(word[:i])
                    word = word[i:]
                    break
        cur = word
    if cur:
        lines.append(cur)
    return lines


def fit_title(text, max_w, max_lines=3, start=76, end=48):
    for size in range(start, end - 1, -4):
        f = font(size)
        lines = wrap(text, f, max_w)
        if len(lines) <= max_lines:
            return f, lines, size
    f = font(end)
    return f, wrap(text, f, max_w)[:max_lines], end


# ───────── 합성 ─────────
def make(title, kind="guide", genre=None, label="", bg=None, out="thumb.png", site="ecm-coupon.com"):
    key = genre if (kind == "game" and genre in PALETTE) else kind
    dark, light = PALETTE.get(key, PALETTE["guide"])
    img = Image.new("RGB", (W, H), hex_rgb(dark))
    d = ImageDraw.Draw(img)

    if bg and os.path.exists(bg):
        photo = Image.open(bg).convert("RGB")
        # 꽉 채우도록 자르고, 글자가 읽히게 어둡게 + 분류색을 살짝 입힌다
        r = max(W / photo.width, H / photo.height)
        photo = photo.resize((int(photo.width * r) + 1, int(photo.height * r) + 1), Image.LANCZOS)
        x0, y0 = (photo.width - W) // 2, (photo.height - H) // 2
        photo = photo.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.GaussianBlur(1.2))
        tint = Image.new("RGB", (W, H), hex_rgb(dark))
        img = Image.blend(photo, tint, 0.55)
        d = ImageDraw.Draw(img)
    else:
        # 밋밋하지 않게 큰 원 두 개를 연한 색으로
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        lr = hex_rgb(light) + (90,)
        od.ellipse([760, -220, 1360, 380], fill=lr)
        od.ellipse([-260, 330, 340, 930], fill=hex_rgb(light) + (60,))
        img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
        d = ImageDraw.Draw(img)

    # 왼쪽 아래→위 어두운 그라데이션 (글자 밑)
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), int(90 * (y / H)))
    shade = Image.new("RGB", (W, H), (0, 0, 0))
    img.paste(shade, (0, 0), grad.resize((W, H)))
    d = ImageDraw.Draw(img)

    # 라벨 칩
    chip_f = font(26)
    chip = ("ECM  ·  " + label) if label else "ECM"
    cw = chip_f.getlength(chip) + 44
    d.rounded_rectangle([72, 64, 72 + cw, 64 + 52], radius=26, fill=YELLOW)
    d.text((72 + 22, 64 + 26), chip, font=chip_f, fill=INK, anchor="lm")

    # 제목
    f, lines, size = fit_title(title, 720)
    lh = int(size * 1.28)
    total = lh * len(lines)
    y = (H - total) // 2 + 30
    for ln in lines:
        d.text((74, y + 3), ln, font=f, fill=(0, 0, 0, 90))  # 그림자
        d.text((72, y), ln, font=f, fill="white")
        y += lh

    # 마스코트 (오른쪽 아래)
    m = draw_mascot(380)
    img.paste(m, (W - 380 - 50, H - 380 + 8), m)

    # 사이트 주소
    sf = font(22, bold=False)
    d = ImageDraw.Draw(img)
    d.text((72, H - 52), site, font=sf, fill=(255, 255, 255, 200))

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--title", required=True)
    ap.add_argument("--kind", default="guide", help="game | life | guide | platform | fashion | grocery | ott | beauty | delivery | travel")
    ap.add_argument("--genre", help="게임 글일 때: mmorpg | rpg | action | fps | sports")
    ap.add_argument("--label", default="", help="칩에 적을 분류 (예: '게임 쿠폰 · 코드 총정리')")
    ap.add_argument("--bg", help="배경 사진 (직접 찍은 화면)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    print(make(a.title, a.kind, a.genre, a.label, a.bg, a.out))


if __name__ == "__main__":
    sys.exit(main())
