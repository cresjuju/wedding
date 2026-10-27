(function () {
  'use strict';

  var app = window.Invitation;
  var root = document.querySelector('.invitation');
  var key = (root.dataset.kakaoKey || '').trim();
  var meta = function (prop) {
    var el = document.querySelector('meta[property="' + prop + '"]');
    return el ? el.content : '';
  };

  /* ---------- 카카오톡 공유 ----------
     카카오 개발자 콘솔에 등록한 도메인(https://cresjuju.github.io)에서만 동작.
     로컬 파일이나 SDK 로드 실패 시에는 휴대폰 기본 공유로 대체. */
  var shareReady = false;
  if (key && window.Kakao) {
    try {
      if (!Kakao.isInitialized()) Kakao.init(key);
      shareReady = true;
    } catch (e) { shareReady = false; }
  }

  var shareBtn = document.getElementById('kakao-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      if (!shareReady || location.protocol === 'file:') return app.shareFallback();
      var url = app.siteUrl;
      try {
        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: meta('og:title') || document.title,
            description: meta('og:description'),
            imageUrl: meta('og:image'),
            imageWidth: 1200,
            imageHeight: 628,
            link: { mobileWebUrl: url, webUrl: url }
          },
          buttons: [
            { title: '청첩장 보기', link: { mobileWebUrl: url, webUrl: url } },
            { title: '위치 보기', link: { mobileWebUrl: url + '#location', webUrl: url + '#location' } }
          ]
        });
      } catch (e) {
        app.shareFallback();
      }
    });
  }

  /* ---------- 카카오맵 ----------
     지도 영역이 화면 근처에 왔을 때 SDK 를 불러옴. 실패하면 기존 구글 지도 유지. */
  var mapEl = document.getElementById('map');
  if (!key || !mapEl) return;

  function loadMapSdk() {
    var s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false&libraries=services';
    s.onload = function () {
      // 도메인 미등록 등으로 거부되면 kakao.maps 가 생기지 않음
      if (window.kakao && kakao.maps && kakao.maps.load) kakao.maps.load(drawMap);
    };
    document.head.appendChild(s);
  }

  function drawMap() {
    var name = mapEl.dataset.name;
    var fallback = new kakao.maps.LatLng(+mapEl.dataset.lat, +mapEl.dataset.lng);

    var canvas = document.createElement('div');
    canvas.className = 'map__kakao';
    mapEl.appendChild(canvas);

    var map = new kakao.maps.Map(canvas, { center: fallback, level: 4 });
    // 지도 위에서 스크롤해도 페이지가 내려가도록 드래그/휠 확대는 끄고 버튼으로만 확대
    map.setDraggable(false);
    map.setZoomable(false);
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

    var place = function (pos) {
      map.setCenter(pos);
      new kakao.maps.Marker({ map: map, position: pos });
      var label = document.createElement('div');
      label.className = 'map__label';
      label.textContent = name;
      new kakao.maps.CustomOverlay({ map: map, position: pos, content: label, yAnchor: 2.6 });
    };

    // 장소 이름으로 정확한 좌표를 찾고, 실패하면 data-lat/lng 사용
    if (kakao.maps.services) {
      new kakao.maps.services.Places().keywordSearch(name, function (data, status) {
        if (status === kakao.maps.services.Status.OK && data.length) {
          place(new kakao.maps.LatLng(+data[0].y, +data[0].x));
        } else {
          place(fallback);
        }
      });
    } else {
      place(fallback);
    }

    // 카카오맵이 그려지면 구글 지도 제거
    var iframe = mapEl.querySelector('iframe');
    if (iframe) iframe.remove();
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); loadMapSdk(); }
    }, { rootMargin: '600px 0px' });
    io.observe(mapEl);
  } else {
    loadMapSdk();
  }
})();
