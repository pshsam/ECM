/**
 * 이미지 관련 빌드 단계 (prerender.js 가 부른다). 파이썬·Pillow 가 없으면 조용히 건너뛰고 예전처럼 동작한다.
 *
 * 1. ensureOgImages: 게임·쇼핑몰 페이지마다 공유 이미지(카카오톡·SNS 미리보기)를 만든다. game/og/<id>.jpg, shop/og/<id>.jpg
 *    제목·분류가 바뀔 때만 다시 만든다(data/og-images.json 에 지문 저장). 쿠폰 개수처럼 자주 바뀌는 값은 넣지 않는다.
 * 2. ensureWebp: blog/images 의 JPG·PNG 옆에 WebP 를 만든다.
 * 3. ensureImageMarkup: 페이지 안 이미지에 WebP 를 먼저 주고(<picture>), 첫 화면 밖 이미지에 지연 로딩을 붙인다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function runPy(args, input) {
  for (const py of ['python', 'python3', 'py']) {
    const r = spawnSync(py, args, { encoding: 'utf8', input, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    if (r.error && r.error.code === 'ENOENT') continue;
    if (r.status === 0) return { ok: true, out: (r.stdout || '').trim() };
    return { ok: false, out: ((r.stderr || r.stdout || '') + '').trim().slice(-300) };
  }
  return { ok: false, out: 'python 없음' };
}

const GENRE_KIND = { mmorpg: 'mmorpg', rpg: 'rpg', action: 'action', fps: 'fps', sports: 'sports' };

/**
 * games: 페이지가 있는 게임만, shops: { 분류: [쇼핑몰] } 중 페이지가 있는 것만 넘긴다.
 * @returns {{ game: Object<string,string>, shop: Object<string,string>, made: number, error: string }}
 *   id → 이미지 주소(?v=지문: 이미지가 바뀌면 카카오톡 등의 미리보기 캐시도 새로 받게)
 */
function ensureOgImages(rootDir, games, shopCatalogs) {
  const manifestPath = path.join(rootDir, 'data', 'og-images.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { manifest = {}; }
  const jobs = [];
  const want = [];
  for (const g of games) {
    const roblox = (g.platforms || []).includes('roblox');
    const job = { out: `game/og/${g.id}.jpg`, title: `${g.title} 쿠폰 코드`, kind: 'game', genre: roblox ? 'game' : (GENRE_KIND[g.genre] || 'game'), label: roblox ? '로블록스 · 게임 코드' : '게임 쿠폰 · 입력 방법' };
    want.push(['game', g.id, job]);
  }
  for (const [cat, list] of Object.entries(shopCatalogs || {})) {
    for (const m of list) {
      const name = String(m.name || m.id).split(' (')[0];
      want.push(['shop', m.id, { out: `shop/og/${m.id}.jpg`, title: `${name} 할인·쿠폰`, kind: cat, label: '쇼핑 할인 · 혜택 정리' }]);
    }
  }
  for (const [, , job] of want) {
    const key = crypto.createHash('sha1').update(JSON.stringify(job) + '|v2').digest('hex').slice(0, 12);
    job._key = key;
    if (manifest[job.out] !== key || !fs.existsSync(path.join(rootDir, job.out))) jobs.push(job);
  }
  let made = 0, error = '';
  if (jobs.length) {
    const r = runPy([path.join(rootDir, 'scripts', 'media.py'), 'og'], JSON.stringify(jobs.map(({ _key, ...j }) => j)));
    if (r.ok) { jobs.forEach(j => { manifest[j.out] = j._key; }); made = jobs.length; }
    else error = r.out;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  }
  const has = { game: {}, shop: {} };
  for (const [kind, id, job] of want) {
    if (manifest[job.out] && fs.existsSync(path.join(rootDir, job.out))) has[kind][id] = `/${job.out}?v=${manifest[job.out]}`;
  }
  return { ...has, made, error };
}

function ensureWebp(rootDir) {
  const r = runPy([path.join(rootDir, 'scripts', 'media.py'), 'webp', 'blog/images']);
  return r.ok ? r.out : 'WebP 건너뜀: ' + r.out;
}

/**
 * 블로그 글·목록 페이지: /blog/images/ 의 JPG·PNG 에 WebP 가 있으면 <picture> 로 감싼다.
 * 머리글 로고를 뺀 모든 이미지에 loading="lazy" decoding="async" 가 없으면 붙인다(본문 이미지는 대부분 첫 화면 밖).
 */
function withImageMarkup(html, rootDir) {
  const body = html.indexOf('</header>');
  if (body < 0) return html;
  let out = html.slice(body).replace(/(<picture[\s\S]*?<\/picture>)|<img\b[^>]*>/g, (tag, pic) => {
    if (pic) return pic;
    let img = tag;
    if (/class="[^"]*ecm-logo-img/.test(img) || /src="[^"]+\.svg"/.test(img)) return img; // 로고·작은 아이콘(svg)은 첫 화면에 있어 그대로
    if (!/\bloading=/.test(img)) img = img.replace(/<img\b/, '<img loading="lazy"');
    if (!/\bdecoding=/.test(img)) img = img.replace(/<img\b/, '<img decoding="async"');
    const m = img.match(/src="(\/blog\/images\/[^"]+)\.(jpe?g|png)"/i);
    if (m && fs.existsSync(path.join(rootDir, m[1].replace(/^\//, '') + '.webp'))) {
      return `<picture class="ecm-pic"><source type="image/webp" srcset="${m[1]}.webp">${img}</picture>`;
    }
    return img;
  });
  return html.slice(0, body) + out;
}

function ensureImageMarkup(rootDir) {
  const dir = path.join(rootDir, 'blog');
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    const p = path.join(dir, f);
    const html = fs.readFileSync(p, 'utf8');
    const out = withImageMarkup(html, rootDir);
    if (out !== html) { fs.writeFileSync(p, out); n++; }
  }
  return n;
}

module.exports = { ensureOgImages, ensureWebp, ensureImageMarkup, withImageMarkup };
