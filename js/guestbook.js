(function () {
  'use strict';

  var section = document.getElementById('guestbook');
  if (!section) return;

  var app = window.Invitation;
  var endpoint = (document.querySelector('.invitation').dataset.endpoint || '').trim();
  var PAGE = 5;

  var listEl = document.getElementById('gb-list');
  var statusEl = document.getElementById('gb-status');
  var moreBtn = document.getElementById('gb-more');
  var writeForm = document.getElementById('gb-form');
  var deleteForm = document.getElementById('gb-delete-form');
  var countEl = document.getElementById('gb-count');

  var items = [];
  var shown = PAGE;
  var deletingId = null;

  /* ---------- 저장소 ----------
     endpoint 가 있으면 Apps Script(구글 시트), 없으면 이 브라우저 localStorage 미리보기 */
  var api = endpoint ? {
    list: function () {
      return fetch(endpoint + '?t=' + Date.now()).then(toJson);
    },
    // text/plain 으로 보내야 CORS preflight 없이 Apps Script 에 도달함
    send: function (body) {
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      }).then(toJson);
    }
  } : localApi();

  function toJson(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function localApi() {
    var KEY = 'guestbook-preview';
    var read = function () {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
    };
    var write = function (rows) {
      try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { /* 저장 불가 환경 */ }
    };
    return {
      list: function () {
        return Promise.resolve({ ok: true, items: read().map(function (r) {
          return { id: r.id, name: r.name, message: r.message, createdAt: r.createdAt };
        }).reverse() });
      },
      send: function (body) {
        var rows = read();
        if (body.action === 'create') {
          rows.push({ id: String(Date.now()), name: body.name, message: body.message, password: body.password, createdAt: new Date().toISOString() });
          write(rows);
          return Promise.resolve({ ok: true });
        }
        var idx = rows.findIndex(function (r) { return r.id === body.id; });
        if (idx < 0) return Promise.resolve({ ok: false, error: 'NOT_FOUND' });
        if (rows[idx].password !== body.password) return Promise.resolve({ ok: false, error: 'WRONG_PASSWORD' });
        rows.splice(idx, 1);
        write(rows);
        return Promise.resolve({ ok: true });
      }
    };
  }

  var ERRORS = {
    WRONG_PASSWORD: '비밀번호가 일치하지 않습니다',
    NOT_FOUND: '이미 삭제된 글입니다',
    INVALID: '입력 내용을 확인해주세요',
    BUSY: '잠시 후 다시 시도해주세요'
  };

  /* ---------- 렌더링 (textContent 만 사용해 스크립트 삽입 방지) ---------- */
  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  function render() {
    listEl.textContent = '';
    items.slice(0, shown).forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'gb-item';

      var head = document.createElement('div');
      head.className = 'gb-item__head';
      var name = document.createElement('span');
      name.className = 'gb-item__name';
      name.textContent = it.name;
      var date = document.createElement('span');
      date.className = 'gb-item__date';
      date.textContent = formatDate(it.createdAt);
      head.appendChild(name);
      head.appendChild(date);

      var msg = document.createElement('p');
      msg.className = 'gb-item__msg';
      msg.textContent = it.message;

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'gb-item__del';
      del.setAttribute('aria-label', it.name + '님의 글 삭제');
      del.textContent = '×';
      del.addEventListener('click', function () {
        deletingId = it.id;
        deleteForm.reset();
        app.showModal(document.getElementById('gb-delete'));
      });

      li.appendChild(head);
      li.appendChild(msg);
      li.appendChild(del);
      listEl.appendChild(li);
    });

    moreBtn.hidden = items.length <= shown;
    if (!items.length) statusEl.textContent = '첫 번째 축하 메시지를 남겨주세요.';
    else statusEl.textContent = endpoint ? '' : '미리보기 모드 · 이 브라우저에만 저장됩니다';
  }

  function load() {
    return api.list().then(function (data) {
      if (!data.ok) throw new Error(data.error);
      items = data.items || [];
      render();
    }).catch(function () {
      statusEl.textContent = '방명록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    });
  }

  moreBtn.addEventListener('click', function () {
    shown += PAGE;
    render();
  });

  /* ---------- 작성 ---------- */
  var msgInput = writeForm.elements.message;
  msgInput.addEventListener('input', function () { countEl.textContent = msgInput.value.length; });

  writeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = writeForm.elements;
    var name = f.name.value.trim();
    var password = f.password.value;
    var message = f.message.value.trim();

    if (!name) return app.toast('이름을 입력해주세요');
    if (password.length < 4) return app.toast('비밀번호를 4자 이상 입력해주세요');
    if (!message) return app.toast('메시지를 입력해주세요');

    var submit = writeForm.querySelector('[type="submit"]');
    submit.disabled = true;
    api.send({ action: 'create', name: name, password: password, message: message, website: f.website.value })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error);
        writeForm.reset();
        countEl.textContent = '0';
        app.hideModal();
        app.toast('방명록이 등록되었습니다');
        shown = PAGE;
        return load();
      })
      .catch(function (err) { app.toast(ERRORS[err.message] || '등록에 실패했습니다. 다시 시도해주세요'); })
      .then(function () { submit.disabled = false; });
  });

  /* ---------- 삭제 ---------- */
  deleteForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = deleteForm.elements.password.value;
    if (!password) return app.toast('비밀번호를 입력해주세요');

    var submit = deleteForm.querySelector('[type="submit"]');
    submit.disabled = true;
    api.send({ action: 'delete', id: deletingId, password: password })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error);
        app.hideModal();
        app.toast('삭제되었습니다');
        return load();
      })
      .catch(function (err) { app.toast(ERRORS[err.message] || '삭제에 실패했습니다. 다시 시도해주세요'); })
      .then(function () { submit.disabled = false; });
  });

  load();
})();
