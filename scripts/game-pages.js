/**
 * 게임별 쿠폰 페이지를 만든다: /game/<id>.html
 *
 * 쿠폰이 전부 첫 화면 한 장에 몰려 있으면 "원신 쿠폰"으로 검색한 사람이 메인에 떨어져
 * 헤맨다. 게임마다 페이지를 두면 검색은 그 페이지로 바로 오고, 검색엔진에도 페이지가
 * 게임 수만큼 생긴다. 내용이 없는 페이지를 만들면 오히려 손해라, 살아 있는 코드가 있거나
 * 입력 방법이 확인된 게임만 만든다. 조건에서 빠진 게임의 페이지는 지운다.
 *
 * prerender.js 가 호출한다. 카탈로그가 바뀔 때마다 다시 생성되므로 손으로 고치지 않는다.
 */
const fs = require('fs');
const path = require('path');
const { GA_SNIPPET } = require('./analytics');
const { monoBox } = require('./mono');

const SITE = 'https://ecm-coupon.com';

/** 게임별 "쿠폰, 이것만 알아 두세요" (data/game-notes.json). 공식 안내로 확인한 내용과 출처·확인일. 없으면 단락을 만들지 않는다 */
const GAME_NOTES = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'game-notes.json'), 'utf8')); } catch (e) { return {}; }
})();
const AUTHOR_NAME = '겜대';

const GENRE_LABELS = { mmorpg: 'MMORPG', rpg: '수집형/RPG', action: '액션/오픈월드', fps: 'FPS/슈팅', sports: '스포츠/전략' };
const PLATFORM_LABELS = { pc: 'PC', mobile: '모바일', ps5: 'PS5', switch: '닌텐도 스위치', cross: '크로스플랫폼', roblox: '로블록스' };

const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = d => (d || '').replace(/-/g, '.');

/** 페이지를 만들 자격: 살아 있는 코드가 있거나, 입력 방법이 확인된 게임 */
function qualifies(g, activeOf) {
  return activeOf(g).length > 0 || !!(g.redeemHow && g.redeemHow.trim());
}

/** 한국 날짜 기준 오늘(자정)을 UTC 밀리초로. 빌드가 한국(PC)에서 돌든 UTC(클라우드 루틴)에서 돌든 같은 D-day 가 나오게 한다. */
function kstTodayUTC() {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
}

// today 인자는 예전 호출과의 호환용이다. 날짜만(YYYY-MM-DD) 한국 기준으로 비교한다.
function evaluate(expireDate, today) {
  if (!expireDate || expireDate === '상시' || /9999/.test(expireDate)) return { active: true, text: '상시 유효', left: null };
  const m = String(expireDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { active: true, text: '상시 유효', left: null };
  const left = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - kstTodayUTC()) / 86400000);
  if (left >= 0) return { active: true, text: left === 0 ? '오늘 마감' : `D-${left}`, left };
  return { active: false, text: `${-left}일 전 만료`, left };
}

/** 게임별 쿠폰 특징 단락 */
function noteHtml(g) {
  const n = GAME_NOTES[g.id];
  if (!n || !n.note) return '';
  const src = (n.sources || []).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a>`).join(' · ');
  return `    <h2 id="coupon-notes">${esc(g.title)} 쿠폰, 이것만 알아 두세요</h2>
    <p>${esc(n.note)}</p>
    <p class="ecm-note-src">확인한 곳: ${src}${n.checked ? ` (${esc(fmt(n.checked))} 확인)` : ''}</p>

`;
}

function headerHtml() {
  return `  <header id="siteHeader" class="ecm-header">
    <div class="ecm-header-inner">
      <a href="/" class="ecm-logo" aria-label="ECM 홈">
        <img class="ecm-logo-img" src="/assets/logo.svg" alt="" width="360" height="100">
      </a>
      <nav class="ecm-menu" aria-label="주 메뉴">
        <a href="/game/" class="ecm-menu-btn" data-menu="games" aria-haspopup="true" aria-expanded="false">게임 쿠폰 <i class="fa-solid fa-chevron-down"></i></a>
        <a href="/shop/" class="ecm-menu-btn" data-menu="shops" aria-haspopup="true" aria-expanded="false">쇼핑 할인 <i class="fa-solid fa-chevron-down"></i></a>
        <a href="/blog/index.html" class="ecm-menu-btn" data-menu="blog" aria-haspopup="true" aria-expanded="false">블로그 <i class="fa-solid fa-chevron-down"></i></a>
        <a href="/today/" class="ecm-menu-link">오늘의 쿠폰</a>
      </nav>
      <form class="ecm-search" role="search" action="/" method="get">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="search" name="q" placeholder="ECM에서 검색" aria-label="ECM에서 검색" autocomplete="off">
      </form>
      <a href="/" class="ecm-report"><i class="fa-solid fa-ticket"></i> 쿠폰 모음</a>
      <button type="button" id="burgerBtn" class="ecm-burger" aria-label="메뉴 열기" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
    </div>
    <div id="megaMenuWrap" class="ecm-mega-wrap">
      <div class="ecm-drawer">
        <div class="ecm-drawer-head"><span>메뉴</span><button type="button" class="ecm-drawer-close" data-close-menu aria-label="메뉴 닫기"><i class="fa-solid fa-xmark"></i></button></div>
        <div id="megaGridContainer"></div>
        <div class="ecm-drawer-links">
          <a href="/today/"><i class="fa-regular fa-calendar-check"></i> 오늘의 쿠폰</a>
          <a href="/game/"><i class="fa-solid fa-gamepad"></i> 게임 쿠폰</a>
          <a href="/shop/"><i class="fa-solid fa-bag-shopping"></i> 쇼핑 할인</a>
          <a href="/"><i class="fa-solid fa-house"></i> 홈</a>
        </div>
      </div>
    </div>
  </header>`;
}

function footerHtml() {
  return `  <footer class="bg-white border-t border-slate-200 py-8 text-slate-500 text-xs">
    <div class="max-w-7xl mx-auto px-4 space-y-3 text-center sm:text-left">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>&copy; 2026 ecm-coupon.com (ECM 쿠폰). All rights reserved.</p>
        <nav class="flex flex-wrap justify-center gap-4" aria-label="사이트 정보">
          <a href="/about.html" class="ecm-link">ECM 소개</a>
          <a href="/contact.html" class="ecm-link">문의·제보</a>
          <a href="/privacy.html" class="ecm-link">개인정보처리방침</a>
          <a href="/terms.html" class="ecm-link">이용약관</a>
        </nav>
      </div>
      <p class="text-[11px] leading-relaxed">ECM은 각 게임사·쇼핑몰의 공식 파트너가 아니며, 게시된 쿠폰·혜택 정보는 공개된 자료를 확인해 정리한 참고용 정보입니다. 실제 적용 여부는 각 공식 사이트에서 다시 확인해 주세요. 운영자: ${AUTHOR_NAME} · 문의: contact@ecm-coupon.com</p>
    </div>
  </footer>`;
}

/** 게임 성격에 따라 다른 주의사항. 페이지마다 같은 문장이 반복되면 검색엔진이 얇은 페이지로 본다. */
/** 코드가 어디서 나오는지 — 입력 페이지 도메인/퍼블리셔로 판단한다. 확인된 일반적 경로만 적는다. */
function sourceInfo(g) {
  const u = (g.redeemUrl || g.officialUrl || '').toLowerCase();
  const pub = (g.publisher || '').toLowerCase();
  const isRoblox = (g.platforms || []).includes('roblox');
  if (isRoblox) return {
    where: '개발팀이 직접 냅니다. 로블록스 게임 페이지 설명란, 개발팀 공식 X(트위터), 공식 디스코드 공지에 먼저 올라오고, 좋아요·방문자 수 달성이나 업데이트 기념으로 나오는 경우가 많습니다.',
    cadence: 'ECM 은 개발팀 공식 채널과 코드 전문 매체를 하루 두 번 확인합니다.',
    form: '대소문자를 구분하는 영문·숫자 조합이 대부분입니다.',
  };
  if (u.includes('nexon.com')) return {
    where: '넥슨 게임은 공식 홈페이지 공지, 넥슨 공식 카페, 라이브 방송(쇼케이스·업데이트 방송)에서 코드를 냅니다. 방송 중 공개되는 코드는 유효 기간이 짧은 편입니다.',
    cadence: 'ECM 은 넥슨 공식 채널과 인벤 기사를 4시간마다 확인합니다.',
    form: '넥슨 코드는 대문자 영문·숫자 조합이 많고, 입력 페이지(mcoupon)에서 게임을 고른 뒤 넣습니다.',
  };
  if (u.includes('onstove.com')) return {
    where: '스마일게이트 게임은 공식 커뮤니티 공지와 라이브 방송(예: 로아온)에서 코드를 냅니다. 계정 단위로 등록하므로 STOVE 계정 로그인이 먼저입니다.',
    cadence: 'ECM 은 STOVE 공지와 인벤 기사를 4시간마다 확인합니다.',
    form: '영문 대문자와 숫자 조합이 대부분입니다.',
  };
  if (u.includes('netmarble.com')) return {
    where: '넷마블 게임은 공식 카페 공지, 쇼케이스·업데이트 방송, 출시 기념 이벤트에서 코드를 냅니다. 사전등록·출시 초기에 "웰컴 쿠폰"이 나오는 경우가 많습니다.',
    cadence: 'ECM 은 넷마블 공식 카페와 인벤 기사를 4시간마다 확인합니다.',
    form: '영문 대문자·숫자 조합이 많고, 쿠폰 페이지에서 계정당 한 번 등록합니다.',
  };
  if (u.includes('plaync.com')) return {
    where: '엔씨소프트 게임은 공식 홈페이지 공지와 NC 공식 유튜브·방송에서 코드를 냅니다. 업데이트 기념과 콜라보 이벤트 때 나옵니다.',
    cadence: 'ECM 은 공식 홈페이지 공지와 인벤 기사를 4시간마다 확인합니다.',
    form: '영문 대문자·숫자 조합이 대부분이고, NShop 쿠폰 페이지에서 서버를 고른 뒤 넣습니다.',
  };
  if (u.includes('withhive.com') || pub.includes('컴투스')) return {
    where: '컴투스 게임은 공식 카페·커뮤니티 공지와 방송에서 코드를 냅니다. 하이브(Hive) 쿠폰 페이지에서 등록합니다.',
    cadence: 'ECM 은 공식 커뮤니티와 인벤 기사를 4시간마다 확인합니다.',
    form: '영문·숫자 조합이 대부분입니다.',
  };
  if (u.includes('kakaogames.com')) return {
    where: '카카오게임즈 게임은 공식 카페 공지, 업데이트 방송, 콜라보 이벤트에서 코드를 냅니다.',
    cadence: 'ECM 은 공식 카페와 인벤 기사를 4시간마다 확인합니다.',
    form: '영문 대문자·숫자 조합이 대부분입니다.',
  };
  if (u.includes('hoyoverse.com')) return {
    where: '호요버스 게임은 버전 업데이트 전 "스페셜 프로그램" 방송에서 코드 3개를 공개합니다. 방송 코드는 보통 하루 안에 만료되고, 상시 코드는 따로 있습니다.',
    cadence: 'ECM 은 공식 SNS와 공식 커뮤니티(HoYoLAB)를 4시간마다 확인합니다.',
    form: '영문 대문자·숫자 조합이며 웹 교환 페이지나 게임 안에서 넣습니다.',
  };
  if (u.includes('centurygame.com') || u.includes('lastwar')) return {
    where: '이 게임의 코드는 공식 X(트위터)·페이스북·디스코드와 다운로드 달성 같은 기념 이벤트에서 나옵니다. 유튜버·방송 연계 코드도 자주 있습니다.',
    cadence: 'ECM 은 공식 SNS와 해외 코드 전문 매체 2곳 이상을 4시간마다 확인합니다.',
    form: '대소문자를 구분하는 영문·숫자 조합이 많습니다. 플레이어 ID 를 넣는 웹 페이지에서 등록합니다.',
  };
  return {
    where: '게임사 공식 홈페이지 공지, 공식 SNS, 라이브 방송과 콜라보 이벤트에서 코드가 나옵니다.',
    cadence: 'ECM 은 공식 채널과 인벤·게임 매체 기사를 4시간마다 확인합니다.',
    form: '영문·숫자 조합이 대부분이며 대소문자를 구분하는 경우가 있습니다.',
  };
}

/** 장부(data/coupon-seen.json)에서 이 게임에 등록됐던 코드 이력. 지금 표에 없는 것만. */
function historyFor(g, firstSeen, coupons) {
  const now = new Set((coupons || []).map(c => c.code));
  const rows = Object.keys(firstSeen || {})
    .filter(k => k.startsWith(g.id + ':'))
    .map(k => ({ code: k.slice(g.id.length + 1), date: firstSeen[k] }))
    .filter(r => r.code && !now.has(r.code))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.slice(0, 8);
}

function tipsFor(g) {
  const isRoblox = (g.platforms || []).includes('roblox');
  const tips = [];
  if (isRoblox) {
    tips.push('로블록스 코드는 <strong>대소문자를 구분</strong>합니다. 복사 버튼으로 옮기면 틀릴 일이 없습니다.');
    tips.push('코드는 개발팀이 예고 없이 닫습니다. 위 표의 만료일은 공지가 없을 때 <strong>확인일 기준 30일</strong>로 적은 것이라, 그 전에 닫힐 수도 있습니다.');
    tips.push('코드 입력 칸은 게임마다 다른 곳에 있습니다. 위 "입력 방법"의 버튼 위치를 그대로 따라가세요.');
    tips.push('한 코드는 계정당 한 번만 됩니다. "이미 사용됨"이 뜨면 그 계정으로는 받은 겁니다.');
  } else {
    tips.push('코드는 계정당 <strong>한 번</strong>만 쓸 수 있습니다. 같은 코드를 다른 서버·캐릭터에서 다시 넣어도 받지 못합니다.');
    tips.push('보상은 보통 게임 안 <strong>우편함</strong>으로 옵니다. 우편함이 가득 차 있으면 못 받는 경우가 있으니 먼저 비우세요.');
    if ((g.platforms || []).includes('cross')) tips.push('여러 플랫폼으로 나온 게임은 <strong>같은 계정</strong>이면 어디서 넣어도 한 번으로 칩니다.');
    tips.push('만료일이 "상시"인 코드도 게임사가 예고 없이 닫을 수 있습니다. 안 되면 만료된 것입니다.');
  }
  return tips;
}

function faqFor(g) {
  const isRoblox = (g.platforms || []).includes('roblox');
  const name = g.title;
  const faq = [
    { q: `${name} 쿠폰은 어디서 입력하나요?`,
      a: g.redeemHow ? `${g.redeemHow}${g.redeemUrl ? ' 입력 페이지 주소는 위 "입력 방법"에 있습니다.' : ''}` : '입력 위치는 확인 중입니다. 공식 홈페이지나 게임 안 설정 메뉴에서 쿠폰/교환 코드 입력란을 찾아 주세요.' },
    { q: '코드를 넣었는데 "유효하지 않은 코드"라고 나와요.',
      a: isRoblox ? '대소문자·띄어쓰기를 확인하고, 그래도 안 되면 개발팀이 코드를 닫은 것입니다. 이 페이지는 하루 두 번 다시 확인해 닫힌 코드를 내립니다.'
                  : '대소문자·공백을 확인하세요. 코드가 정확한데도 안 되면 만료됐거나 이미 그 계정으로 사용한 코드입니다.' },
    { q: '새 코드는 언제 올라오나요?',
      a: isRoblox ? '개발팀이 업데이트·좋아요 달성·버그 보상으로 수시로 냅니다. ECM은 개발팀 공식 채널과 코드 전문 매체를 하루 두 번 확인해 올립니다.'
                  : '게임사가 업데이트·방송·이벤트 때 냅니다. ECM은 공식 채널을 4시간마다 확인해서 확인된 코드만 올립니다.' },
    { q: `지금 코드가 없으면 ${name} 쿠폰은 어떻게 챙기나요?`,
      a: `${sourceInfo(g).where} 이 페이지를 즐겨찾기해 두면 확인된 코드가 올라올 때 바로 볼 수 있습니다. 다른 사이트에 적힌 코드는 만료된 것이 섞여 있으니 등록일이 있는 곳에서 확인하세요.` },
  ];
  return faq;
}

function pageHtml(g, ctx) {
  const { today, posts, allGames, version, firstSeen } = ctx;
  const coupons = g.coupons || [];
  const evald = coupons.map(c => ({ c, ev: evaluate(c.expireDate, today) }));
  const active = evald.filter(x => x.ev.active);
  const expired = evald.filter(x => !x.ev.active);
  const isRoblox = (g.platforms || []).includes('roblox');
  const ym = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
  const url = `${SITE}/game/${g.id}.html`;
  const redeemUrl = g.redeemUrl || g.officialUrl || '';
  const platforms = (g.platforms || []).map(p => PLATFORM_LABELS[p] || p).join(' · ');
  const related = posts.filter(p => p.title.includes(g.title.split(' (')[0].split(':')[0]));
  const siblings = allGames.filter(x => x.id !== g.id && x.genre === g.genre && qualifies(x, ctx.activeOf)).slice(0, 6);
  const pubKey = (g.publisher || '').split(/[ (·]/)[0];
  const samePub = pubKey ? allGames.filter(x => x.id !== g.id && (x.publisher || '').startsWith(pubKey) && qualifies(x, ctx.activeOf)).slice(0, 6) : [];
  const src = sourceInfo(g);
  const history = historyFor(g, firstSeen, coupons);
  const addedOn = firstSeen && firstSeen['game:' + g.id];

  // 검색 결과 제목은 한국어 40자쯤에서 잘린다. 긴 게임 이름이면 뒤부터 덜어낸다.
  const mon = `${today.getMonth() + 1}월`;
  let titleCands = active.length
    ? [`${g.title} 쿠폰 코드 ${active.length}개 (${mon}) — 입력 방법 | ECM 쿠폰`, `${g.title} 쿠폰 코드 ${active.length}개 (${mon}) | ECM 쿠폰`, `${g.title} 쿠폰 코드 | ECM 쿠폰`]
    : [`${g.title} 쿠폰 코드 입력 방법 (${mon}) | ECM 쿠폰`, `${g.title} 쿠폰 입력 방법 | ECM 쿠폰`, `${g.title} 쿠폰 | ECM 쿠폰`];
  // 게임 이름이 길면 괄호 속 영문 이름을 뺀 짧은 이름으로 한 번 더 시도한다 (예: 이환 (Neverness to Everness) → 이환)
  const shortName = g.title.split(' (')[0];
  if (shortName !== g.title) titleCands.push(...(active.length
    ? [`${shortName} 쿠폰 코드 ${active.length}개 (${mon}) | ECM 쿠폰`, `${shortName} 쿠폰 코드 | ECM 쿠폰`]
    : [`${shortName} 쿠폰 코드 입력 방법 (${mon}) | ECM 쿠폰`, `${shortName} 쿠폰 | ECM 쿠폰`]));
  const title = titleCands.find(t => t.length <= 40) || titleCands[titleCands.length - 1];
  const desc = active.length
    ? `${g.title}에서 지금 쓸 수 있는 쿠폰 코드 ${active.length}개와 보상, 만료일, 입력 방법. 공식 채널 확인 후 갱신.`
    : `${g.title} 쿠폰(교환 코드) 입력 위치와 방법, 코드가 나오는 곳과 지난 코드 이력. 새 코드는 확인 즉시 등록.`;

  const codeRows = active.map(({ c, ev }) => {
    const seen = firstSeen[g.id + ':' + c.code];
    const isNew = seen && (today.getTime() - new Date(seen).getTime()) / 86400000 <= 7 && seen > '2026-09-21';
    return `<tr>
          <td class="c-code"><code class="ecm-code">${esc(c.code)}</code>${isNew ? ' <span class="ecm-pill new">NEW</span>' : ''}</td>
          <td class="c-reward"><span class="c-label">보상</span>${esc(c.reward || '보상 확인')}</td>
          <td class="c-exp ecm-nowrap"><span class="c-label">만료</span>${esc(ev.text)}${c.expireDate && c.expireDate !== '상시' ? `<br><small>${esc(c.expireDate)}</small>` : ''}</td>
          <td class="ecm-nowrap"><button type="button" class="ecm-btn-primary" data-copy="${esc(c.code)}"><i class="fa-regular fa-copy"></i> 복사</button></td>
        </tr>`;
  }).join('\n');

  const expiredRows = expired.map(({ c, ev }) => `<tr><td><code class="ecm-code is-dead">${esc(c.code)}</code></td><td>${esc(c.reward || '')}</td><td>${esc(ev.text)}</td></tr>`).join('\n');

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url,
      dateModified: version, inLanguage: 'ko',
      author: { '@type': 'Person', name: AUTHOR_NAME, url: `${SITE}/about.html` },
      publisher: { '@type': 'Organization', name: 'ECM 쿠폰 (Every Coupon Matters)', url: SITE },
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ECM', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '게임 쿠폰', item: SITE + '/game/' },
        { '@type': 'ListItem', position: 3, name: g.title, item: url },
      ] },
    },
    active.length ? {
      '@context': 'https://schema.org', '@type': 'ItemList', name: `${g.title} 쿠폰 코드`, numberOfItems: active.length,
      itemListElement: active.map(({ c }, i) => ({ '@type': 'ListItem', position: i + 1, name: c.code, description: c.reward || '' })),
    } : null,
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqFor(g).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  ${GA_SNIPPET}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="ECM 쿠폰 (Every Coupon Matters)">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/ecm.css">
  <script src="/assets/ecm.js" defer></script>
  <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></noscript>
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"></noscript>
${ld.map(o => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n')}
  <style>
    .ecm-page { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
    .ecm-page h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -.035em; margin: .2rem 0 .2rem; line-height: 1.3; text-wrap: balance; }
    .ecm-page h2 { font-size: 1.15rem; font-weight: 700; letter-spacing: -.02em; margin: 2.2rem 0 .7rem; }
    .ecm-page p, .ecm-page li { font-size: .95rem; line-height: 1.8; color: var(--ink-2); }
    .ecm-page ul, .ecm-page ol { padding-left: 1.3rem; margin: 0 0 1rem; }
    .ecm-page a { color: var(--brown); font-weight: 700; }
    .ecm-crumb { font-size: .8rem; color: var(--ink-3); margin-bottom: .9rem; }
    .ecm-page .ecm-crumb a { color: var(--ink-3); font-weight: 500; text-decoration: none; }
    .ecm-page .ecm-crumb a:hover { color: var(--ink); text-decoration: underline; }
    .ecm-game-head { display: flex; align-items: center; gap: .9rem; }
    .ecm-game-head .ecm-icon { width: 56px; height: 56px; font-size: 1.45rem; border-radius: 15px; }
    .ecm-lede { font-size: .95rem; margin: 0 0 1rem; }
    .ecm-game-meta { font-size: .8rem; color: var(--ink-3); display: flex; flex-wrap: wrap; gap: .3rem .6rem; margin: .1rem 0 0; }
    .ecm-verify { display: flex; align-items: flex-start; gap: .55rem; background: var(--new-soft); color: #0B5E31; border-radius: 12px; padding: .8rem 1rem; font-size: .88rem; line-height: 1.55; margin: 1.1rem 0 1.2rem; }
    .ecm-verify i { margin-top: .2rem; }
    .ecm-page table { width: 100%; border-collapse: collapse; font-size: .9rem; margin: .5rem 0 1rem; background: #fff; }
    .ecm-page th, .ecm-page td { border-bottom: 1px solid var(--line); padding: .7rem .7rem; text-align: left; vertical-align: middle; line-height: 1.6; }
    .ecm-page th { background: var(--sf); font-weight: 700; font-size: .8rem; color: var(--ink-2); white-space: nowrap; border-bottom: 0; }
    .ecm-page th:first-child { border-radius: 8px 0 0 8px; }
    .ecm-page th:last-child { border-radius: 0 8px 8px 0; }
    .ecm-code { font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 700; letter-spacing: .02em; background: var(--sf); padding: .2rem .5rem; border-radius: 6px; word-break: break-all; color: var(--ink); }
    .ecm-code.is-dead { text-decoration: line-through; color: var(--ink-3); font-weight: 500; }
    .c-label { display: none; }
    /* 지금 쓸 수 있는 코드: 휴대폰에서는 표 대신 코드 카드 */
    @media (max-width: 640px) {
      table.ecm-codes, table.ecm-codes tbody { display: block; }
      table.ecm-codes thead { display: none; }
      table.ecm-codes tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem .75rem; align-items: center; border: 1.5px solid var(--ink); border-radius: 14px; padding: .95rem 1rem; margin-bottom: .65rem; }
      table.ecm-codes td { border: 0; padding: 0; font-size: .85rem; color: var(--ink-2); }
      table.ecm-codes td.c-code { grid-column: 1; }
      table.ecm-codes td.c-code .ecm-code { background: none; padding: 0; font-size: 1.1rem; }
      table.ecm-codes td:last-child { grid-column: 2; grid-row: 1; }
      table.ecm-codes td.c-reward, table.ecm-codes td.c-exp { grid-column: 1 / -1; white-space: normal; }
      table.ecm-codes .c-label { display: inline; color: var(--ink-3); font-size: .78rem; margin-right: .45rem; }
      table.ecm-codes td.c-exp br { display: none; }
      table.ecm-codes td.c-exp small { margin-left: .35rem; color: var(--ink-3); }
      .ecm-page .ecm-codes .ecm-btn-primary { font-size: .85rem; padding: .5rem .9rem; }
    }
    .ecm-redeem-box { background: var(--sf); border-radius: 14px; padding: 1rem 1.15rem; margin: .5rem 0 1rem; }
    .ecm-redeem-box p { margin: 0 0 .7rem; }
    .ecm-redeem-box p:last-child { margin: 0; }
    .ecm-redeem-box i { color: var(--ink-3); margin-right: .15rem; }
    .ecm-page a.ecm-open { display: inline-flex; align-items: center; gap: .4rem; background: var(--ink); color: #fff; padding: .6rem 1rem; border-radius: 10px; font-size: .9rem; text-decoration: none; }
    .ecm-page a.ecm-open:hover { background: #2E2C24; }
    .ecm-empty { background: #fff; border: 1px dashed var(--line); border-radius: 14px; padding: 1rem 1.2rem; color: var(--ink-3); }
    .ecm-page .ecm-btn-primary { font-size: .78rem; padding: .4rem .75rem; }
    .ecm-nowrap { white-space: nowrap; }
    .ecm-sib { display: flex; flex-wrap: wrap; gap: .4rem; }
    .ecm-page .ecm-sib a { display: inline-flex; align-items: center; gap: .35rem; padding: .45rem .8rem; border: 0; border-radius: 999px; background: var(--sf); color: var(--ink); font-size: .85rem; font-weight: 600; text-decoration: none; }
    .ecm-page .ecm-sib a:hover { background: var(--line); }
    /* 글 속 쿠폰 링크 밑줄(ecm.css)은 본문 문장용이라 경로·게임 칩·돌아가기 링크에서는 끈다 */
    .ecm-page .ecm-crumb a, .ecm-page .ecm-sib a, .ecm-page .ecm-back a { text-decoration: none !important; font-weight: 600; }
    .ecm-page .ecm-crumb a::after, .ecm-page .ecm-sib a::after, .ecm-page .ecm-back a::after { content: none !important; }
    .ecm-page .ecm-back a { color: var(--ink-2) !important; }
    details.ecm-faq { background: #fff; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; padding: .9rem .1rem; margin: 0; }
    details.ecm-faq summary { cursor: pointer; font-weight: 600; font-size: .95rem; }
    details.ecm-faq p { margin: .6rem 0 0; }
    @media (max-width: 640px) { .ecm-page table { font-size: .82rem; } .ecm-page th, .ecm-page td { padding: .55rem .5rem; } }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
${headerHtml()}

  <main class="ecm-page flex-1 w-full">
    <article>
    <nav class="ecm-crumb" aria-label="현재 위치"><a href="/">ECM</a> › <a href="/game/">게임 쿠폰</a> › ${esc(g.title)}</nav>
    <div class="ecm-game-head">
      ${monoBox('ecm-icon', g.title, 'div')}
      <div>
        <h1>${esc(g.title)} 쿠폰 코드${active.length ? ` ${active.length}개` : ''} <small style="font-weight:600;color:var(--ink-3);font-size:.9rem">(${ym})</small></h1>
        <div class="ecm-game-meta">
          <span>${esc(g.publisher || '')}</span><span>·</span><span>${esc(g.category || GENRE_LABELS[g.genre] || '')}</span><span>·</span><span>${esc(platforms)}</span>
        </div>
      </div>
    </div>
    <p class="ecm-verify"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span><b>${esc(fmt(version))} 확인</b> · ${isRoblox ? '개발팀 공식 채널과 코드 전문 매체에서' : '게임사 공식 채널에서'} 확인한 ${active.length ? '코드만 올려요.' : '정보예요. 지금 살아 있는 코드는 없어요.'}</span></p>
    <p class="ecm-share-row"><button type="button" class="ecm-share" data-share-title="${esc(g.title)} 쿠폰 코드 | ECM" data-share-text="${esc(active.length ? `${g.title} 쿠폰 코드 ${active.length}개, ECM에서 확인했어요` : `${g.title} 쿠폰 입력 방법과 새 코드 소식`)}"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> 친구에게 공유</button> <a class="ecm-share ecm-tg" href="https://t.me/ecmcoupon" target="_blank" rel="noopener noreferrer" data-tg="game"><i class="fa-brands fa-telegram" aria-hidden="true"></i> 새 쿠폰 알림 받기</a> <button type="button" class="ecm-share ecm-fav" data-fav="${esc(g.id)}" aria-pressed="false"><i class="fa-regular fa-star" aria-hidden="true"></i> <span>내 게임에 담기</span></button> <a class="ecm-fav-link" href="/today/#mine">오늘의 쿠폰에서 모아 보기 →</a></p>
    <p class="ecm-lede">${active.length
      ? `ECM 쿠폰(Every Coupon Matters)이 ${esc(fmt(version))} 기준으로 확인한 ${esc(g.title)} 쿠폰 코드 ${active.length}개와 보상, 만료일, 입력 방법입니다.`
      : `ECM 쿠폰(Every Coupon Matters)이 정리한 ${esc(g.title)} 쿠폰 입력 방법과 코드가 나오는 곳, 지난 코드 이력입니다. ${esc(fmt(version))} 기준으로 살아 있는 코드는 없습니다.`} 코드는 ${isRoblox ? '개발팀 공식 채널이나 코드 전문 매체 2곳' : '게임사 공식 채널이나 독립된 출처 2곳'}에서 확인한 것만 올립니다.</p>

    <h2 id="codes">지금 쓸 수 있는 코드${active.length ? ` (${active.length})` : ''}</h2>
${active.length ? `    <table class="ecm-codes">
      <thead><tr><th>코드</th><th>보상</th><th>만료</th><th></th></tr></thead>
      <tbody>
${codeRows}
      </tbody>
    </table>
    <p style="font-size:.82rem;color:var(--ink-3)">코드는 ${isRoblox ? '개발팀 공식 채널과 코드 전문 매체 2곳' : '게임사 공식 채널'}에서 확인한 것만 올립니다. 등록일이 7일 안이면 NEW 표시가 붙습니다.</p>`
: `    <div class="ecm-empty">
      <p><strong>${esc(fmt(version))} 기준으로 살아 있는 코드가 없습니다.</strong> 등록 기준을 통과한 코드(${isRoblox ? '개발팀 공식 채널이나 코드 매체 2곳 이상' : '게임사 공식 채널이나 인벤 기사와 독립된 출처'}에서 확인)만 올리기 때문에, 다른 곳에 떠도는 코드가 여기 없으면 대개 만료됐거나 확인이 안 된 것입니다.</p>
      <p>${esc(src.cadence)} 새 코드가 확인되면 이 표에 등록일과 함께 올라옵니다.${history.length ? ' 이 게임은 아래 "코드 이력"에 지금까지 나왔던 코드가 있습니다.' : ''}</p>
    </div>`}

    <h2 id="source">코드가 나오는 곳</h2>
    <p>${esc(src.where)}</p>
    <p>${esc(src.form)}${g.officialUrl ? ` 공식 사이트: <a href="${esc(g.officialUrl)}" target="_blank" rel="noopener noreferrer">${esc(g.officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))} ↗</a>` : ''}</p>

${noteHtml(g)}    <h2 id="how">입력 방법</h2>
    <div class="ecm-redeem-box">
      <p><strong><i class="fa-solid fa-location-dot" aria-hidden="true"></i> 어디서:</strong> ${g.redeemHow ? esc(g.redeemHow) : '확인 중 — 공식 사이트나 게임 안 설정 메뉴에서 쿠폰/교환 코드 입력란을 찾아 주세요.'}</p>
      ${redeemUrl ? `<p><a class="ecm-open" href="${esc(redeemUrl)}" target="_blank" rel="noopener noreferrer">${g.redeemUrl ? '쿠폰 입력 페이지 열기' : '공식 사이트 열기'} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></p>` : ''}
    </div>
    <ol>
      <li>${active.length ? '위 표에서 <strong>복사</strong>를 누릅니다. 코드가 그대로 복사됩니다.' : '코드가 올라오면 위 표의 <strong>복사</strong>를 누릅니다. 코드가 그대로 복사됩니다.'}</li>
      <li>${g.redeemHow ? esc(g.redeemHow.split(' → ')[0].split(' > ')[0]) : '쿠폰 입력 화면'}으로 갑니다.</li>
      <li>붙여 넣고 확인을 누릅니다. 보상은 ${isRoblox ? '바로 지급되거나 게임 안 알림으로' : '보통 게임 안 우편함으로'} 옵니다.</li>
    </ol>

    <h2 id="tips">주의할 점</h2>
    <ul>
${tipsFor(g).map(t => `      <li>${t}</li>`).join('\n')}
    </ul>

${expired.length ? `    <h2 id="expired">최근 만료된 코드</h2>
    <p>다시 넣어도 되지 않습니다. 다른 곳에서 "아직 된다"고 적혀 있어도 이 목록에 있으면 끝난 코드입니다.</p>
    <table>
      <thead><tr><th>코드</th><th>보상이었던 것</th><th>만료</th></tr></thead>
      <tbody>
${expiredRows}
      </tbody>
    </table>
` : ''}
${history.length ? `    <h2 id="history">코드 이력</h2>
    <p>ECM 이 이 게임에서 확인해 등록했던 코드입니다. 지금은 쓸 수 없지만, 이 게임이 어떤 형식의 코드를 얼마나 자주 내는지 볼 수 있습니다.${addedOn ? ` (ECM 등록일 ${esc(fmt(addedOn))})` : ''}</p>
    <table>
      <thead><tr><th>코드</th><th>등록일</th><th>상태</th></tr></thead>
      <tbody>
${history.map(r => `        <tr><td><code class="ecm-code is-dead">${esc(r.code)}</code></td><td class="ecm-nowrap">${esc(fmt(r.date))}</td><td>만료</td></tr>`).join('\n')}
      </tbody>
    </table>
` : (addedOn && !active.length ? `    <h2 id="history">코드 이력</h2>
    <p>ECM 에 ${esc(fmt(addedOn))} 등록된 뒤 아직 확인된 코드가 없는 게임입니다. 첫 코드가 확인되면 위 표와 여기에 등록일과 함께 남습니다.</p>
` : '')}
${related.length ? `    <h2 id="related">${esc(g.title)} 관련 글</h2>
    <ul>
${related.map(p => `      <li><a href="${esc(p.url)}">${esc(p.title)}</a> <small>${esc(fmt(p.date))}</small></li>`).join('\n')}
    </ul>
` : ''}
    <h2 id="faq">자주 묻는 질문</h2>
${faqFor(g).map(f => `    <details class="ecm-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}

${siblings.length ? `    <h2 id="more">같은 장르의 다른 게임 쿠폰</h2>
    <div class="ecm-sib">
${siblings.map(x => `      <a href="/game/${esc(x.id)}.html">${esc(x.title)}${ctx.activeOf(x).length ? ` <span class="ecm-count">${ctx.activeOf(x).length}</span>` : ''}</a>`).join('\n')}
    </div>
` : ''}
${samePub.length ? `    <h2 id="samepub">${esc(pubKey)}의 다른 게임 쿠폰</h2>
    <div class="ecm-sib">
${samePub.map(x => `      <a href="/game/${esc(x.id)}.html">${esc(x.title)}${ctx.activeOf(x).length ? ` <span class="ecm-count">${ctx.activeOf(x).length}</span>` : ''}</a>`).join('\n')}
    </div>
` : ''}
    <p class="ecm-back" style="margin-top:2rem;font-size:.85rem"><a href="/game/">← 게임 쿠폰 홈</a></p>
    </article>
  </main>

${footerHtml()}
  <div id="copyToast" class="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-50 hidden px-4 py-2 rounded-full ecm-toast text-xs font-bold shadow-2xl">복사했습니다</div>
  <script>
    // 복사 버튼: 코드를 그대로 클립보드로
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-copy]');
      if (!b) return;
      navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
        var t = document.getElementById('copyToast');
        t.classList.remove('hidden');
        setTimeout(function () { t.classList.add('hidden'); }, 1500);
      });
    });
  </script>
</body>
</html>
`;
}

/**
 * 게임 페이지를 만들고, 자격을 잃은 게임의 페이지는 지운다.
 * @returns {{written: number, removed: number, ids: string[]}}
 */
function writeGamePages(rootDir, games, posts, version, firstSeen) {
  const dir = path.join(rootDir, 'game');
  fs.mkdirSync(dir, { recursive: true });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeOf = g => (g.coupons || []).filter(c => evaluate(c.expireDate, today).active);
  const ctx = { today, posts, allGames: games, version, firstSeen, activeOf };
  const keep = new Set();
  let written = 0;
  for (const g of games) {
    if (!qualifies(g, activeOf)) continue;
    const file = path.join(dir, `${g.id}.html`);
    const html = pageHtml(g, ctx);
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (prev !== html) { fs.writeFileSync(file, html); written++; }
    keep.add(`${g.id}.html`);
  }
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html') && f !== 'index.html' && !keep.has(f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
  }
  return { written, removed, ids: [...keep].map(f => f.replace(/\.html$/, '')) };
}

module.exports = { writeGamePages, qualifies, headerHtml, footerHtml, evaluate, GENRE_LABELS };
