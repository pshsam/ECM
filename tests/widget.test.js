// 아이폰 앱 위젯 요약(/app/widget.json)과 앱 알림 모양 점검. 앱(ECM 앱 저장소 ios/App/Shared/CouponFeed.swift)이 읽는 형식이 깨지지 않게 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPage, ROOT } = require('./page');
const mono = require('../scripts/mono');
const { evaluate } = require('../scripts/game-pages');
const { buildWidgetFeed } = require('../scripts/widget-feed');
const { messageFor, nativeOf } = require('../scripts/notify-push');

const { initialGameCatalog: catalog } = loadPage().state();
const seen = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coupon-seen.json'), 'utf8'));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

test('위젯 요약: 앱이 읽는 형식 (v1, 게임마다 id·이름·글자 타일·코드 날짜 쌍)', () => {
  const ids = catalog.map(g => g.id);
  const feed = buildWidgetFeed({ games: catalog, firstSeen: seen, gamePageIds: ids, evaluate, version: '2026-10-11' });
  assert.equal(feed.v, 1);
  assert.equal(feed.updated, '2026-10-11');
  assert.ok(feed.games.length > 0);
  for (const g of feed.games) {
    assert.match(g.id, /^[a-z0-9_-]+$/);
    assert.ok(g.t);
    assert.deepEqual({ ch: g.ch, h: g.h }, mono.monoOf(g.t), `${g.id}: 글자 타일이 사이트와 다름`);
    assert.equal(typeof g.p, 'boolean');
    for (const pair of g.c) {
      assert.equal(pair.length, 2);
      for (const d of pair) assert.ok(d === '' || DATE.test(d), `${g.id}: 날짜 형식 ${d}`);
    }
  }
});

test('위젯 요약에는 쿠폰 코드 문자열이 없다 (코드는 앱에 들어와서 확인)', () => {
  const ids = catalog.map(g => g.id);
  const json = JSON.stringify(buildWidgetFeed({ games: catalog, firstSeen: seen, gamePageIds: ids, evaluate, version: 'x' }));
  for (const g of catalog) for (const c of g.coupons || []) {
    // 날짜·게임 id 와 우연히 같은 짧은 코드는 건너뛴다
    if (String(c.code).length < 5 || DATE.test(c.code) || g.id === String(c.code).toLowerCase()) continue;
    assert.ok(!json.includes(JSON.stringify(String(c.code))), `${g.id}: 코드 ${c.code} 가 들어 있음`);
  }
});

test('위젯 요약: 만료된 코드는 빼고, 페이지도 코드도 없는 게임은 뺀다', () => {
  const games = [
    { id: 'a', title: '가', coupons: [{ code: 'OLD1', expireDate: '2020-01-01' }, { code: 'LIVE1', expireDate: '상시' }] },
    { id: 'b', title: '나', coupons: [{ code: 'OLD2', expireDate: '2020-01-01' }] },
    { id: 'c', title: '다', coupons: [] },
  ];
  const feed = buildWidgetFeed({ games, firstSeen: { 'a:LIVE1': '2026-10-10' }, gamePageIds: ['c'], evaluate, version: 'x' });
  assert.deepEqual(feed.games.map(g => [g.id, g.c]), [['a', [['2026-10-10', '']]], ['c', []]]);
});

test('앱 알림: 아이폰은 apns 알림, 안드로이드는 데이터 메시지, 웹은 webpush. 앱 알림 본문에 코드 복사 문구 없음', () => {
  const msg = { title: '게임 새 쿠폰 2개', body: '보상 · 눌러서 코드 복사', appBody: '보상 · 눌러서 코드 보기',
    link: 'https://ecm-coupon.com/game/x.html?utm_source=push#added-2026-10-11', tag: 'ecm-x-2026-10-11' };
  assert.equal(nativeOf('native-ios'), 'ios');
  assert.equal(nativeOf('native-android'), 'android');
  assert.equal(nativeOf('ios-app'), '');

  const ios = messageFor('t', msg, 'ios');
  assert.deepEqual(ios.notification, { title: msg.title, body: msg.appBody });
  assert.equal(ios.data.link, msg.link);
  assert.equal(ios.apns.payload.aps['thread-id'], 'ecm-x');
  assert.ok(ios.apns.headers['apns-collapse-id'].length <= 64);
  for (const v of Object.values(ios.data)) assert.equal(typeof v, 'string');

  const android = messageFor('t', msg, 'android');
  assert.equal(android.notification, undefined);
  assert.equal(android.data.body, msg.appBody);

  assert.ok(messageFor('t', msg, '').webpush);
});
