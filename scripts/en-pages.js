/**
 * ECM English (/en/) page generator.
 *
 * Reads the US code catalog (snapshot of ecm-blog-posting automation/us/catalog.json) and writes:
 *   en/index.html            game list with search
 *   en/game/<slug>.html      one page per launch game
 *   en/about.html, en/privacy.html
 * Shared assets live in en/assets/ (en.css, en.js) and are written by hand, not by this script.
 *
 * Launch games = no `launch_exclude` and at least one active code.
 * Codes shown = status "active". "unconfirmed" and "case_replaced" are never shown.
 *
 * Usage: node scripts/en-pages.js [--catalog data/en-catalog.json]
 */
const fs = require('fs');
const path = require('path');
const { monoOf } = require('./mono');
const { GA_SNIPPET } = require('./analytics');

const SITE = 'https://ecm-coupon.com';
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'en');
const NEW_DAYS = 14;
const EXPIRED_DAYS = 90;
const CONTACT = 'contact@ecm-coupon.com';

const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return { y, m, d }; };
const longDate = s => { const { y, m, d } = ymd(s); return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`; };
const shortDate = s => { const { m, d } = ymd(s); return `${MONTHS[m - 1].slice(0, 3)} ${d}`; };
const monthYear = s => { const { y, m } = ymd(s); return `${MONTHS[m - 1]} ${y}`; };
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const domain = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

/* Korean page for the same game, when one exists (for hreflang and the language link). */
const KR_ID = { 'genshin-impact': 'genshin', 'honkai-star-rail': 'starrail', 'borderlands-shift': 'borderlands', 'zenless-zone-zero': 'zzz' };
function krPage(slug) {
  const id = KR_ID[slug] || slug;
  return fs.existsSync(path.join(ROOT, 'game', id + '.html')) ? `${SITE}/game/${id}.html` : null;
}

/* Reader-facing redeem text: drop research notes such as "(and, per beebom, ...)". */
function redeemSteps(text) {
  const clean = String(text || '')
    .replace(/\s*\([^)]*\b(?:per|according to)\s+[a-z0-9.-]+[^)]*\)/gi, '')
    .replace(/\s+--\s+(\w)/g, (m, c) => '. ' + c.toUpperCase())
    .replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  return clean.split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean)
    .map(s => /[.!?]$/.test(s) ? s : s + '.');
}

function officialLabel(g) {
  if (g.platform === 'roblox') return 'Open on Roblox';
  return /gift|redeem|redemption|rewards/i.test(g.code_source || '') ? 'Official redeem page' : 'Official site';
}

const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICON_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
const ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>';
const ICON_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
const LOGO = '<svg viewBox="0 0 360 100" aria-hidden="true"><g transform="translate(0 4) scale(0.96)"><path fill-rule="evenodd" class="ink" d="M16 0H80A16 16 0 0 1 96 16V40A8 8 0 0 0 96 56V80A16 16 0 0 1 80 96H16A16 16 0 0 1 0 80V56A8 8 0 0 0 0 40V16A16 16 0 0 1 16 0Z"/><circle cx="48" cy="60" r="26" fill="#FFE14D"/><path d="M15 50 C15 12, 81 12, 81 50 Z" fill="#5E7A38"/><rect x="11" y="47.5" width="74" height="7" rx="3.5" fill="#5E7A38"/><circle cx="39" cy="64" r="3.2" fill="#17160F"/><circle cx="57" cy="64" r="3.2" fill="#17160F"/><path d="M42 70 h12 l-6 9 z" fill="#F28C00"/></g><g transform="translate(120 0)"><g class="ink"><rect x="0" y="10" width="18" height="80" rx="3"/><rect x="24" y="10" width="30" height="16" rx="3"/><rect x="24" y="42" width="24" height="16" rx="3"/><rect x="24" y="74" width="30" height="16" rx="3"/><g transform="translate(64 0)"><path d="M70.64 75.71A40 40 0 0 1 0.19 53.86L18.1 52.13A22 22 0 0 0 56.85 64.14Z"/><path d="M0.19 46.14A40 40 0 0 1 70.64 24.29L56.85 35.86A22 22 0 0 0 18.1 47.87Z"/></g><g transform="translate(146 0)"><rect x="0" y="10" width="18" height="80" rx="3"/><rect x="76" y="10" width="18" height="80" rx="3"/><path d="M24 10H41.1L47 52L52.9 10H70V20.8L56 70H38L24 20.8Z"/></g></g></g></svg>';

function shell({ title, desc, canonical, ko, nav, body, ld, bodyAttr = '' }) {
  const alt = ko ? `\n  <link rel="alternate" hreflang="en" href="${canonical}">\n  <link rel="alternate" hreflang="ko" href="${ko}">` : '';
  const navLink = (href, label, key, cls = '') => `<a href="${href}"${cls ? ` class="${cls}"` : ''}${nav === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">${alt}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ECM">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@500;700&display=swap">
  <link rel="stylesheet" href="/en/assets/en.css">
  ${GA_SNIPPET}${ld ? `\n  <script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head>
<body${bodyAttr}>
<header class="site-h">
  <div class="wrap">
    <a class="logo" href="/en/" aria-label="ECM home">${LOGO}</a>
    <nav class="nav" aria-label="Main">
      ${navLink('/en/', 'All games', 'home')}
      ${navLink('/en/about.html', 'How we check', 'about', 'opt')}
      <a class="lang" href="${ko || SITE + '/'}" hreflang="ko" lang="ko">한국어</a>
    </nav>
  </div>
</header>
${body}
<footer class="site-f">
  <div class="wrap">
    <nav aria-label="Site"><a href="/en/about.html">About</a><a href="/en/privacy.html">Privacy</a><span>${CONTACT}</span></nav>
    <span>Game names belong to their owners. ECM is not affiliated with any game publisher.</span>
  </div>
</footer>
<script src="/en/assets/en.js" defer></script>
</body>
</html>
`;
}

function gamePage(g, built) {
  const added = g.added || '0000-00-00';
  const active = g.codes.filter(x => x.status === 'active');
  const isNew = x => x.first_seen && x.first_seen > added && days(x.first_seen, built) <= NEW_DAYS;
  const codes = [...active.filter(isNew).sort((a, b) => b.first_seen.localeCompare(a.first_seen)), ...active.filter(x => !isNew(x))];
  const nNew = codes.filter(isNew).length;
  const expired = g.codes.filter(x => x.status === 'expired' && x.expired_on && days(x.expired_on, built) <= EXPIRED_DAYS)
    .sort((a, b) => b.expired_on.localeCompare(a.expired_on));
  const checked = g.last_checked || built;
  const url = `${SITE}/en/game/${g.slug}.html`;
  const ko = krPage(g.slug);
  const cat = g.platform === 'roblox' ? 'Roblox' : 'PC & Mobile';
  const steps = redeemSteps(g.redeem);
  const srcDomains = [...new Set(active.flatMap(x => x.sources || []).map(domain).filter(Boolean))]
    .filter(d => d !== domain(g.code_source));
  const title = `${g.name} Codes (${monthYear(built)})`;
  const desc = `${codes.length} working ${g.name} code${codes.length === 1 ? '' : 's'}, checked ${longDate(checked)}. See what each code gives, copy codes in one tap, and learn where to redeem them.`;

  const rows = codes.map(x => `      <div class="row${isNew(x) ? ' new' : ''}" data-code="${esc(x.code)}">
        <span class="code mono">${esc(x.code)}${isNew(x) ? ' <span class="badge">New</span>' : ''}</span>
        <button class="copy" type="button" aria-label="Copy ${esc(x.code)}">${ICON_COPY}Copy</button>
        <span class="rew">${esc(x.reward || '')}</span>
      </div>`).join('\n');

  const body = `<main class="wrap">
  <p class="crumb"><a href="/en/">ECM</a> › ${cat} › ${esc(g.name)}</p>
  <h1>${esc(title)}</h1>
  <p class="lede">Every working ${esc(g.name)} code we could confirm, with the reward each one gives. Tap a code to copy it.</p>

  <div class="status">
    <span class="big">${codes.length} working code${codes.length === 1 ? '' : 's'}</span>
    <span class="meta"><span><span class="dot"></span>Checked ${longDate(checked)}</span>${nNew ? `<span>${nNew} new</span>` : ''}</span>
    <span class="acts">
      <button class="btn primary" type="button" data-copy-all>${ICON_COPY}Copy all</button>
      ${g.code_source ? `<a class="btn" href="${esc(g.code_source)}" target="_blank" rel="noopener">${ICON_OUT}${officialLabel(g)}</a>` : ''}
    </span>
  </div>
  <p class="note">${ICON_INFO}<span>Type each code exactly as shown, capital letters included.</span></p>

  <div class="list">
${rows}
  </div>
  <div class="dock" hidden><div class="dock-in">
    <span class="dock-txt"><span class="lbl">Next code</span><span class="mono"></span></span>
    <button class="reset" type="button">Reset</button>
    <button class="copy" type="button">${ICON_COPY}Copy</button>
  </div></div>

  <div class="ad-slot" data-ad="after-codes"></div>

${steps.length ? `  <section>
    <h2>How to redeem ${esc(g.name)} codes</h2>
    <ol class="steps">
${steps.map(s => `      <li><span>${esc(s)}</span></li>`).join('\n')}
    </ol>
  </section>
` : ''}
  <section>
    <details>
      <summary>Expired codes (${expired.length})</summary>
      <ul class="exp-list">
${expired.length ? expired.map(x => `        <li><span class="mono">${esc(x.code)}</span><span>Stopped working ${shortDate(x.expired_on)}</span></li>`).join('\n') : '        <li>No codes have expired in the last 90 days.</li>'}
      </ul>
    </details>
  </section>

  <div class="ad-slot" data-ad="mid"></div>

  <section>
    <h2>How we check these codes</h2>
    <div class="verify">${ICON_SHIELD}
      <div>
        <p>A code goes on this page only when the official channel announces it, or two separate sites confirm it works within the last 14 days and spell it the same way, capital letters included.</p>
        <ul>
${g.code_source ? `          <li>Official channel: ${esc(g.code_source.replace(/^https?:\/\/(www\.)?/, ''))}</li>\n` : ''}${srcDomains.length ? `          <li>Cross-checked with ${esc(srcDomains.join(', '))}</li>\n` : ''}        </ul>
      </div>
    </div>
  </section>

  <section>
    <h2>Common questions</h2>
    <dl class="faq">
      <dt>Why doesn't a ${esc(g.name)} code work?</dt>
      <dd>Codes often expire without notice. Check the spelling and capital letters, then try again. If it still fails, the code has probably expired since our last check on ${longDate(checked)}.</dd>
      <dt>How does ECM check these codes?</dt>
      <dd>We list a code only when the official channel announces it, or two separate sites confirm it. We don't sign in to games or enter codes ourselves. <a href="/en/about.html">More about how we check</a>.</dd>
${g.code_source ? `      <dt>Where are new ${esc(g.name)} codes announced?</dt>
      <dd>The official channel we watch for this game is <a href="${esc(g.code_source)}" target="_blank" rel="noopener">${esc(g.code_source.replace(/^https?:\/\/(www\.)?/, ''))}</a>.</dd>
` : ''}    </dl>
  </section>
</main>`;

  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'ECM', item: `${SITE}/en/` },
    { '@type': 'ListItem', position: 2, name: `${g.name} Codes`, item: url }] };
  return shell({ title, desc, canonical: url, ko, nav: 'game', body, ld, bodyAttr: ` data-game="${esc(g.slug)}"` });
}

function indexPage(games, built) {
  const total = games.reduce((n, g) => n + g.codes.filter(x => x.status === 'active').length, 0);
  const card = g => {
    const active = g.codes.filter(x => x.status === 'active');
    const added = g.added || '0000-00-00';
    const nNew = active.filter(x => x.first_seen && x.first_seen > added && days(x.first_seen, built) <= NEW_DAYS).length;
    const m = monoOf(g.name);
    return `      <a class="card" href="/en/game/${esc(g.slug)}.html" data-name="${esc(g.name)}">
        <span class="tile" style="--mh:${m.h}" aria-hidden="true">${esc(m.ch)}</span>
        <span class="nm">${esc(g.name)}</span>
        <span class="sub">${active.length} code${active.length === 1 ? '' : 's'}${nNew ? ` · <span class="badge">${nNew} new</span>` : ''} · Checked ${shortDate(g.last_checked || built)}</span>
      </a>`;
  };
  const group = (id, label, list) => list.length ? `  <section data-group="${id}" id="${id}">
    <h2 class="group-h">${label} <span class="tiny">${list.length} games</span></h2>
    <div class="grid">
${list.map(card).join('\n')}
    </div>
  </section>` : '';
  const roblox = games.filter(g => g.platform === 'roblox');
  const other = games.filter(g => g.platform !== 'roblox');
  const body = `<main class="wrap">
  <h1>Working Game Codes</h1>
  <p class="lede">Codes for Roblox, PC and mobile games. Each code is confirmed by the game's official channel or by two separate sites before it goes on the list.</p>
  <div class="status">
    <span class="big">${total} working codes</span>
    <span class="meta"><span><span class="dot"></span>${games.length} games · Updated ${longDate(built)}</span></span>
  </div>
  <div class="search"><label for="game-search" class="tiny" hidden>Find a game</label><input id="game-search" type="search" placeholder="Find a game" autocomplete="off"></div>
${group('roblox', 'Roblox', roblox)}
${group('pc-mobile', 'PC &amp; Mobile', other)}
  <p class="empty" id="no-match" hidden>No game matches that search yet.</p>
</main>`;
  return shell({ title: 'Working Game Codes for Roblox, PC and Mobile | ECM', desc: `${total} working codes across ${games.length} games, each confirmed by an official channel or two separate sites. Updated ${longDate(built)}.`,
    canonical: `${SITE}/en/`, ko: `${SITE}/`, nav: 'home', body });
}

function aboutPage() {
  const body = `<main class="wrap prose">
  <h1>About ECM</h1>
  <p class="lede">Every Coupon Matters. ECM collects working game codes and checks each one against official and trusted sources.</p>
  <p>ECM started in South Korea in September 2026 at ecm-coupon.com. This English section covers games that are popular in the United States. One person runs the site.</p>
  <p>ECM is not related to ECM Vape or any other shop with a similar name. Our only address is ecm-coupon.com.</p>

  <h2 id="criteria">How we check codes</h2>
  <p>A wrong code is worse than no code, so we check where every code comes from before it goes on a page.</p>
  <ul>
    <li><strong>Official channel.</strong> When the game's official site, official social account, official Discord or Roblox game page announces a code, one source is enough.</li>
    <li><strong>Two separate sites.</strong> Without an official announcement, two independent sites that cover game codes must both list the code as working in articles dated within the last 14 days.</li>
    <li><strong>Exact spelling.</strong> Those sources must spell the code the same way, capital letters, underscores and dashes included. If they disagree, we follow the official spelling or leave the code out.</li>
    <li><strong>Not enough on its own.</strong> Comments, forum posts and a single site's list are not enough to add a code.</li>
  </ul>
  <p>We don't sign in to games or enter codes ourselves. We recheck games on a rolling schedule, and each page shows the date of its last check. When sources mark a code as expired, it moves to that page's expired list. Codes first seen in the last 14 days get a New label.</p>

  <h2>What we don't do</h2>
  <ul>
    <li>We don't ask you to sign up or sign in.</li>
    <li>We are not a partner of any game publisher. Game names belong to their owners.</li>
    <li>We don't post rumored codes.</li>
  </ul>

  <h2>How the site is paid for</h2>
  <p>ECM is free to use. The site may show ads, such as Google AdSense, and ads are kept separate from the code lists. Our <a href="/en/privacy.html">privacy policy</a> explains the cookies that ads use.</p>

  <h2>Found a wrong code?</h2>
  <p>If a code on ECM has stopped working, or you know a new one, email <strong>${CONTACT}</strong>. We check reports and update the page.</p>
</main>`;
  return shell({ title: 'About ECM and How We Check Codes', desc: 'Who runs ECM and how every game code is checked against official channels or two separate sites before it is listed.',
    canonical: `${SITE}/en/about.html`, ko: `${SITE}/about.html`, nav: 'about', body });
}

function privacyPage() {
  const body = `<main class="wrap prose">
  <h1>Privacy Policy</h1>
  <p class="tiny">Effective date: October 10, 2026</p>
  <p>This policy explains what information ECM (ecm-coupon.com, "the site") handles and how.</p>

  <h2>1. Information we collect</h2>
  <p>You can use the site without an account, and we don't ask for information that identifies you. Information is collected only in these cases:</p>
  <ul>
    <li><strong>If you email us:</strong> your email address and message, used to reply and to check reports.</li>
    <li><strong>When you visit:</strong> access logs such as IP address, browser type and time of visit, kept by our hosting service (GitHub Pages) to run the site and keep it secure. We don't use them to identify anyone.</li>
    <li><strong>Copied codes:</strong> when you copy a code, the site remembers it in your own browser (local storage) so it can show which codes you already copied. This stays on your device and is never sent to us. Clearing your browser data removes it.</li>
  </ul>

  <h2>2. Cookies and ads</h2>
  <p>We use Google Analytics to count visits. It uses cookies to collect the pages you view, time on page, how you arrived, device and browser type, and approximate location (city level). It does not collect your name or email, and we only see the totals. You can block cookies in your browser settings or install the Google Analytics Opt-out Browser Add-on.</p>
  <p>The site may show third-party ads, including Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on your previous visits to this site and other websites. Google's use of advertising cookies lets it and its partners serve ads based on those visits. You can turn off personalized ads in Google Ads Settings, and opt out of other vendors' cookies at aboutads.info.</p>

  <h2>3. How long we keep information</h2>
  <ul>
    <li>Emails are deleted within one year after we finish handling them.</li>
    <li>Access logs follow the hosting service's policy.</li>
    <li>Google deletes Google Analytics data 14 months after collection.</li>
  </ul>

  <h2>4. Sharing</h2>
  <p>We don't sell or give your personal information to others, except when the law requires it. These services process data for the site under their own privacy policies: GitHub Pages (hosting), Google Analytics (visit statistics) and Google AdSense (ads).</p>

  <h2>5. Your choices</h2>
  <p>You can ask us at any time to show, correct or delete messages you sent us. Email the address below and we will handle it promptly.</p>

  <h2>6. Children</h2>
  <p>ECM is a general-audience site and is not directed to children under 13. We don't knowingly collect personal information from children under 13. If you believe a child has sent us personal information, email us and we will delete it.</p>

  <h2>7. Links to other sites</h2>
  <p>The site links to game publishers and other websites. Their own privacy policies apply there, and ECM is not responsible for them.</p>

  <h2>8. Contact</h2>
  <p>ECM is run from South Korea. Email: <strong>${CONTACT}</strong></p>

  <h2>9. Changes</h2>
  <p>We may update this policy when laws or the site change. Updates appear on this page with a new effective date.</p>
</main>`;
  return shell({ title: 'Privacy Policy | ECM', desc: 'What information ECM collects, how cookies and ads work on the site, and how to contact us.',
    canonical: `${SITE}/en/privacy.html`, ko: `${SITE}/privacy.html`, nav: 'privacy', body });
}

function write(file, html) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === html) return false;
  fs.writeFileSync(file, html);
  return true;
}

function launchGames(cat) {
  return Object.values(cat.games)
    .filter(g => !g.launch_exclude && g.codes.some(x => x.status === 'active'))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name));
}

function main() {
  const i = process.argv.indexOf('--catalog');
  const catFile = path.resolve(ROOT, i > 0 ? process.argv[i + 1] : 'data/en-catalog.json');
  const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'));
  const built = String(cat.updated || new Date().toISOString()).slice(0, 10);
  const games = launchGames(cat);
  let changed = 0;
  const keep = new Set();
  for (const g of games) {
    const f = path.join(OUT, 'game', g.slug + '.html');
    keep.add(f);
    changed += write(f, gamePage(g, built));
  }
  const gdir = path.join(OUT, 'game');
  for (const f of fs.existsSync(gdir) ? fs.readdirSync(gdir) : []) {
    const full = path.join(gdir, f);
    if (f.endsWith('.html') && !keep.has(full)) { fs.unlinkSync(full); changed++; }
  }
  changed += write(path.join(OUT, 'index.html'), indexPage(games, built));
  changed += write(path.join(OUT, 'about.html'), aboutPage());
  changed += write(path.join(OUT, 'privacy.html'), privacyPage());
  console.log(`en: ${games.length} games, ${games.reduce((n, g) => n + g.codes.filter(x => x.status === 'active').length, 0)} codes, ${changed} file(s) changed (catalog ${cat.updated})`);
}

if (require.main === module) main();
module.exports = { redeemSteps, launchGames, gamePage, indexPage };
