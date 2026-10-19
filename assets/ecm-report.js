/**
 * "이 코드 안 돼요" 신고 (게임 페이지 코드 표, 홈 쿠폰 창). scripts/reports.js 의 REPORTS_ENABLED 가 true 일 때만 페이지가 이 파일을 불러온다.
 *
 * - [data-report-code] 버튼을 누르면 그 자리에 "만료됐대요 / 잘못된 코드래요 / 기타"가 펼쳐지고, 하나를 고르면 신고 한 건을 보낸다.
 * - 보내는 곳: 파이어스토어 reports/{무작위 id} 새 문서. 필드는 game · code · reason 과 서버 시각 ts 뿐이다(기기 정보·글 입력 없음).
 *   ts 는 서버가 채워야 규칙(ts == request.time)을 통과하므로 documents:commit 의 REQUEST_TIME 변환을 쓴다.
 *   설정(projectId·apiKey)은 assets/push-config.js 의 공개 값, 보안은 docs/firestore-reports-rules.txt 의 규칙이 맡는다.
 * - 같은 기기에서는 코드 하나에 한 번만 (localStorage ecm:reported = { "게임id:코드": 보낸 날 }).
 * - 이유·길이 제한은 scripts/reports.js 와 같아야 한다 (tests/reports.test.js 가 비교한다).
 */
(function () {
  var REASONS = { expired: '만료됐대요', invalid: '잘못된 코드래요', other: '기타' };
  var LIMITS = { game: 60, code: 80 };
  var KEY = 'ecm:reported';

  function reportKey(game, code) { return String(game) + ':' + String(code); }

  /** 20자 무작위 문서 id (파이어스토어 자동 id 와 같은 글자들) */
  function randomId(rand) {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', out = '';
    for (var i = 0; i < 20; i++) out += abc.charAt(Math.floor((rand || Math.random)() * abc.length));
    return out;
  }

  /**
   * documents:commit 본문. 값이 규칙에 안 맞으면 null (보내지 않는다).
   * 새 문서만(currentDocument.exists = false), 필드는 game·code·reason, ts 는 서버 시각.
   */
  function reportPayload(projectId, docId, game, code, reason) {
    game = String(game == null ? '' : game); code = String(code == null ? '' : code);
    if (!Object.prototype.hasOwnProperty.call(REASONS, reason)) return null;
    if (!/^[a-z0-9_-]+$/.test(game) || game.length > LIMITS.game) return null;
    if (!code || code.length > LIMITS.code) return null;
    if (!projectId || !/^[A-Za-z0-9]{20}$/.test(docId || '')) return null;
    return {
      writes: [{
        update: {
          name: 'projects/' + projectId + '/databases/(default)/documents/reports/' + docId,
          fields: { game: { stringValue: game }, code: { stringValue: code }, reason: { stringValue: reason } },
        },
        updateTransforms: [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      }],
    };
  }

  function commitUrl(cfg) {
    return 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents:commit?key=' + cfg.apiKey;
  }

  var api = { REASONS: REASONS, LIMITS: LIMITS, reportKey: reportKey, randomId: randomId, reportPayload: reportPayload, commitUrl: commitUrl };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  // ── 여기부터 브라우저 ──
  function load() { try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  var THANKS = '알려 주셔서 고마워요. 다시 확인할게요';

  function withCfg(cb) {
    if (window.ECM_PUSH && window.ECM_PUSH.projectId) return cb(window.ECM_PUSH);
    var s = document.createElement('script'); s.src = '/assets/push-config.js';
    s.onload = function () { cb(window.ECM_PUSH || {}); };
    s.onerror = function () { cb({}); };
    document.head.appendChild(s);
  }
  function done(box) { box.innerHTML = '<span class="ecm-flag-done" role="status">' + THANKS + '</span>'; }
  function paintReported() {
    var seen = load();
    Array.prototype.forEach.call(document.querySelectorAll('[data-report-code]'), function (b) {
      if (seen[reportKey(b.getAttribute('data-report-game'), b.getAttribute('data-report-code'))]) done(b.parentNode);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var open = t.closest && t.closest('[data-report-code]');
    if (open) {
      var box = open.parentNode, game = open.getAttribute('data-report-game'), code = open.getAttribute('data-report-code');
      if (load()[reportKey(game, code)]) { done(box); return; }
      var old = box.querySelector('.ecm-flag-choice');
      if (old) { old.remove(); open.setAttribute('aria-expanded', 'false'); return; }
      var wrap = document.createElement('span');
      wrap.className = 'ecm-flag-choice'; wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', '어떤 문제인가요');
      Object.keys(REASONS).forEach(function (r) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-report-reason', r); b.textContent = REASONS[r];
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
      open.setAttribute('aria-expanded', 'true');
      return;
    }
    var pick = t.closest && t.closest('[data-report-reason]');
    if (!pick) return;
    var box2 = pick.closest('.ecm-flag'), btn = box2 && box2.querySelector('[data-report-code]');
    if (!btn) return;
    var g = btn.getAttribute('data-report-game'), c = btn.getAttribute('data-report-code'), reason = pick.getAttribute('data-report-reason');
    Array.prototype.forEach.call(box2.querySelectorAll('[data-report-reason]'), function (x) { x.disabled = true; });
    withCfg(function (cfg) {
      var body = cfg.apiKey ? reportPayload(cfg.projectId, randomId(), g, c, reason) : null;
      function fail() {
        Array.prototype.forEach.call(box2.querySelectorAll('[data-report-reason]'), function (x) { x.disabled = false; });
        var n = box2.querySelector('.ecm-flag-err') || box2.appendChild(document.createElement('span'));
        n.className = 'ecm-flag-err'; n.textContent = '보내지 못했어요. 잠시 뒤 다시 눌러 주세요';
      }
      if (!body) return fail();
      fetch(commitUrl(cfg), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          if (!r.ok) return fail();
          var s = load(); s[reportKey(g, c)] = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); save(s);
          done(box2);
          if (typeof window.gtag === 'function') window.gtag('event', 'report_code', { game_id: g, reason: reason });
        }, fail);
    });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintReported); else paintReported();
  // 홈 쿠폰 창은 열 때마다 새로 그리므로, 창이 그려진 뒤에도 표시를 맞춘다
  window.ECM_REPORT_PAINT = paintReported;
})();
