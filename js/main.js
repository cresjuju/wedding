(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- 토스트 ---------- */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2000);
  }

  /* ---------- 클립보드 (http 환경/구형 브라우저 대비 fallback) ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyText(btn.getAttribute('data-copy'))
        .then(function () { toast('복사되었습니다'); })
        .catch(function () { toast('복사에 실패했습니다. 길게 눌러 복사해주세요'); });
    });
  });

  /* ---------- 달력 ---------- */
  var cal = $('#calendar');
  if (cal) {
    var y = +cal.dataset.year, m = +cal.dataset.month, d = +cal.dataset.day;
    var first = new Date(y, m - 1, 1).getDay();
    var last = new Date(y, m, 0).getDate();
    var html = '<div class="calendar__grid">';
    ['일', '월', '화', '수', '목', '금', '토'].forEach(function (w, i) {
      html += '<div class="calendar__cell calendar__head' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '') + '">' + w + '</div>';
    });
    for (var i = 0; i < first; i++) html += '<div class="calendar__cell"></div>';
    for (var day = 1; day <= last; day++) {
      var dow = (first + day - 1) % 7;
      var cls = 'calendar__cell' + (dow === 0 ? ' is-sun' : dow === 6 ? ' is-sat' : '') + (day === d ? ' is-day' : '');
      html += '<div class="' + cls + '"><span>' + day + '</span></div>';
    }
    cal.innerHTML = html + '</div>';
  }

  /* ---------- D-day 카운트다운 ---------- */
  var cd = $('#countdown');
  if (cd) {
    var target = new Date(cd.dataset.target).getTime();
    var units = { d: $('[data-unit="d"]', cd), h: $('[data-unit="h"]', cd), m: $('[data-unit="m"]', cd), s: $('[data-unit="s"]', cd) };
    var msg = $('#dday-msg');
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var tick = function () {
      var diff = Math.max(0, target - Date.now());
      var sec = Math.floor(diff / 1000);
      units.d.textContent = Math.floor(sec / 86400);
      units.h.textContent = pad(Math.floor(sec % 86400 / 3600));
      units.m.textContent = pad(Math.floor(sec % 3600 / 60));
      units.s.textContent = pad(sec % 60);
      var days = Math.ceil(diff / 86400000);
      msg.innerHTML = diff > 0
        ? '동훈 ♥ 연주의 결혼식이 <em>' + days + '일</em> 남았습니다.'
        : '동훈 ♥ 연주이 부부가 되었습니다. 감사합니다.';
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- 갤러리 더보기 ---------- */
  var grid = $('#gallery');
  var moreBtn = $('#gallery-more');
  var galleryImgs = $$('img', grid);
  if (galleryImgs.length > 9) {
    grid.classList.add('is-collapsed');
    moreBtn.addEventListener('click', function () {
      var collapsed = grid.classList.toggle('is-collapsed');
      moreBtn.textContent = collapsed ? '사진 더보기 ∨' : '접기 ∧';
    });
  } else {
    moreBtn.hidden = true;
  }

  /* ---------- 스크롤 잠금 (iOS 대응) ---------- */
  var scrollY = 0;
  function lock() {
    scrollY = window.pageYOffset;
    document.body.style.top = -scrollY + 'px';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.classList.add('is-locked');
  }
  function unlock() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.classList.remove('is-locked');
    window.scrollTo(0, scrollY);
  }

  /* ---------- 라이트박스 ---------- */
  var lb = $('#lightbox');
  var lbImg = $('.lightbox__img', lb);
  var lbCount = $('.lightbox__count', lb);
  var current = 0;

  function show(idx) {
    current = (idx + galleryImgs.length) % galleryImgs.length;
    lbImg.style.opacity = 0;
    lbImg.onload = function () { lbImg.style.opacity = 1; };
    lbImg.src = galleryImgs[current].src;
    lbImg.alt = galleryImgs[current].alt;
    lbCount.textContent = (current + 1) + ' / ' + galleryImgs.length;
  }
  function openLb(idx) { show(idx); lb.hidden = false; lock(); }
  function closeLb() { lb.hidden = true; unlock(); }

  galleryImgs.forEach(function (img, i) {
    img.parentNode.addEventListener('click', function () { openLb(i); });
  });
  $('.lightbox__nav--prev', lb).addEventListener('click', function (e) { e.stopPropagation(); show(current - 1); });
  $('.lightbox__nav--next', lb).addEventListener('click', function (e) { e.stopPropagation(); show(current + 1); });
  $('[data-close]', lb).addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

  // 스와이프
  var startX = 0, startY = 0;
  lb.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  });

  /* ---------- 모달 (연락하기 / 방명록) ---------- */
  var openModal = null;
  function showModal(el) {
    if (openModal) hideModal();
    openModal = el;
    openModal.hidden = false;
    lock();
  }
  function hideModal() {
    if (!openModal) return;
    openModal.hidden = true;
    openModal = null;
    unlock();
  }
  $$('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () { showModal(document.getElementById(btn.dataset.open)); });
  });
  $$('.modal [data-close]').forEach(function (el) {
    el.addEventListener('click', hideModal);
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    } else if (openModal && e.key === 'Escape') {
      hideModal();
    }
  });

  // guestbook.js 등 다른 스크립트에서 쓰는 공용 기능
  window.Invitation = { toast: toast, showModal: showModal, hideModal: hideModal };

  /* ---------- 계좌 아코디언 ---------- */
  $$('.accordion__head').forEach(function (head) {
    head.addEventListener('click', function () {
      head.setAttribute('aria-expanded', head.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
  });

  /* ---------- 티맵 (앱 없으면 웹으로) ---------- */
  $$('[data-fallback]').forEach(function (a) {
    a.addEventListener('click', function () {
      var fallback = a.dataset.fallback;
      var t = setTimeout(function () { if (!document.hidden) window.location.href = fallback; }, 1500);
      window.addEventListener('pagehide', function () { clearTimeout(t); }, { once: true });
    });
  });

  /* ---------- 공유 ---------- */
  // og:url 이 있으면 그 주소를 공유 (주소창의 #location 같은 꼬리 제외)
  var ogUrl = document.querySelector('meta[property="og:url"]');
  var siteUrl = (ogUrl && ogUrl.content) || location.href.split('#')[0];

  $('#link-btn').addEventListener('click', function () {
    copyText(siteUrl)
      .then(function () { toast('청첩장 링크가 복사되었습니다'); })
      .catch(function () { toast('복사에 실패했습니다'); });
  });

  // 카카오 공유가 불가능할 때 쓰는 기본 공유
  function shareFallback() {
    var data = { title: document.title, text: '2027.10.09 (토) 오전 11시 · 월드컵컨벤션 그랜드볼룸홀', url: siteUrl };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else {
      copyText(siteUrl).then(function () { toast('링크가 복사되었습니다. 원하는 곳에 붙여넣어 주세요'); });
    }
  }
  window.Invitation.siteUrl = siteUrl;
  window.Invitation.shareFallback = shareFallback;

  /* ---------- 배경음악 ----------
     브라우저 정책상 소리 있는 자동재생은 막히는 경우가 많아서,
     먼저 재생을 시도하고 실패하면 첫 터치/클릭 때 재생한다.
     사용자가 직접 끈 경우에는 다시 켜지 않는다. */
  var bgm = $('#bgm');
  var bgmBtn = $('#bgm-btn');
  if (bgm && bgmBtn) {
    var userMuted = false;
    var resumeOnShow = false;
    var setBtn = function (on) {
      bgmBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      bgmBtn.setAttribute('aria-label', on ? '배경음악 끄기' : '배경음악 재생');
    };
    var play = function () {
      var p = bgm.play();
      if (p && p.then) p.then(function () { setBtn(true); }).catch(function () { setBtn(false); });
      else setBtn(true);
      return p;
    };
    var firstGesture = function (e) {
      if (e && bgmBtn.contains(e.target)) return;  // 버튼 클릭은 아래 토글이 처리
      removeGesture();
      if (!userMuted && bgm.paused) play();
    };
    var gestureEvents = ['touchend', 'click', 'keydown'];
    var removeGesture = function () {
      gestureEvents.forEach(function (ev) { document.removeEventListener(ev, firstGesture, true); });
    };
    gestureEvents.forEach(function (ev) { document.addEventListener(ev, firstGesture, true); });

    bgm.volume = 0.5;
    var auto = play();
    if (auto && auto.then) auto.then(removeGesture).catch(function () {});

    bgmBtn.addEventListener('click', function () {
      removeGesture();
      if (bgm.paused) { userMuted = false; play(); }
      else { userMuted = true; bgm.pause(); setBtn(false); }
    });

    // 다른 앱/탭으로 나가면 멈추고, 돌아오면 이어서 재생
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        resumeOnShow = !bgm.paused;
        bgm.pause();
      } else if (resumeOnShow && !userMuted) {
        play();
      }
    });
  }

  /* ---------- 스크롤 등장 효과 ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
