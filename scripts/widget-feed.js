/**
 * ECM 쿠폰 아이폰 앱의 홈·잠금 화면 위젯이 읽는 쿠폰 요약: /app/widget.json
 *
 * 위젯은 "내 게임"(앱이 넘긴 게임 id 목록)마다 새 코드 수·살아 있는 코드 수·오늘 마감 수를 보여 준다.
 * 날짜는 위젯이 보는 날(한국 날짜)로 다시 세므로, 여기서는 코드마다 [처음 올라온 날, 공식 만료일]만 적는다.
 * **코드 문자열은 넣지 않는다** — 코드는 앱에 들어와서 확인하게 한다(알림과 같은 결정, 2026-10-01).
 * 형식을 바꾸면 v 를 올리고 앱 저장소(바탕 화면 'ECM 앱') ios/App/Shared/CouponFeed.swift 도 같이 바꾼다.
 * prerender.js 가 쿠폰을 갱신할 때마다 다시 만든다. 손으로 고치지 않는다.
 */
const fs = require('fs');
const path = require('path');
const { monoOf } = require('./mono');

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function buildWidgetFeed({ games, firstSeen, gamePageIds, evaluate, version }) {
  const pages = new Set(gamePageIds);
  const out = [];
  for (const g of games) {
    const codes = [];
    for (const c of g.coupons || []) {
      if (!evaluate(c).active) continue;
      const added = firstSeen[g.id + ':' + c.code] || '';
      const expire = DATE.test(c.expireDate || '') ? c.expireDate : '';
      codes.push([DATE.test(added) ? added : '', expire]);
    }
    if (!codes.length && !pages.has(g.id)) continue;
    codes.sort((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0));
    const m = monoOf(g.title);
    out.push({ id: g.id, t: g.title, ch: m.ch, h: m.h, p: pages.has(g.id), c: codes });
  }
  return { v: 1, updated: version, games: out };
}

function writeWidgetFeed(rootDir, args) {
  const feed = buildWidgetFeed(args);
  const dir = path.join(rootDir, 'app');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'widget.json');
  const body = JSON.stringify(feed) + '\n';
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) fs.writeFileSync(file, body);
  return feed.games.length;
}

module.exports = { buildWidgetFeed, writeWidgetFeed };
