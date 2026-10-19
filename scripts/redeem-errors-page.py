# -*- coding: utf-8 -*-
"""쿠폰 오류 메시지 사전 페이지(/guide/redeem-errors.html)를 data/redeem-errors.json 으로 만든다.

데이터는 2026-10-19 게임사 공식 페이지(쿠폰 입력 페이지의 안내·메시지, 고객센터)에서만 모은 것.
항목을 고치거나 더할 때는 data/redeem-errors.json 을 고치고(공식 출처 필수) 이 스크립트를 다시 돌린다:
    python scripts/redeem-errors-page.py
머리말·바닥글은 guide.html 의 것을 그대로 쓴다(guide.html 을 고친 뒤에도 다시 돌릴 것).
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, "data", "redeem-errors.json"), encoding="utf-8"))
shell = open(os.path.join(ROOT, "guide.html"), encoding="utf-8").read()
e = lambda t: html.escape(str(t or ""), quote=True)
checked = data.get("checked", "")

def src_links(sources):
    out = []
    for s in sources or []:
        if not s.get("url"):
            continue
        out.append(f'<a href="{e(s["url"])}" target="_blank" rel="noopener nofollow">{e(s.get("title") or s["url"])}</a>')
    return " · ".join(out)

parts = []
nav = " · ".join(f'<a href="#{e(s["id"])}">{e(s["name"])}</a>' for s in data["systems"])
total = sum(len(s.get("errors", [])) for s in data["systems"])
parts.append(f'''  <main class="ecm-page flex-1 w-full">
    <h1>쿠폰 오류 메시지 사전</h1>
    <p class="ecm-page-meta">게임사 공식 안내 기준 · 확인 {e(checked.replace("-", "."))} · {len(data["systems"])}개 쿠폰 시스템, 오류 {total}개</p>
    <p>쿠폰을 넣었는데 알 수 없는 메시지가 뜨면, 아래에서 게임사를 찾아 같은 문구를 확인해 보세요. 문구마다 원인과 해결 순서를 적었고, 근거가 된 공식 페이지를 함께 달았어요.</p>
    <div class="ecm-box">
      <p><strong>먼저 확인할 세 가지</strong> — 코드를 대소문자·밑줄까지 그대로 넣었는지, 코드를 넣을 계정·서버·캐릭터가 맞는지, 사용 기간이 지나지 않았는지.</p>
      <p>게임사 바로 가기: {nav}</p>
    </div>
    <p class="ecm-err-note">따옴표 안 문구는 게임사 공식 페이지에 나오는 메시지를 그대로 옮긴 것이에요. "공식 안내 요약"이 붙은 항목은 정확한 문구 대신 공식 안내 내용을 정리했어요. 게임사가 문구를 바꿀 수 있으니, 다르게 보이면 <a href="/contact.html">알려 주세요</a>.</p>
''')
for s in data["systems"]:
    parts.append(f'    <h2 id="{e(s["id"])}">{e(s["name"])}</h2>')
    r = s.get("redeem") or {}
    if r.get("where"):
        link = f' <a href="{e(r["url"])}" target="_blank" rel="noopener nofollow">입력 페이지 열기</a>' if r.get("url") else ""
        parts.append(f'    <p><strong>입력하는 곳</strong> — {e(r["where"])}{link}</p>')
    rules = s.get("rules") or []
    if rules:
        parts.append('    <ul>')
        for x in rules:
            parts.append(f'      <li>{e(x["text"])}</li>')
        parts.append('    </ul>')
    for x in s.get("errors") or []:
        exact = x.get("wording") == "exact"
        msg = f'&ldquo;{e(x["message"])}&rdquo;' if exact else f'{e(x["message"])} <span class="ecm-err-tag">공식 안내 요약</span>'
        applies = f'<span class="ecm-err-where">{e(x["applies_to"])}</span>' if x.get("applies_to") else ""
        fix = "".join(f"<li>{e(f)}</li>" for f in x.get("fix") or [])
        parts.append(f'''    <div class="ecm-err">
      <p class="ecm-err-msg">{msg}{applies}</p>
      <p><strong>원인</strong> {e(x.get("cause"))}</p>
      {f"<ol>{fix}</ol>" if fix else ""}
      <p class="ecm-err-src">출처: {src_links(x.get("sources"))}</p>
    </div>''')
parts.append('''    <h2>더 알아보기</h2>
    <p>코드가 계속 안 되면 대부분 코드가 이미 끝난 경우예요. 지금 쓸 수 있는 코드는 <a href="/game/">게임 쿠폰 목록</a>에서, 기능 사용법과 자주 묻는 질문은 <a href="/guide.html">이용 안내</a>에서 볼 수 있어요.</p>
  </main>''')
main = "\n".join(parts)

page = shell
page = re.sub(r"<main class=\"ecm-page flex-1 w-full\">.*?</main>", lambda m: main.strip(), page, count=1, flags=re.S)
desc = f"쿠폰 오류 메시지 사전: 넥슨·넷마블·엔씨·카카오게임즈·스토브·호요버스·로블록스 등 {len(data['systems'])}곳의 쿠폰 오류 문구와 원인, 해결 방법을 공식 안내 기준으로 정리했어요."
page = re.sub(r'<title>[^<]*</title>', '<title>쿠폰 오류 메시지 사전 | ECM 쿠폰</title>', page, count=1)
page = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{e(desc)}">', page, count=1)
page = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{e(desc)}">', page, count=1)
page = page.replace('href="https://ecm-coupon.com/guide.html"', 'href="https://ecm-coupon.com/guide/redeem-errors.html"')
page = page.replace('content="https://ecm-coupon.com/guide.html"', 'content="https://ecm-coupon.com/guide/redeem-errors.html"')
page = page.replace('<meta property="og:title" content="이용 안내 | ECM 쿠폰">', '<meta property="og:title" content="쿠폰 오류 메시지 사전 | ECM 쿠폰">')
ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "쿠폰 오류 메시지 사전", "url": "https://ecm-coupon.com/guide/redeem-errors.html",
      "description": desc, "inLanguage": "ko-KR", "dateModified": checked,
      "isPartOf": {"@type": "WebSite", "name": "ECM 쿠폰 (Every Coupon Matters)", "url": "https://ecm-coupon.com/"}}
page = re.sub(r'<script type="application/ld\+json">.*?</script>', '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>', page, count=1, flags=re.S)
css = '''    .ecm-err { border: 1px solid var(--line); border-radius: 12px; padding: .8rem 1rem; margin: .7rem 0; background: #fff; }
    .ecm-err p { margin: 0 0 .35rem; }
    .ecm-err ol { margin: .2rem 0 .4rem; }
    .ecm-err-msg { font-weight: 800; color: var(--ink); }
    .ecm-err-where { display: block; font-weight: 500; font-size: .8rem; color: var(--ink-3); }
    .ecm-err-tag { font-size: .72rem; font-weight: 700; background: var(--y-pale); border-radius: 6px; padding: .05rem .4rem; margin-left: .3rem; }
    .ecm-err-src { font-size: .78rem; color: var(--ink-3); }
    .ecm-err-src a { font-weight: 600; }
    .ecm-err-note { font-size: .85rem; color: var(--ink-3); }
'''
page = page.replace("  </style>", css + "  </style>", 1)
os.makedirs(os.path.join(ROOT, "guide"), exist_ok=True)
open(os.path.join(ROOT, "guide", "redeem-errors.html"), "w", encoding="utf-8", newline="").write(page)
print(f"redeem-errors.html: {len(data['systems'])} systems, {total} errors")
