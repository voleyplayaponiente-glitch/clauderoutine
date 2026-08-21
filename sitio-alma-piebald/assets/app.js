/* ══════════════════════════════════════════════════════════════
   ALMA PIEBALD · motor del recorrido y vida de la página
   Sin dependencias. Sin paso de compilación.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VIDEO_SRC  = 'assets/hero-scrub.mp4';
  var POSTER_SRC = 'assets/hero-poster.jpg';

  var body    = document.body;
  var hero    = document.getElementById('hero');
  var video   = document.getElementById('heroVideo');
  var poster  = document.getElementById('heroPoster');
  var scrim   = document.getElementById('heroScrim');
  var settle  = document.getElementById('settle');
  var cue     = document.getElementById('scrollcue');
  var ring    = document.getElementById('ring');
  var ringFil = document.getElementById('ringFill');
  var ringPct = document.getElementById('ringPct');
  var bandEls = [].slice.call(document.querySelectorAll('.band'));

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var easeIO = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  /* ── el mapa de bandas: meseta larga, rampas cortas ───────── */
  /* Las bandas SE SOLAPAN un tramo igual a la rampa. Con huecos entre ellas,
     un visitante que baja a golpes de dedo cae en pantallas sin una palabra;
     solapadas, el relevo es un fundido cruzado y nunca hay vacío. */
  var BANDS = [
    { a: -0.06, b: 0.27 },
    { a:  0.22, b: 0.50 },
    { a:  0.45, b: 0.73 },
    { a:  0.68, b: 0.97 }
  ];
  var RAMP = 0.05;
  var SETTLE_AT = 0.90, SETTLE_SPAN = 0.07;

  function bandAlpha(p, band) {
    if (p <= band.a || p >= band.b) return 0;
    if (p < band.a + RAMP) return easeIO((p - band.a) / RAMP);
    if (p > band.b - RAMP) return easeIO((band.b - p) / RAMP);
    return 1;                                   // la meseta: sobrevive a varios flicks
  }

  /* ══ 1. LAS PUERTAS DEL HÉROE ESTÁTICO ═══════════════════════
     Cinco motivos para servir la portada fija en vez del recorrido.
     Se quedan vivas: cada una con su listener. */
  var mqNarrow  = window.matchMedia('(max-width: 900px)');
  var mqReduce  = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqNoHover = window.matchMedia('(any-hover: none)');
  var videoFailed = false;

  function saveData() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData || /^([23]g|slow-2g)$/.test(c.effectiveType || '')));
  }
  function canPlayMp4() {
    return !!(video.canPlayType && video.canPlayType('video/mp4').replace('no', ''));
  }
  function wantsScrub() {
    return !mqNarrow.matches && !mqReduce.matches && !mqNoHover.matches &&
           !saveData() && !videoFailed && canPlayMp4();
  }

  var mode = null;
  function applyMode() {
    var next = wantsScrub() ? 'scrub' : 'static';
    if (next === mode) return;
    mode = next;
    body.setAttribute('data-mode', mode);
    if (mode === 'scrub') { loadVideo(); wake(); }
    else { stopLoop(); showStatic(); }
  }
  [mqNarrow, mqReduce, mqNoHover].forEach(function (mq) {
    var on = function () { applyMode(); };
    if (mq.addEventListener) mq.addEventListener('change', on);
    else if (mq.addListener) mq.addListener(on);
  });

  function showStatic() {
    if (ring) ring.hidden = true;
    video.setAttribute('data-on', '0');
    settle.setAttribute('data-on', '1');
    settle.style.opacity = '';
    settle.style.transform = '';
    bandEls.forEach(function (el) { el.style.opacity = '0'; });
    /* se limpia el valor en línea para que mande la regla CSS del modo estático */
    if (scrim) scrim.style.opacity = '';
  }

  /* la portada fija se intenta siempre: si no hay archivo, manda el telón dibujado */
  (function preloadPoster() {
    var img = new Image();
    img.onload = function () { poster.src = POSTER_SRC; poster.setAttribute('data-on', '1'); };
    img.onerror = function () { /* el telón CSS ya está detrás, la página no se rompe */ };
    img.src = POSTER_SRC;
  })();

  /* ══ 2. TRAER EL VÍDEO COMO BLOB, CON ANILLO HONESTO ═════════
     Blob y no src directo: así el navegador tiene el archivo entero
     en memoria y buscar fotogramas funciona aunque el host no sirva
     peticiones por rango. */
  var videoReady = false, loading = false;

  function setRing(frac) {
    var C = 119.4;
    ringFil.style.strokeDashoffset = String(C - C * clamp(frac, 0, 1));
    ringPct.textContent = Math.round(frac * 100) + '%';
  }

  function loadVideo() {
    if (videoReady || loading) return;
    loading = true;
    ring.hidden = false;
    setRing(0);

    fetch(VIDEO_SRC).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var total = parseInt(res.headers.get('content-length') || '0', 10);
      if (!res.body || !total) return res.blob();
      var reader = res.body.getReader(), chunks = [], got = 0;
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks, { type: 'video/mp4' });
          chunks.push(r.value); got += r.value.length;
          setRing(got / total);
          return pump();
        });
      })();
    }).then(function (blob) {
      setRing(1);
      var url = URL.createObjectURL(blob);
      video.src = url;
      video.load();

      /* plazo máximo: si los metadatos no llegan (códec que el navegador no
         sabe leer, archivo tocado), no dejamos el anillo girando para siempre.
         Se cae a la portada fija, que siempre está lista. */
      var settled = false, guard = 0;
      var fail = function () {
        if (settled) return;
        settled = true; clearTimeout(guard);
        loading = false; videoFailed = true;
        ring.hidden = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        applyMode();
      };
      var ok = function () {
        if (settled) return;
        if (!(isFinite(video.duration) && video.duration > 0)) return fail();
        settled = true; clearTimeout(guard);
        videoReady = true; loading = false;
        duration = video.duration;
        ring.hidden = true;
        video.setAttribute('data-on', '1');
        try { video.currentTime = 0.001; } catch (e) {}
        wake();
      };
      guard = setTimeout(fail, 9000);
      video.addEventListener('error', fail, { once: true });
      if (video.readyState >= 1) ok();
      else video.addEventListener('loadedmetadata', ok, { once: true });
    }).catch(function () {
      loading = false; videoFailed = true;
      ring.hidden = true;
      applyMode();                              // cae al héroe estático, sin drama
    });
  }

  /* ══ 3. EL BUCLE: lerp normalizado por dt, con verja y descanso ══ */
  var targetT = 0, shownT = 0, rafId = 0, lastNow = 0, seekPending = false;
  var lastWrites = { scrim: -1, settle: -1, bands: [] };
  var duration = 0;

  video.addEventListener('seeked', function () { seekPending = false; });
  video.addEventListener('error', function () {
    if (mode === 'scrub') { videoFailed = true; applyMode(); }
  });

  function progress() {
    var r = hero.getBoundingClientRect();
    var span = hero.offsetHeight - window.innerHeight;
    if (span <= 0) return 0;
    return clamp(-r.top / span, 0, 1);
  }

  function paint(p) {
    /* bandas: escritura al DOM solo cuando el valor cambia de verdad */
    var top = 0;
    for (var i = 0; i < BANDS.length; i++) {
      var a = bandAlpha(p, BANDS[i]);
      /* pegar los extremos: sin esto la verja de escritura se cierra cerca del
         final y deja la banda clavada en un resto de opacidad que nunca limpia */
      if (a < 0.012) a = 0; else if (a > 0.988) a = 1;
      if (a > top) top = a;
      if (lastWrites.bands[i] === undefined || Math.abs(lastWrites.bands[i] - a) > 0.008) {
        lastWrites.bands[i] = a;
        var el = bandEls[i];
        el.style.opacity = a.toFixed(3);
        /* una entrada distinta por momento, en eco al vídeo */
        if (i === 0)      el.style.transform = 'translateY(' + ((1 - a) * 26).toFixed(1) + 'px)';
        else if (i === 1) el.style.transform = 'translateX(' + ((1 - a) * -22).toFixed(1) + 'px)';
        else if (i === 2) el.style.transform = 'scale(' + (0.965 + a * 0.035).toFixed(4) + ')';
        else              el.style.transform = 'translateY(' + ((1 - a) * 18).toFixed(1) + 'px)';
        if (i === 2 || i === 3) {
          el.style.textShadow = '0 2px 30px rgba(0,0,0,.92),0 1px 4px rgba(0,0,0,.85),0 0 ' +
                                (a * 34).toFixed(0) + 'px rgba(233,165,66,' + (a * .3).toFixed(2) + ')';
        }
      }
    }

    /* capa 1 de legibilidad: el scrim se ahonda solo mientras hay texto */
    var sc = Math.max(top, p >= SETTLE_AT ? 1 : 0) * 0.95;
    if (Math.abs(lastWrites.scrim - sc) > 0.008) {
      lastWrites.scrim = sc;
      scrim.style.opacity = sc.toFixed(3);
    }

    /* el reposo */
    var st = p < SETTLE_AT ? 0 : easeIO(clamp((p - SETTLE_AT) / SETTLE_SPAN, 0, 1));
    if (Math.abs(lastWrites.settle - st) > 0.008) {
      lastWrites.settle = st;
      settle.style.opacity = st.toFixed(3);
      settle.style.transform = 'translateY(' + ((1 - st) * 22).toFixed(1) + 'px)';
      settle.setAttribute('data-on', st > 0.6 ? '1' : '0');
      if (cue) cue.style.opacity = String(clamp(1 - p * 7, 0, 1));
    }
  }

  function tick(now) {
    rafId = 0;
    var dt = lastNow ? Math.min((now - lastNow) / 1000, 0.08) : 0.016;
    lastNow = now;

    var p = progress();
    if (videoReady) {
      if (!duration && isFinite(video.duration) && video.duration > 0) duration = video.duration;
      targetT = p * (duration ? duration - 0.04 : 0);

      /* lerp normalizado por delta: la misma suavidad a 60 y a 144 Hz */
      var k = 1 - Math.pow(0.0022, dt);
      shownT += (targetT - shownT) * k;
      if (Math.abs(targetT - shownT) < 0.004) shownT = targetT;

      /* verja: nunca dos búsquedas de fotograma solapadas */
      if (!seekPending && Math.abs(video.currentTime - shownT) > 0.012) {
        seekPending = true;
        try {
          if (video.fastSeek) video.fastSeek(shownT);
          else video.currentTime = shownT;
        } catch (e) { seekPending = false; }
      }
    }

    paint(p);

    /* el bucle descansa cuando ya no queda nada que mover */
    var busy = Math.abs(targetT - shownT) > 0.004 || seekPending;
    if (busy) rafId = requestAnimationFrame(tick);
    else lastNow = 0;
  }

  function wake() {
    if (mode !== 'scrub') return;
    if (!rafId) { lastNow = 0; rafId = requestAnimationFrame(tick); }
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0; lastNow = 0;
  }

  var scrollQueued = false;
  function onScroll() {
    if (mode !== 'scrub') { seam(); return; }
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(function () {
        scrollQueued = false;
        paint(progress());
        wake();
      });
    }
    seam();
  }

  /* ══ 4. LA COSTURA que se dibuja con el scroll ═══════════════ */
  var seamPath = document.getElementById('seamPath');
  var seamLen = 0, seamLast = -1;
  if (seamPath) {
    try { seamLen = seamPath.getTotalLength(); } catch (e) { seamLen = 0; }
    if (seamLen) { seamPath.style.strokeDasharray = seamLen; seamPath.style.strokeDashoffset = seamLen; }
  }
  function seam() {
    if (!seamLen) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var f = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
    if (Math.abs(seamLast - f) < 0.004) return;
    seamLast = f;
    seamPath.style.strokeDashoffset = String(seamLen - seamLen * f);
  }

  /* ══ 5. LA NAVEGACIÓN que se pega ════════════════════════════ */
  var nav = document.getElementById('nav');
  var stuck = -1;
  function onNav() {
    var s = window.scrollY > 40 ? 1 : 0;
    if (s !== stuck) { stuck = s; nav.setAttribute('data-stuck', String(s)); }
  }

  window.addEventListener('scroll', function () { onScroll(); onNav(); }, { passive: true });
  window.addEventListener('resize', function () {
    lastWrites.scrim = -1; lastWrites.settle = -1; lastWrites.bands = [];
    seamLast = -1; applyMode(); onScroll();
  }, { passive: true });

  /* ══ 6. ENTRADAS AL ENTRAR EN PANTALLA ══════════════════════ */
  var reduce = mqReduce.matches;
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));

  /* preparar los trazos SVG para que se dibujen solos */
  [].slice.call(document.querySelectorAll('.draw path, .draw rect')).forEach(function (el) {
    try {
      var L = el.getTotalLength();
      if (L && isFinite(L)) { el.style.setProperty('--len', L); el.classList.add('drawable'); }
    } catch (e) {}
  });

  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        var n = e.target.querySelector('.stat__n');
        if (n) countUp(n);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
    [].slice.call(document.querySelectorAll('.stat__n')).forEach(function (n) {
      n.textContent = n.getAttribute('data-count');
    });
  }

  function countUp(el) {
    var to = parseInt(el.getAttribute('data-count'), 10);
    if (!isFinite(to) || to === 0) { el.textContent = String(to || 0); return; }
    var t0 = 0, DUR = 1100;
    (function step(now) {
      if (!t0) t0 = now;
      var f = clamp((now - t0) / DUR, 0, 1);
      el.textContent = String(Math.round(to * easeIO(f)));
      if (f < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  /* ══ 7. LA CUENTA DE LAS DOS CAPAS (el momento interactivo) ══
     Un rango nativo: funciona con ratón, con el dedo y con el teclado
     sin una línea de código que pelee con el navegador. */
  var calc = document.getElementById('calc');
  if (calc) {
    var cRange = document.getElementById('calcRange');
    var cHrs   = document.getElementById('calcHrs');
    var cBig   = document.getElementById('calcBig');
    var cSub   = document.getElementById('calcSub');
    var cCoat  = document.getElementById('calcCoat');
    var cDark  = document.querySelector('.calc__coat-dark');
    var cPctD  = document.getElementById('calcPctDark');
    var cPctA  = document.getElementById('calcPctAmber');

    /* De las tareas que se repiten, la parte que se puede automatizar sube
       con el volumen: cuanto más repetitiva es la semana, más se lleva la
       máquina. Se queda corto a propósito, para no prometer de más. */
    function share(h) { return 0.55 + Math.min(h, 30) / 30 * 0.20; }

    /* Las frases están calculadas sobre jornadas de 8 h y semanas de 40 h,
       para que el texto y el número digan lo mismo. */
    function line(m) {
      if (m < 10) return 'Casi un día de trabajo al mes que dejas de perder.';
      if (m < 24) return 'Entre uno y tres días de trabajo al mes, de vuelta en tu calendario.';
      if (m < 45) return 'Más de media semana de trabajo al mes que vuelve a ser tuya.';
      if (m < 80) return 'Entre una y dos semanas al mes. Eso ya es media persona contratada.';
      return 'Más de dos semanas al mes. Eso ya es una persona a jornada completa.';
    }

    var cLast = -1;
    function drawCalc() {
      var h = parseInt(cRange.value, 10);
      if (h === cLast) return;
      cLast = h;
      var s = share(h);
      var month = Math.round(h * 4.33 * s);
      cHrs.textContent = h + ' h';
      cBig.textContent = String(month);
      cSub.textContent = line(month);
      var pct = Math.round(s * 100);
      cCoat.style.flexBasis = pct + '%';
      cDark.style.flexBasis = (100 - pct) + '%';
      /* el porcentaje también en palabras: en el móvil la barra se apila
         y la proporción dejaría de leerse solo con el tamaño */
      cPctA.textContent = pct + '%';
      cPctD.textContent = (100 - pct) + '%';
    }
    cRange.addEventListener('input', drawCalc);
    drawCalc();
  }

  /* ══ 8. EL POLVO: partículas a nivel de susurro ═════════════ */
  (function dust() {
    var cv = document.getElementById('dust');
    if (!cv || reduce) { if (cv) cv.style.display = 'none'; return; }
    var ctx = cv.getContext('2d');
    var motes = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function size() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(clamp(W * H / 26000, 18, 60));
      motes = [];
      for (var i = 0; i < n; i++) {
        motes.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 0.5 + Math.random() * 1.5,
          vy: 0.04 + Math.random() * 0.16,
          vx: (Math.random() - 0.5) * 0.06,
          a: 0.06 + Math.random() * 0.2,
          ph: Math.random() * Math.PI * 2
        });
      }
    }
    size();
    window.addEventListener('resize', size, { passive: true });

    var t = 0;
    (function frame() {
      t += 0.01;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.y += m.vy; m.x += m.vx + Math.sin(t + m.ph) * 0.09;
        if (m.y > H + 4) { m.y = -4; m.x = Math.random() * W; }
        if (m.x < -4) m.x = W + 4; else if (m.x > W + 4) m.x = -4;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(233,165,66,' + (m.a * (0.6 + 0.4 * Math.sin(t * 2 + m.ph))).toFixed(3) + ')';
        ctx.fill();
      }
      requestAnimationFrame(frame);
    })();
  })();

  /* ── arranque ─────────────────────────────────────────────── */
  applyMode();
  onNav();
  onScroll();
})();
