/**
 * 게임 무료 혜택: /free/ (허브) · /free/preregister.html (사전예약 보상 모음) · /free/roblox-codes.html (로블록스 코드 공통 안내)
 *
 * 쿠폰 코드는 나올 때만 검색되지만, "무료로 받는 게임 보상"은 1년 내내 찾는다.
 * 쿠폰·사전예약·방송 쿠폰·PC방·출석·복귀처럼 돈 안 드는 보상을 한곳에 모은다.
 * 사전예약 목록은 data/preregister.json (게임사 발표·공식 스토어·기사로 확인한 것만).
 * prerender.js 가 쿠폰을 갱신할 때마다 같이 다시 만든다.
 */
const fs = require('fs');
const path = require('path');
const { SITE, esc, fmt, pageShell, breadcrumbLd, writeIfChanged } = require('./page-shell');

const TG = 'https://t.me/ecmcoupon';
const KC = 'https://pf.kakao.com/_cIjxiX/friend';

const CSS = `
    .fr-cards { display: grid; gap: .8rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); margin: 0 0 1.5rem; }
    .fr-card { display: grid; gap: .35rem; align-content: start; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 1rem 1.1rem; text-decoration: none; color: var(--ink); }
    a.fr-card:hover { border-color: var(--ink-3); background: var(--sf); }
    .fr-card b { font-size: 1rem; }
    .fr-card span { font-size: .86rem; color: var(--ink-2); line-height: 1.6; }
    .fr-card .fr-num { font-size: 1.4rem; font-weight: 800; color: var(--brown); font-variant-numeric: tabular-nums; }
    .fr-tips { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
    .fr-tips li { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: .85rem 1rem; }
    .fr-tips b { display: block; margin-bottom: .2rem; }
    .fr-tips span { font-size: .88rem; color: var(--ink-2); line-height: 1.7; }
    .fr-tips a, .pr-how a { color: var(--brown); font-weight: 700; }
    .pr-item ul { list-style: disc; }
    .fr-follow { display: flex; flex-wrap: wrap; gap: .5rem; }
    .fr-btn { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem 1rem; border-radius: 999px; font-weight: 700; font-size: .9rem; text-decoration: none; border: 1px solid var(--line); color: var(--ink); background: #fff; }
    .fr-btn.tg { color: #0b6fa4; border-color: #bfe0f2; }
    .fr-btn.kc { background: #FEE500; border-color: #FEE500; color: #191919; }
    .pr-list { display: grid; gap: .9rem; }
    .pr-item { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 1.1rem 1.2rem; }
    .pr-top { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .6rem; }
    .pr-top h2 { font-size: 1.15rem; margin: 0; }
    .pr-pill { font-size: .72rem; font-weight: 800; padding: .15rem .55rem; border-radius: 999px; background: var(--new-soft); color: var(--new); }
    .pr-pill.soon { background: var(--y-soft); color: var(--brown); }
    .pr-meta { font-size: .82rem; color: var(--ink-3); margin: .3rem 0 .6rem; }
    .pr-item ul { margin: .2rem 0 .6rem 1.1rem; padding: 0; font-size: .9rem; line-height: 1.7; }
    .pr-how { font-size: .88rem; color: var(--ink-2); margin: 0 0 .4rem; }
    .pr-src { font-size: .78rem; color: var(--ink-3); margin: .4rem 0 0; }
    .pr-src a { color: var(--ink-2); }
    .fr-faq h3 { font-size: .98rem; color: var(--ink); letter-spacing: 0; margin: 1rem 0 .3rem; }
    .fr-tablewrap { overflow-x: auto; }
    .fr-faq p { font-size: .9rem; color: var(--ink-2); line-height: 1.75; margin: 0; }
`;

const followHtml = where => `    <div class="fr-follow">
      <a class="fr-btn tg" href="${TG}" target="_blank" rel="noopener noreferrer" data-tg="${where}"><i class="fa-brands fa-telegram" aria-hidden="true"></i> 텔레그램으로 새 쿠폰 알림 받기</a>
      <a class="fr-btn kc" href="${KC}" target="_blank" rel="noopener noreferrer" data-kc="${where}"><i class="fa-solid fa-comment" aria-hidden="true"></i> 카카오톡 채널 추가</a>
    </div>`;

function loadPre(rootDir) {
  try { return JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'preregister.json'), 'utf8')); } catch (e) { return { games: [] }; }
}

function kstToday() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }

function statusPill(g, today) {
  if (g.status === 'launched') return '<span class="pr-pill soon">출시됨</span>';
  if (g.status === 'closed') return '<span class="pr-pill soon">사전예약 끝남</span>';
  const m = /^\d{4}-\d{2}-\d{2}$/.test(g.launch || '') ? Math.round((Date.parse(g.launch) - Date.parse(today)) / 864e5) : null;
  return `<span class="pr-pill">사전예약 중</span>${m !== null && m >= 0 ? ` <span class="pr-pill soon">출시 D-${m}</span>` : ''}`;
}

function writeFreePages(rootDir, { games = [], evaluate, gamePageIds = [], headerHtml, footerHtml }) {
  const dir = path.join(rootDir, 'free');
  fs.mkdirSync(dir, { recursive: true });
  const today = kstToday();
  const pre = loadPre(rootDir);
  const open = (pre.games || []).filter(g => g.status === 'open');

  // 지금 쓸 수 있는 쿠폰 수
  let codes = 0, withCodes = 0;
  for (const g of games) {
    const n = (g.coupons || []).filter(c => evaluate ? evaluate(c).active : true).length;
    codes += n; if (n) withCodes++;
  }

  // ── /free/ 허브
  const hubTitle = '게임 무료 혜택 모음: 쿠폰·사전예약·방송 쿠폰 | ECM';
  const hubDesc = '게임 쿠폰 코드, 사전예약 보상, 방송·PC방·출석 보상까지 돈 안 들이고 받는 게임 혜택을 한곳에 모았어요.';
  const hubBody = `    <p class="hub-crumb"><a href="/">ECM</a> › 게임 무료 혜택</p>
    <header class="hub-head">
      <h1>게임 무료 혜택 모음</h1>
      <p class="hub-lede">돈 한 푼 안 들이고 받을 수 있는 게임 보상을 모았어요. 쿠폰 코드는 매일 게임사 공식 채널에서 확인하고, 사전예약은 게임사 발표로 확인한 것만 올려요.</p>
    </header>

    <div class="fr-cards">
      <a class="fr-card" href="/today/"><span class="fr-num">${codes}</span><b>지금 쓸 수 있는 쿠폰 코드</b><span>게임 ${withCodes}개 · 오늘 새로 나온 코드와 곧 끝나는 코드를 먼저 보여 줘요.</span></a>
      <a class="fr-card" href="/free/preregister.html"><span class="fr-num">${open.length}</span><b>사전예약 중인 신작</b><span>출시 전에 신청만 해 두면 출시 날 보상을 받아요.</span></a>
      <a class="fr-card" href="/game/"><span class="fr-num">${gamePageIds.length}</span><b>게임별 쿠폰 입력 방법</b><span>어디서 넣는지, 안 될 때 확인할 점까지 게임마다 정리했어요.</span></a>
      <a class="fr-card" href="/free/roblox-codes.html"><b>로블록스 코드 사용법</b><span>게임 코드와 roblox.com/redeem 코드는 넣는 곳이 달라요. 종류별로 정리했어요.</span></a>
    </div>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-gift" aria-hidden="true"></i> 놓치기 쉬운 무료 보상</h2>
      <ul class="fr-tips">
        <li><b>공식 방송 쿠폰</b><span>게임사가 업데이트 발표 방송이나 대회 중계 화면에 쿠폰 코드를 띄우는 경우가 있어요. 입력 시간이 정해진 경우가 많으니 방송 중에 바로 넣으세요. 예: <a href="/game/fconline.html">FC 온라인 FCL 생방송</a>, <a href="/game/lostark.html">로스트아크 로아온</a></span></li>
        <li><b>사전예약 보상</b><span>신작은 출시 전 사전예약만 해도 아이템을 줘요. 예약 인원이 목표를 넘을 때마다 보상이 늘어나는 방식도 많아요. <a href="/free/preregister.html">사전예약 보상 모음 보기</a></span></li>
        <li><b>PC방 혜택</b><span>일부 PC 게임은 제휴 PC방에서 접속하면 추가 보상이나 전용 쿠폰을 줘요. 게임 공식 홈페이지의 PC방 이벤트 안내를 확인하세요. 예: <a href="/game/fconline.html">FC 온라인 PC방 스페셜 쿠폰</a></span></li>
        <li><b>출석·복귀 이벤트</b><span>업데이트 때 며칠 접속만 해도 주는 출석 보상, 오래 쉬었던 계정에 주는 복귀 보상은 쿠폰 없이 게임 안에서 받아요. 오랜만에 들어가면 이벤트 공지부터 확인하세요.</span></li>
        <li><b>쿠폰은 계정당 한 번</b><span>대부분 쿠폰은 계정마다 한 번만 쓸 수 있고, 만료일이 지나면 받을 수 없어요. 등록일과 만료일이 적힌 곳에서 확인해야 헛걸음하지 않아요.</span></li>
      </ul>
    </section>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-bell" aria-hidden="true"></i> 새 쿠폰 알림 받기</h2>
      <p class="hub-lede">새 코드가 확인되면 텔레그램으로 바로, 카카오톡 채널로는 한 주 모음을 보내 드려요.</p>
${followHtml('free')}
    </section>
`;
  const hubLd = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '게임 무료 혜택 모음', description: hubDesc, url: SITE + '/free/', inLanguage: 'ko', dateModified: today,
      isPartOf: { '@type': 'WebSite', name: 'ECM 쿠폰', url: SITE + '/' } },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '게임 무료 혜택', path: '/free/' }]),
  ];
  let written = 0;
  if (writeIfChanged(fs, path.join(dir, 'index.html'), pageShell({ title: hubTitle, desc: hubDesc, path: '/free/', ld: hubLd, style: CSS, body: hubBody, headerHtml, footerHtml }))) written++;

  // ── /free/preregister.html
  const items = (pre.games || []).filter(g => g.status !== 'closed');
  const preTitle = `사전예약 보상 모음 (${+today.slice(5, 7)}월): 신작 게임 사전예약 | ECM`;
  const preDesc = '지금 사전예약 중인 신작 게임과 보상, 출시일, 받는 방법을 게임사 발표 기준으로 정리했어요.';
  const card = g => `      <article class="pr-item" id="${esc(g.id)}">
        <div class="pr-top"><h2>${esc(g.title)}</h2>${statusPill(g, today)}</div>
        <p class="pr-meta">${esc(g.publisher)} · ${esc(g.platform)}${g.genre ? ` · ${esc(g.genre)}` : ''} · 출시 ${esc(/^\d{4}-\d{2}-\d{2}$/.test(g.launch || '') ? fmt(g.launch) : g.launch || '미정')}${g.start ? ` · 사전예약 ${esc(fmt(g.start))}부터` : ''}</p>
        <ul>${(g.rewards || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <p class="pr-how"><b>받는 법</b> · ${esc(g.how || '공식 사전예약 페이지에서 신청')}${g.redeemUrl ? ` · <a href="${esc(g.redeemUrl)}" target="_blank" rel="noopener noreferrer">쿠폰 입력 페이지 ↗</a>` : ''}</p>
        <p class="pr-src">확인한 곳: ${(g.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`).join(' · ')}${g.checked ? ` (${esc(fmt(g.checked))} 확인)` : ''}</p>
      </article>`;
  const preBody = `    <p class="hub-crumb"><a href="/">ECM</a> › <a href="/free/">게임 무료 혜택</a> › 사전예약 보상</p>
    <header class="hub-head">
      <h1>사전예약 보상 모음 <small>${esc(fmt(pre.updated || today))} 확인</small></h1>
      <p class="hub-lede">지금 사전예약을 받는 신작 게임과 보상을 모았어요. 게임사 발표나 공식 스토어·기사로 확인한 내용만 적고, 출처와 확인 날짜를 함께 남겨요. 보상은 게임사 사정에 따라 바뀔 수 있어요.</p>
    </header>
    <div class="pr-list">
${items.length ? items.map(card).join('\n') : '      <p>지금 확인된 사전예약이 없어요. 새 사전예약이 확인되면 여기에 올릴게요.</p>'}
    </div>

    <section class="hub-sec fr-faq">
      <h2>자주 묻는 질문</h2>
      <h3>사전예약 보상은 언제 받나요?</h3>
      <p>보통 게임이 출시된 뒤에 받아요. 게임 안 우편함으로 자동으로 들어오거나, 신청할 때 적은 휴대폰 번호로 쿠폰 코드가 와서 직접 입력하는 방식이 많아요. 위 게임마다 적힌 "받는 법"을 확인하세요.</p>
      <h3>사전예약 인원 달성 보상이 뭐예요?</h3>
      <p>사전예약한 사람 수가 정해진 목표(예: 10만, 50만 명)를 넘을 때마다 모두에게 주는 보상이 늘어나는 방식이에요. 최종 보상은 사전예약이 끝날 때의 인원으로 정해져요.</p>
      <h3>사전예약을 여러 곳에서 하면 보상을 더 받나요?</h3>
      <p>게임사 보상은 보통 계정이나 휴대폰 번호당 한 번이에요. 다만 스토어 사전 등록, 공식 홈페이지 사전예약, 게임 플랫폼 이벤트가 따로 보상을 주는 경우도 있으니 각 안내를 확인하세요.</p>
    </section>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-bell" aria-hidden="true"></i> 출시되면 쿠폰도 알려 드려요</h2>
${followHtml('preregister')}
    </section>
`;
  const preLd = [
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '사전예약 보상 모음', url: SITE + '/free/preregister.html',
      itemListElement: items.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: `${SITE}/free/preregister.html#${g.id}` })) },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '게임 무료 혜택', path: '/free/' }, { name: '사전예약 보상', path: '/free/preregister.html' }]),
  ];
  if (writeIfChanged(fs, path.join(dir, 'preregister.html'), pageShell({ title: preTitle, desc: preDesc, path: '/free/preregister.html', ld: preLd, style: CSS, body: preBody, headerHtml, footerHtml }))) written++;

  // ── /free/roblox-codes.html (로블록스 코드 공통 안내: 로블록스 공식 도움말 기준)
  // 로블록스 게임 페이지마다 같은 설명을 길게 반복하지 않도록, 공통 내용은 여기 한 곳에 두고 게임 페이지는 링크만 건다.
  const rbx = games.filter(g => String(g.id).startsWith('roblox-') && gamePageIds.includes(g.id));
  const rbxRow = g => {
    const n = (g.coupons || []).filter(c => evaluate ? evaluate(c).active : true).length;
    return `        <tr><td><a href="/game/${esc(g.id)}.html">${esc(g.title)}</a></td><td>${esc(g.redeemHow || '게임 안 코드 입력 메뉴')}</td><td>${n ? `${n}개` : '-'}</td></tr>`;
  };
  const RB_HELP = 'https://en.help.roblox.com/hc/ko/articles/';
  const rbxTitle = '로블록스 코드 사용법 총정리: 게임 코드·프로모션 코드·기프트 카드 | ECM';
  const rbxDesc = '로블록스 게임 코드는 어디에 넣고, roblox.com/redeem에는 어떤 코드를 넣는지 로블록스 공식 도움말 기준으로 정리했어요. 게임별 입력 위치 표도 함께 있어요.';
  const rbxBody = `    <p class="hub-crumb"><a href="/">ECM</a> › <a href="/free/">게임 무료 혜택</a> › 로블록스 코드 사용법</p>
    <header class="hub-head">
      <h1>로블록스 코드 사용법 총정리</h1>
      <p class="hub-lede">로블록스에서 "코드"라고 부르는 건 세 종류예요. 넣는 곳이 다 달라서, 엉뚱한 곳에 넣으면 "잘못된 코드"라고 나와요. 아래 내용은 로블록스 공식 도움말을 기준으로 정리했어요.</p>
    </header>

    <div class="fr-cards">
      <div class="fr-card"><b>① 게임(체험) 코드</b><span>블록스 프루트, 그로우 어 가든처럼 각 게임을 만든 개발자가 주는 코드예요. <b>그 게임 안</b>의 코드 입력 창에 넣어요.</span></div>
      <div class="fr-card"><b>② 로블록스 프로모션·기프트 카드 코드</b><span>로블록스가 이벤트로 주는 코드나 기프트 카드 번호예요. <b>roblox.com/redeem</b>에서 넣어요.</span></div>
      <div class="fr-card"><b>③ 장난감(굿즈) 코드</b><span>로블록스 장난감·굿즈에 들어 있는 가상 아이템 코드예요. 이것도 <b>roblox.com/redeem</b>에서 넣어요.</span></div>
    </div>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-gamepad" aria-hidden="true"></i> ① 게임 코드는 게임 안에서 넣어요</h2>
      <p class="hub-lede">게임 코드는 게임마다 입력 위치가 달라요. 게임에 들어가서 화면의 Codes, 설정(톱니바퀴), 상점 같은 버튼을 찾아야 해요. ECM에서 쿠폰을 모으는 로블록스 게임의 입력 위치는 아래와 같아요.</p>
      <div class="fr-tablewrap"><table class="hub-table">
        <thead><tr><th>게임</th><th>코드 넣는 곳</th><th>지금 쓸 수 있는 코드</th></tr></thead>
        <tbody>
${rbx.map(rbxRow).join('\n')}
        </tbody>
      </table></div>
      <p class="pr-src">게임 코드는 개발자가 업데이트 때 공개하고, 짧게 끝나는 경우가 많아요. 게임 페이지에서 코드마다 등록일과 만료일을 확인하세요.</p>
    </section>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-ticket" aria-hidden="true"></i> ② roblox.com/redeem에 넣는 코드</h2>
      <ul class="fr-tips">
        <li><b>브라우저에서 넣어요</b><span>roblox.com/redeem에 들어가 로그인하고 코드를 넣은 뒤 [사용]을 누르면 돼요. 일반 모바일 앱과 콘솔에는 이 사용 메뉴가 없어서 웹 브라우저로 해야 해요. 삼성 갤럭시 기기만 로블록스 앱 안에서 바로 넣을 수 있어요.</span></li>
        <li><b>잘못된 코드라고 나오면</b><span>비슷하게 생긴 글자를 바꿔 보세요. 숫자 0은 알파벳 O, 1은 I, 2는 Z, 5는 S, 6은 G나 Q, 8은 B로 바꿔서 넣으면 되는 경우가 있어요.</span></li>
        <li><b>프로모션 코드는 빨리 쓰세요</b><span>로블록스 프로모션 코드는 짧은 기간 안에 만료되거나 비활성화될 수 있어요. 받으면 바로 쓰는 게 좋아요.</span></li>
        <li><b>다른 나라 기프트 카드도 돼요</b><span>로블록스 코드는 전 세계에서 쓸 수 있고, 금액은 내 계정의 현지 통화로 바뀌어 들어가요.</span></li>
      </ul>
    </section>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-cube" aria-hidden="true"></i> ③ 장난감(굿즈) 코드</h2>
      <p class="hub-lede">장난감 코드는 패키지 안 코드 카드나 토큰에 있어요. 가려져 있으면 살살 긁어서 확인한 뒤 roblox.com/redeem에 넣으면, 계정 인벤토리의 해당 카테고리(모자, 배낭 등)에 아이템이 들어가요. 같은 아이템 코드는 계정당 한 번만 쓸 수 있고, 받은 아이템은 팔거나 거래할 수 없어요. 게임 안 굿즈 코드(예: <a href="/game/roblox-pet-simulator-99.html">펫 시뮬레이터 99</a>)는 그 게임 안에서 넣어요.</p>
    </section>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> "무료 Robux 코드"는 모두 사기예요</h2>
      <p class="hub-lede">로블록스는 무료 Robux나 구독을 주는 코드, 요령, 생성기는 존재하지 않는다고 안내해요. 그런 걸 준다는 사람·영상·사이트는 비밀번호와 계정을 노리는 속임수예요. 로블록스 로그인 페이지가 아닌 곳에는 비밀번호를 넣지 말고, 의심스러운 링크는 누르지 마세요.</p>
      <p class="pr-src">확인한 곳: <a href="${RB_HELP}115005566223" target="_blank" rel="noopener noreferrer">Roblox 지원: 기프트 카드 교환 및 사용 방법</a> · <a href="${RB_HELP}360029650831" target="_blank" rel="noopener noreferrer">프로모션 코드 사용 방법</a> · <a href="${RB_HELP}360000316606" target="_blank" rel="noopener noreferrer">장난감 및 가상 아이템 코드 사용 방법</a> · <a href="${RB_HELP}204262550" target="_blank" rel="noopener noreferrer">무료 Robux 또는 구독 생성기</a> (2026. 9. 29. 확인)</p>
    </section>

    <section class="hub-sec">
      <h2><i class="fa-solid fa-bell" aria-hidden="true"></i> 새 로블록스 코드 알림 받기</h2>
${followHtml('roblox')}
    </section>
`;
  const rbxLd = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: '로블록스 코드 사용법 총정리', description: rbxDesc, url: SITE + '/free/roblox-codes.html', inLanguage: 'ko', dateModified: today,
      author: { '@type': 'Organization', name: 'ECM 쿠폰', url: SITE + '/' } },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '게임 무료 혜택', path: '/free/' }, { name: '로블록스 코드 사용법', path: '/free/roblox-codes.html' }]),
  ];
  if (rbx.length && writeIfChanged(fs, path.join(dir, 'roblox-codes.html'), pageShell({ title: rbxTitle, desc: rbxDesc, path: '/free/roblox-codes.html', ld: rbxLd, style: CSS, body: rbxBody, headerHtml, footerHtml }))) written++;

  return { written, open: open.length };
}

module.exports = { writeFreePages };
