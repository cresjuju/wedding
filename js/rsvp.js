(function () {
  'use strict';

  var form = document.getElementById('rsvp-form');
  if (!form) return;

  var app = window.Invitation;
  var endpoint = (document.querySelector('.invitation').dataset.endpoint || '').trim();
  var doneEl = document.getElementById('rsvp-done');
  var openBtn = document.getElementById('rsvp-open');
  var attendOnly = form.querySelector('.rsvp__attend-only');
  var DONE_KEY = 'rsvp-sent';

  // 이미 전달한 사람에게는 완료 문구 표시 (다시 보내는 것은 허용)
  function markDone() {
    doneEl.hidden = false;
    openBtn.textContent = '다시 전달하기';
    openBtn.classList.remove('btn--fill');
    openBtn.classList.add('btn--outline');
  }
  try { if (localStorage.getItem(DONE_KEY)) markDone(); } catch (e) { /* 저장 불가 환경 */ }

  // 불참이면 인원/식사 항목 숨김
  function syncAttend() {
    attendOnly.hidden = form.elements.attend.value === '불참';
  }
  Array.prototype.forEach.call(form.elements.attend, function (r) { r.addEventListener('change', syncAttend); });
  syncAttend();

  function send(body) {
    if (!endpoint) return Promise.resolve({ ok: true, preview: true });
    // text/plain 으로 보내야 CORS preflight 없이 Apps Script 에 도달함
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var side = f.side.value;
    var attend = f.attend.value;
    var name = f.name.value.trim();

    if (!side) return app.toast('신랑측 / 신부측을 선택해주세요');
    if (!name) return app.toast('성함을 입력해주세요');

    var body = {
      action: 'rsvp',
      side: side,
      attend: attend,
      name: name,
      count: attend === '참석' ? Number(f.count.value) : 0,
      meal: attend === '참석' ? f.meal.value : '-',
      memo: f.memo.value.trim(),
      website: f.website.value
    };

    var submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    send(body)
      .then(function (res) {
        if (!res.ok) throw new Error(res.error);
        try { localStorage.setItem(DONE_KEY, '1'); } catch (err) { /* 무시 */ }
        form.reset();
        syncAttend();
        app.hideModal();
        markDone();
        app.toast(res.preview ? '미리보기 모드 · 실제로 전송되지 않았습니다' : '참석 의사가 전달되었습니다');
      })
      .catch(function () { app.toast('전달에 실패했습니다. 잠시 후 다시 시도해주세요'); })
      .then(function () { submit.disabled = false; });
  });
})();
