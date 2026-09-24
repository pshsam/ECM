/**
 * 쇼핑 할인 홈 (/shop/index.html)과 쇼핑몰별 혜택 페이지 (/shop/<id>.html).
 *
 * - 쇼핑몰 목록·한 줄 혜택·확인일은 index.html 의 raw*Catalog 배열 (id, name, sub, icon, url, tip, benefit, checked).
 * - 쇼핑몰 페이지의 자세한 내용은 data/shops.json 의 shops[<id>]. "ECM 쇼핑 혜택 검증" 루틴이 공식 안내를 확인해 채운다.
 *   확인된 혜택이 두 개 이상이고 출처가 있는 쇼핑몰만 페이지를 만든다. 얇은 페이지를 만들지 않으려고.
 * prerender.js 가 부른다. 손으로 고치지 않는다.
 */
const fs = require('fs');
const path = require('path');
const { SITE, esc, fmt, fitTitle, fitDesc, pageShell, breadcrumbLd, writeIfChanged } = require('./page-shell');

function loadShopDetails(rootDir) {
  const file = path.join(rootDir, 'data', 'shops.json');
  try { return (JSON.parse(fs.readFileSync(file, 'utf8')).shops) || {}; } catch (_) { return {}; }
}

/** 쇼핑몰 페이지를 만들 자격: 확인일, 확인된 혜택 2개 이상, 출처 1개 이상 */
function shopQualifies(d) {
  return !!(d && d.checked && Array.isArray(d.benefits) && d.benefits.length >= 2 && Array.isArray(d.sources) && d.sources.length >= 1);
}

const shortName = n => String(n).split(' (')[0];
const monthOf = d => `${new Date(d).getMonth() + 1}월`;

function allShops(shopCats, shopCatalogs) {
  const out = [];
  for (const cat of shopCats) for (const m of (shopCatalogs[cat] || [])) out.push({ ...m, cat });
  return out;
}

function writeShopHub(rootDir, { shopCats, shopCatalogs, subLabels, catLabels, catIcons, details, pageIds, posts, headerHtml, footerHtml }) {
  const today = new Date();
  const ym = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
  const shops = allShops(shopCats, shopCatalogs);
  const checkedN = shops.filter(m => m.checked).length;
  const pages = new Set(pageIds);

  const card = m => {
    const page = pages.has(m.id);
    return `        <div class="hub-shop" id="shop-${esc(m.id)}">
          <div class="top"><span class="hub-ico">${m.icon || '🛍️'}</span><span style="min-width:0;display:flex;flex-direction:column"><strong class="name">${esc(m.name)}</strong><span class="benefit">${esc(m.benefit || '')}</span></span></div>
          <p class="tip">${esc(m.tip || '')}</p>
          <div class="foot">${m.checked ? `<span class="hub-checked">✓ 확인 ${esc(fmt(m.checked).slice(5))}</span>` : '<span class="hub-checked no">확인 전</span>'}<span>${page ? `<a href="/shop/${esc(m.id)}.html">혜택 자세히 →</a> · ` : ''}<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">공식 사이트 ↗</a></span></div>
        </div>`;
  };

  const secs = shopCats.map(cat => {
    const list = shopCatalogs[cat] || [];
    const subs = subLabels[cat] || {};
    const groups = Object.keys(subs).map(sub => ({ sub, items: list.filter(m => m.sub === sub) })).filter(g => g.items.length);
    return `
    <section class="hub-sec" id="${cat}" aria-labelledby="s-${cat}">
      <h2 id="s-${cat}">${catIcons[cat] || ''} ${esc(catLabels[cat] || cat)} <small>${list.length}곳</small></h2>
${groups.map(g => `      <h3>${esc(subs[g.sub])}</h3>
      <div class="hub-shops">
${g.items.map(m => card({ ...m, cat })).join('\n')}
      </div>`).join('\n')}
    </section>`;
  }).join('');

  const featured = shops.filter(m => pages.has(m.id));
  const lifePosts = posts.filter(p => p.cat === 'life' || p.cat === 'platform').slice(0, 6);
  const chips = shopCats.map(cat => `<a class="hub-chip" href="#${cat}">${catIcons[cat] || ''} ${esc(catLabels[cat] || cat)}</a>`).join('');

  const body = `    <nav class="hub-crumb" aria-label="현재 위치"><a href="/">ECM 쿠폰</a> › 쇼핑 할인</nav>
    <div class="hub-head">
      <h1>쇼핑 할인·쿠폰 모음 <small>(${ym})</small></h1>
      <p class="hub-lede">패션·장보기·OTT·뷰티·배달·여행 쇼핑몰 ${shops.length}곳의 정기 쿠폰과 가입 혜택을 모았어요. ECM 쿠폰이 쇼핑몰 공식 안내를 다시 확인한 곳에는 확인한 날짜를 붙였습니다.</p>
    </div>
    <div class="hub-stats"><span class="hub-stat">쇼핑몰 <b>${shops.length}</b>곳</span><span class="hub-stat">혜택 확인 <b>${checkedN}</b>곳</span><span class="hub-stat">혜택 자세히 <b>${featured.length}</b>곳</span></div>
    <nav class="hub-chips" aria-label="쇼핑 분류 바로가기">${chips}</nav>
${featured.length ? `
    <section class="hub-sec" id="featured" aria-labelledby="featuredTitle">
      <h2 id="featuredTitle">📋 혜택 자세히 보기 <small>받는 법·세일 일정·주의할 점까지 정리한 곳</small></h2>
      <ul class="hub-list">
${featured.map(m => `        <li><a href="/shop/${esc(m.id)}.html">${m.icon || ''} ${esc(shortName(m.name))} 쿠폰·할인 혜택</a></li>`).join('\n')}
      </ul>
    </section>` : ''}
${secs}
${lifePosts.length ? `
    <section class="hub-sec" id="guides" aria-labelledby="shopGuides">
      <h2 id="shopGuides">📖 알뜰 쇼핑 가이드</h2>
      <ul class="hub-list">
${lifePosts.map(p => `        <li><a href="${esc(p.url)}">${esc(p.title)}</a></li>`).join('\n')}
      </ul>
    </section>` : ''}
    <p class="hub-note">ECM 쿠폰은 각 쇼핑몰의 공식 파트너가 아니며, 이 페이지에는 제휴·광고 링크가 없어요. 혜택은 쇼핑몰 사정에 따라 바뀔 수 있으니 결제 전에 공식 사이트에서 한 번 더 확인해 주세요. "확인 전"은 ECM 쿠폰이 아직 다시 확인하지 않은 정보라는 뜻입니다.</p>`;

  const mon = `${today.getMonth() + 1}월`;
  const title = fitTitle([`쇼핑 할인·쿠폰 모음 (${mon}) | ECM 쿠폰`, '쇼핑 할인·쿠폰 모음 | ECM 쿠폰']);
  const desc = fitDesc([`패션·장보기·OTT·뷰티·배달·여행 쇼핑몰 ${shops.length}곳의 정기 쿠폰과 가입 혜택을 확인한 날짜와 함께 모았습니다.`, `쇼핑몰 ${shops.length}곳의 정기 쿠폰과 가입 혜택을 확인한 날짜와 함께 모았습니다.`]);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '쇼핑 할인·쿠폰 모음', description: desc, url: SITE + '/shop/', inLanguage: 'ko',
      isPartOf: { '@type': 'WebSite', name: 'ECM 쿠폰', url: SITE + '/' } },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '쇼핑 할인', path: '/shop/' }]),
  ];
  const html = pageShell({ title, desc, path: '/shop/', ld, body, headerHtml, footerHtml });
  const dir = path.join(rootDir, 'shop');
  fs.mkdirSync(dir, { recursive: true });
  return writeIfChanged(fs, path.join(dir, 'index.html'), html);
}

function shopPageHtml(m, d, { catLabels, shopsInCat, pages, posts, headerHtml, footerHtml }) {
  const name = shortName(m.name);
  const url = `/shop/${m.id}.html`;
  const mon = monthOf(d.checked);
  const ym = `${new Date(d.checked).getFullYear()}년 ${mon}`;
  const benefitsRows = d.benefits.map(b => `        <tr><td><strong>${esc(b.title)}</strong></td><td>${esc(b.who || '누구나')}</td><td>${esc(b.how || '')}</td><td class="ecm-nowrap">${esc(b.period || '')}</td></tr>`).join('\n');
  const faq = [
    { q: `${name} 쿠폰은 어디서 받나요?`, a: (d.howto && d.howto.length) ? d.howto.join(' ') : `${name} 앱이나 사이트의 쿠폰함·이벤트 페이지에서 받을 수 있습니다. 자세한 위치는 공식 안내를 확인하세요.` },
    { q: '이 페이지의 혜택은 언제 확인한 건가요?', a: `${fmt(d.checked)}에 ${name} 공식 안내를 기준으로 확인했습니다. 혜택은 예고 없이 바뀔 수 있어 결제 전에 공식 사이트에서 다시 확인하는 것이 안전합니다.` },
    { q: `ECM 쿠폰은 ${name}의 제휴처인가요?`, a: `아닙니다. ECM 쿠폰은 ${name}과 제휴 관계가 없고, 이 페이지에는 광고·제휴 링크가 없습니다. 공개된 공식 안내를 확인해 정리한 정보입니다.` },
  ];
  const siblings = shopsInCat.filter(x => x.id !== m.id).slice(0, 8);
  const related = posts.filter(p => p.title.includes(name)).slice(0, 4);
  const body = `    <nav class="hub-crumb" aria-label="현재 위치"><a href="/">ECM 쿠폰</a> › <a href="/shop/">쇼핑 할인</a> › <a href="/shop/#${esc(m.cat)}">${esc(catLabels[m.cat] || '')}</a> › ${esc(name)}</nav>
    <div class="hub-head">
      <h1><span class="hub-ico" style="display:inline-grid;vertical-align:middle;margin-right:.4rem;border-radius:999px">${m.icon || '🛍️'}</span>${esc(name)} 쿠폰·할인 혜택 <small>(${ym})</small></h1>
      <p class="hub-lede">ECM 쿠폰(Every Coupon Matters)이 ${esc(fmt(d.checked))}에 ${esc(name)} 공식 안내를 확인해 정리한 쿠폰·할인 혜택이에요. ${esc(d.summary || '')}</p>
    </div>
    <div class="hub-stats"><span class="hub-stat">${esc(catLabels[m.cat] || '')}</span><span class="hub-stat">확인 <b>${esc(fmt(d.checked))}</b></span><span class="hub-stat"><a class="hub-link" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">공식 사이트 ↗</a></span></div>

    <section class="hub-sec hub-prose" id="benefits">
      <h2>지금 받을 수 있는 혜택</h2>
      <div style="overflow-x:auto"><table class="hub-table">
        <thead><tr><th>혜택</th><th>대상</th><th>받는 법</th><th>기간</th></tr></thead>
        <tbody>
${benefitsRows}
        </tbody>
      </table></div>
    </section>
${d.membership ? `
    <section class="hub-sec hub-prose" id="membership">
      <h2>등급·멤버십 혜택</h2>
      <p>${esc(d.membership)}</p>
    </section>` : ''}
${d.sales && d.sales.length ? `
    <section class="hub-sec hub-prose" id="sales">
      <h2>세일 일정</h2>
      <ul>
${d.sales.map(s => `        <li><strong>${esc(s.name)}</strong> — ${esc(s.when)}</li>`).join('\n')}
      </ul>
    </section>` : ''}
${d.howto && d.howto.length ? `
    <section class="hub-sec hub-prose" id="howto">
      <h2>쿠폰 받는 순서</h2>
      <ol>
${d.howto.map(h => `        <li>${esc(h)}</li>`).join('\n')}
      </ol>
    </section>` : ''}
${d.cautions && d.cautions.length ? `
    <section class="hub-sec hub-prose" id="cautions">
      <h2>주의할 점</h2>
      <ul>
${d.cautions.map(c => `        <li>${esc(c)}</li>`).join('\n')}
      </ul>
    </section>` : ''}
    <section class="hub-sec hub-prose" id="sources">
      <h2>확인한 출처</h2>
      <ul>
${d.sources.map(s => `        <li><a class="hub-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>${s.checked ? ` <small>(${esc(fmt(s.checked))} 확인)</small>` : ''}</li>`).join('\n')}
      </ul>
    </section>
${related.length ? `
    <section class="hub-sec" id="related">
      <h2>${esc(name)} 관련 글</h2>
      <ul class="hub-list">
${related.map(p => `        <li><a href="${esc(p.url)}">${esc(p.title)}</a></li>`).join('\n')}
      </ul>
    </section>` : ''}
    <section class="hub-sec" id="faq">
      <h2>자주 묻는 질문</h2>
${faq.map(f => `      <details class="hub-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}
    </section>
${siblings.length ? `
    <section class="hub-sec" id="more">
      <h2>같은 분류의 다른 쇼핑몰</h2>
      <ul class="hub-list">
${siblings.map(x => `        <li><a href="${pages.has(x.id) ? `/shop/${esc(x.id)}.html` : `/shop/#shop-${esc(x.id)}`}">${x.icon || ''} ${esc(shortName(x.name))}</a></li>`).join('\n')}
      </ul>
    </section>` : ''}
    <p class="hub-note">ECM 쿠폰은 ${esc(name)}과 제휴 관계가 없고, 이 페이지에는 제휴·광고 링크가 없어요. 혜택은 쇼핑몰 사정에 따라 바뀔 수 있으니 결제 전에 공식 사이트에서 한 번 더 확인해 주세요.</p>`;

  const title = fitTitle([`${name} 쿠폰·할인 혜택 총정리 (${mon}) | ECM 쿠폰`, `${name} 쿠폰·할인 혜택 (${mon}) | ECM 쿠폰`, `${name} 쿠폰 혜택 | ECM 쿠폰`]);
  const desc = fitDesc([`${name}에서 지금 받을 수 있는 쿠폰과 할인 혜택, 받는 법, 세일 일정. ${fmt(d.checked)} 공식 안내 기준.`, `${name} 쿠폰·할인 혜택과 받는 법. ${fmt(d.checked)} 공식 안내 기준.`]);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: SITE + url, inLanguage: 'ko', dateModified: d.checked,
      author: { '@type': 'Person', name: '겜대', url: SITE + '/about.html' }, publisher: { '@type': 'Organization', name: 'ECM 쿠폰 (Every Coupon Matters)', url: SITE } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    breadcrumbLd([{ name: 'ECM 쿠폰', path: '/' }, { name: '쇼핑 할인', path: '/shop/' }, { name: `${name} 쿠폰·할인`, path: url }]),
  ];
  return pageShell({ title, desc, path: url, ld, body, ogType: 'article', headerHtml, footerHtml });
}

/** 자격이 있는 쇼핑몰 페이지를 쓰고, 자격을 잃은 페이지는 지운다(index.html 은 남긴다). */
function writeShopPages(rootDir, { shopCats, shopCatalogs, catLabels, details, posts, headerHtml, footerHtml }) {
  const dir = path.join(rootDir, 'shop');
  fs.mkdirSync(dir, { recursive: true });
  const shops = allShops(shopCats, shopCatalogs);
  const ids = shops.filter(m => shopQualifies(details[m.id])).map(m => m.id);
  const pages = new Set(ids);
  let written = 0;
  for (const m of shops) {
    if (!pages.has(m.id)) continue;
    const html = shopPageHtml(m, details[m.id], { catLabels, shopsInCat: shops.filter(x => x.cat === m.cat), pages, posts, headerHtml, footerHtml });
    if (writeIfChanged(fs, path.join(dir, `${m.id}.html`), html)) written++;
  }
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html') && f !== 'index.html' && !pages.has(f.replace(/\.html$/, ''))) { fs.unlinkSync(path.join(dir, f)); removed++; }
  }
  return { ids, written, removed };
}

module.exports = { loadShopDetails, shopQualifies, writeShopHub, writeShopPages };
