"""Font Awesome 를 이 사이트가 쓰는 아이콘만 남겨 assets/fa.css + assets/fonts/fa-*.woff 로 만든다.

CDN 의 all.min.css 와 글꼴 3개(약 310KB)를 받던 것을 수십 KB 로 줄이려고 만들었다.
새 아이콘(fa-이름)을 템플릿·스크립트에 쓰면 이 스크립트를 다시 돌려야 화면에 보인다.
(tests/fa.test.js 가 빠진 아이콘을 잡아 준다.)

준비: Font Awesome Free 6.5.1 패키지 (npm pack @fortawesome/fontawesome-free@6.5.1 → 압축 풀기)
      pip install fonttools
실행: python scripts/fa-subset.py <압축 푼 package 폴더>
"""
import os
import re
import sys

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', '.claude', 'node_modules', 'app', 'tests'}
STYLE_CLASSES = {'fa-solid', 'fa-regular', 'fa-brands', 'fa-classic', 'fa-sharp'}
FONTS = [  # (패키지 글꼴, 만들 파일, font-family, weight)
    ('fa-solid-900.ttf', 'fa-solid.woff', 'Font Awesome 6 Free', 900),
    ('fa-regular-400.ttf', 'fa-regular.woff', 'Font Awesome 6 Free', 400),
    ('fa-brands-400.ttf', 'fa-brands.woff', 'Font Awesome 6 Brands', 400),
]


def used_names():
    names = set()
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if f.endswith(('.html', '.js', '.json')) and f != 'fa.css':
                with open(os.path.join(d, f), encoding='utf-8', errors='ignore') as fh:
                    names.update(re.findall(r'\bfa-[a-z0-9]+(?:-[a-z0-9]+)*', fh.read()))
    return names


def main(pkg):
    icon_rule = re.compile(r'((?:\.fa-[a-z0-9-]+:before,?)+)\{content:"\\([0-9a-f]+)"\}')
    css = open(os.path.join(pkg, 'css', 'fontawesome.min.css'), encoding='utf-8').read()
    # 브랜드 아이콘(fa-telegram 등) 정의는 brands.min.css 에만 있다
    brands = open(os.path.join(pkg, 'css', 'brands.min.css'), encoding='utf-8').read()
    css += ''.join(m.group(0) for m in icon_rule.finditer(brands))
    names = used_names()
    codepoints, missing = set(), set(n for n in names if n not in STYLE_CLASSES)

    def keep(m):
        sels = [s for s in m.group(1).split(',') if s]
        mine = [s for s in sels if s[1:-len(':before')] in names]
        if not mine:
            return ''
        for s in mine:
            missing.discard(s[1:-len(':before')])
        codepoints.add(int(m.group(2), 16))
        return ','.join(mine) + '{content:"\\' + m.group(2) + '"}'

    css = icon_rule.sub(keep, css)
    # 아이콘이 아닌 fa-* (fa-fw 같은 보조 클래스, 애니메이션 이름) 는 정의된 그대로 둔다
    missing = {n for n in missing if not re.search(r'\.' + re.escape(n) + r'\b|@(?:-webkit-)?keyframes ' + re.escape(n) + r'\b', css)}

    out_dir = os.path.join(ROOT, 'assets', 'fonts')
    os.makedirs(out_dir, exist_ok=True)
    faces = []
    for src, dst, family, weight in FONTS:
        opts = subset.Options()
        opts.flavor = 'woff'
        opts.layout_features = []
        opts.hinting = False
        opts.desubroutinize = True
        font = subset.load_font(os.path.join(pkg, 'webfonts', src), opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=sorted(codepoints))
        sub.subset(font)
        subset.save_font(font, os.path.join(out_dir, dst), opts)
        faces.append('@font-face{font-family:"%s";font-style:normal;font-weight:%d;font-display:block;'
                     'src:url(/assets/fonts/%s) format("woff")}' % (family, weight, dst))
    # fontawesome.min.css 의 기본 규칙(.fa-solid 등)이 쓰는 변수
    faces.append(':root{--fa-style-family-classic:"Font Awesome 6 Free";--fa-font-solid:normal 900 1em/1 "Font Awesome 6 Free";'
                 '--fa-font-regular:normal 400 1em/1 "Font Awesome 6 Free";--fa-style-family-brands:"Font Awesome 6 Brands";'
                 '--fa-font-brands:normal 400 1em/1 "Font Awesome 6 Brands"}')
    faces.append('.fa-solid,.fas{font-weight:900}.fa-regular,.far{font-weight:400}.fa-brands,.fab{font-weight:400}')

    header = ('/* Font Awesome Free 6.5.1 subset (scripts/fa-subset.py 로 생성 — 손으로 고치지 않는다)\n'
              ' * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) */\n')
    body = re.sub(r'^/\*![\s\S]*?\*/\s*', '', css)
    with open(os.path.join(ROOT, 'assets', 'fa.css'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(header + ''.join(faces) + body + '\n')
    print('icons', len(codepoints), 'css', len(header + ''.join(faces) + body), 'bytes')
    for _, dst, _, _ in FONTS:
        print(dst, os.path.getsize(os.path.join(out_dir, dst)), 'bytes')
    if missing:
        print('Font Awesome 6.5.1 에 없는 이름 (오타·옛 이름인지 확인):', ' '.join(sorted(missing)))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
