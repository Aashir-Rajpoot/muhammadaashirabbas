/* =========================================================================
   AASHIR X — REALITY ENGINE
   Adds two self-contained, reversible UI modes on top of the existing
   portfolio without touching any existing markup, styles or scripts:

     1) BREAK PHYSICS — a 20s-max draggable gravity simulation of the
        page's existing cards/buttons. Auto-restores; RESET UNIVERSE
        restores immediately on demand.
     2) ROTATE WORLD — a cinematic 3D flip revealing an alternate
        "back of the world" panel with quick navigation.

   Both modes fully tear down after use: no leftover listeners, timers,
   inline styles, or DOM nodes remain once a mode ends.
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var isNarrow = window.innerWidth <= 760;

  /* -----------------------------------------------------------------------
     Shared scroll lock (stack-safe: either mode can request/release it)
     ----------------------------------------------------------------------- */
  var scrollLockCount = 0;
  var lockedScrollY = 0;
  function lockScroll() {
    if (scrollLockCount === 0) {
      lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = (-lockedScrollY) + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.documentElement.classList.add('reality-scroll-lock');
    }
    scrollLockCount++;
  }
  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.documentElement.classList.remove('reality-scroll-lock');
      window.scrollTo(0, lockedScrollY);
    }
  }

  function isVisibleInViewport(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.closest('#reality-controls')) return false;
    return true;
  }

  /* =========================================================================
     BREAK PHYSICS
     ========================================================================= */
  var GravityBroke = (function () {
    var active = false;
    var objects = [];
    var rafId = null;
    var lastT = 0;
    var autoTimer = null;

    var GRAVITY = reduceMotion ? 420 : 1500;   // px/s^2
    var RESTITUTION = 0.55;
    var FRICTION = 0.985;
    var MAX_OBJECTS = isNarrow ? 12 : 24;
    var DURATION_MS = 20000;

    var TARGET_SELECTOR = [
      '#main .index-row',
      '#main .about-cta-btn',
      '#main .connect-link',
      '#main .os-id-card',
      '.os-panel',
      '#main button',
      '#shuffle-btn',
      '.project-card',
      '.cert-card-filled'
    ].join(',');

    function collectTargets() {
      var found;
      try { found = Array.prototype.slice.call(document.querySelectorAll(TARGET_SELECTOR)); }
      catch (e) { found = []; }
      var picked = [];
      for (var i = 0; i < found.length; i++) {
        var el = found[i];
        if (el.id === 'gb-toggle-btn' || el.id === 'rw-toggle-btn') continue;
        if (picked.indexOf(el) !== -1) continue;
        if (!isVisibleInViewport(el)) continue;
        picked.push(el);
        if (picked.length >= MAX_OBJECTS) break;
      }
      return picked;
    }

    function buildBody(el) {
      var rect = el.getBoundingClientRect();
      var b = {
        el: el,
        w: rect.width, h: rect.height,
        x: rect.left, y: rect.top,
        vx: (Math.random() - 0.5) * 80,
        vy: -Math.random() * 100,
        angle: 0,
        angVel: (Math.random() - 0.5) * 50,
        mass: Math.max(0.6, (rect.width * rect.height) / 26000),
        held: false,
        prevStyle: el.getAttribute('style')
      };
      el.classList.add('gb-object');
      el.style.position = 'fixed';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
      el.style.margin = '0';
      el.style.zIndex = '860000';
      el.style.willChange = 'transform';
      renderBody(b);
      return b;
    }

    function renderBody(b) {
      b.el.style.transform = 'translate3d(' + b.x + 'px,' + b.y + 'px,0) rotate(' + b.angle + 'deg)';
    }

    function restoreBody(b) {
      var el = b.el;
      el.classList.remove('gb-object', 'gb-held');
      if (b.prevStyle === null) el.removeAttribute('style');
      else el.setAttribute('style', b.prevStyle);
    }

    function step(now) {
      if (!active) return;
      var dt = lastT ? Math.min(0.032, (now - lastT) / 1000) : 0.016;
      lastT = now;
      var vw = window.innerWidth, vh = window.innerHeight;
      var i, b;

      for (i = 0; i < objects.length; i++) {
        b = objects[i];
        if (b.held) continue;
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += b.angVel * dt;

        if (b.x < 0) { b.x = 0; b.vx *= -RESTITUTION; b.angVel *= 0.7; }
        if (b.x + b.w > vw) { b.x = vw - b.w; b.vx *= -RESTITUTION; b.angVel *= 0.7; }
        if (b.y < 0) { b.y = 0; b.vy *= -RESTITUTION; }
        if (b.y + b.h > vh) {
          b.y = vh - b.h;
          b.vy *= -RESTITUTION;
          b.vx *= FRICTION;
          b.angVel *= 0.82;
          if (Math.abs(b.vy) < 40) b.vy = 0;
        }
        b.vx *= FRICTION;
        b.angVel *= 0.995;
      }

      for (i = 0; i < objects.length; i++) {
        for (var j = i + 1; j < objects.length; j++) {
          var a = objects[i], c = objects[j];
          var ax = a.x + a.w / 2, ay = a.y + a.h / 2;
          var cx = c.x + c.w / 2, cy = c.y + c.h / 2;
          var ar = Math.min(a.w, a.h) / 2, cr = Math.min(c.w, c.h) / 2;
          var dx = cx - ax, dy = cy - ay;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          var minDist = ar + cr;
          if (dist < minDist) {
            var overlap = (minDist - dist) / 2;
            var nx = dx / dist, ny = dy / dist;
            if (!a.held) { a.x -= nx * overlap; a.y -= ny * overlap; }
            if (!c.held) { c.x += nx * overlap; c.y += ny * overlap; }
            var rvx = c.vx - a.vx, rvy = c.vy - a.vy;
            var rel = rvx * nx + rvy * ny;
            if (rel < 0) {
              var imp = -(1 + RESTITUTION) * rel / (1 / a.mass + 1 / c.mass);
              var ix = imp * nx, iy = imp * ny;
              if (!a.held) { a.vx -= ix / a.mass; a.vy -= iy / a.mass; a.angVel += (Math.random() - 0.5) * 18; }
              if (!c.held) { c.vx += ix / c.mass; c.vy += iy / c.mass; c.angVel += (Math.random() - 0.5) * 18; }
            }
          }
        }
      }

      for (i = 0; i < objects.length; i++) renderBody(objects[i]);
      rafId = requestAnimationFrame(step);
    }

    /* ---- dragging (mouse + touch via Pointer Events) ---- */
    var dragTarget = null, dragOffX = 0, dragOffY = 0, lastPX = 0, lastPY = 0, lastPT = 0;

    function findBody(el) {
      for (var i = 0; i < objects.length; i++) if (objects[i].el === el) return objects[i];
      return null;
    }
    function onPointerDown(e) {
      if (!active) return;
      var target = e.target.closest ? e.target.closest('.gb-object') : null;
      if (!target) return;
      var b = findBody(target);
      if (!b) return;
      b.held = true;
      dragTarget = b;
      target.classList.add('gb-held');
      dragOffX = e.clientX - b.x;
      dragOffY = e.clientY - b.y;
      lastPX = e.clientX; lastPY = e.clientY; lastPT = performance.now();
      b.vx = 0; b.vy = 0;
      try { target.setPointerCapture && target.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragTarget) return;
      var now = performance.now();
      var dt = Math.max(1, now - lastPT);
      dragTarget.vx = (e.clientX - lastPX) / dt * 1000;
      dragTarget.vy = (e.clientY - lastPY) / dt * 1000;
      dragTarget.x = e.clientX - dragOffX;
      dragTarget.y = e.clientY - dragOffY;
      dragTarget.x = Math.max(-dragTarget.w * 0.4, Math.min(window.innerWidth - dragTarget.w * 0.6, dragTarget.x));
      dragTarget.y = Math.max(-dragTarget.h * 0.4, Math.min(window.innerHeight - dragTarget.h * 0.6, dragTarget.y));
      lastPX = e.clientX; lastPY = e.clientY; lastPT = now;
      e.preventDefault();
    }
    function onPointerUp() {
      if (!dragTarget) return;
      dragTarget.held = false;
      dragTarget.el.classList.remove('gb-held');
      dragTarget.vx = Math.max(-1400, Math.min(1400, dragTarget.vx));
      dragTarget.vy = Math.max(-1400, Math.min(1400, dragTarget.vy));
      dragTarget = null;
    }
    function suppressClicks(e) {
      if (active && e.target.closest && e.target.closest('.gb-object')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function start() {
      if (active) return true;
      if (RotateWorld.isActive()) RotateWorld.deactivate(true);
      objects = collectTargets().map(buildBody);
      if (!objects.length) return false;

      active = true;
      lastT = 0;
      document.body.classList.add('gb-active');
      lockScroll();
      document.addEventListener('pointerdown', onPointerDown, { passive: false });
      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp, { passive: true });
      document.addEventListener('pointercancel', onPointerUp, { passive: true });
      document.addEventListener('click', suppressClicks, true);
      rafId = requestAnimationFrame(step);
      autoTimer = setTimeout(stop, DURATION_MS);
      return true;
    }

    function stop() {
      if (!active) return;
      active = false;
      clearTimeout(autoTimer); autoTimer = null;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      document.removeEventListener('pointerdown', onPointerDown, { passive: false });
      document.removeEventListener('pointermove', onPointerMove, { passive: false });
      document.removeEventListener('pointerup', onPointerUp, { passive: true });
      document.removeEventListener('pointercancel', onPointerUp, { passive: true });
      document.removeEventListener('click', suppressClicks, true);
      objects.forEach(restoreBody);
      objects = [];
      document.body.classList.remove('gb-active');
      unlockScroll();
    }

    return {
      isActive: function () { return active; },
      start: start,
      stop: stop,
      duration: DURATION_MS
    };
  })();

  /* =========================================================================
     ROTATE WORLD
     ========================================================================= */
  var RotateWorld = (function () {
    var active = false;
    var wrap = null;
    var originalScrollY = 0;
    var FLIP_MS = reduceMotion ? 50 : 1150;

    function buildBackFace() {
      var back = document.createElement('div');
      back.className = 'rw-face rw-back';
      back.innerHTML =
        '<div class="rw-back-inner">' +
          '<span class="rw-back-eyebrow">Alternate View</span>' +
          '<h2 class="rw-back-title">AASHIR <em>X</em></h2>' +
          '<p class="rw-back-line">You are looking at the reverse side of this world.</p>' +
          '<nav class="rw-back-nav" aria-label="Quick navigation">' +
            '<a href="#top" data-rw-nav>Home</a>' +
            '<a href="#worlds" data-rw-nav>Worlds</a>' +
            '<a href="#about" data-rw-nav>About</a>' +
            '<a href="#connect" data-rw-nav>Connect</a>' +
          '</nav>' +
          '<p class="rw-back-hint">Use RETURN WORLD to come back to the front.</p>' +
        '</div>';
      back.addEventListener('click', onBackClick);
      return back;
    }

    function onBackClick(e) {
      var a = e.target.closest ? e.target.closest('[data-rw-nav]') : null;
      if (!a) return;
      e.preventDefault();
      deactivate(false, a.getAttribute('href'));
    }

    function activate() {
      if (active) return;
      if (GravityBroke.isActive()) GravityBroke.stop();

      originalScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      window.scrollTo(0, 0);

      var kids = Array.prototype.slice.call(document.body.children);
      var front = document.createElement('div');
      front.className = 'rw-face rw-front';
      kids.forEach(function (node) {
        if (node.id === 'reality-controls') return;
        front.appendChild(node);
      });

      wrap = document.createElement('div');
      wrap.id = 'rw-wrap';
      wrap.appendChild(front);
      wrap.appendChild(buildBackFace());
      document.body.appendChild(wrap);

      document.documentElement.classList.add('rw-active');
      lockScroll();
      active = true;

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (wrap) wrap.classList.add('rw-flipped');
        });
      });
    }

    function deactivate(immediate, scrollToHash) {
      if (!active || !wrap) return;
      active = false;

      function finish() {
        var front = wrap ? wrap.querySelector('.rw-front') : null;
        if (front) {
          Array.prototype.slice.call(front.childNodes).forEach(function (node) {
            document.body.insertBefore(node, wrap);
          });
        }
        if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
        wrap = null;
        document.documentElement.classList.remove('rw-active');
        unlockScroll();
        window.scrollTo(0, originalScrollY);
        if (scrollToHash) {
          var target;
          try { target = document.querySelector(scrollToHash); } catch (e) { target = null; }
          if (target) {
            setTimeout(function () {
              target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
            }, 60);
          }
        }
      }

      if (immediate || reduceMotion) {
        finish();
      } else {
        wrap.classList.remove('rw-flipped');
        setTimeout(finish, FLIP_MS);
      }
    }

    return {
      isActive: function () { return active; },
      activate: activate,
      deactivate: deactivate
    };
  })();

  /* =========================================================================
     CONTROLS
     ========================================================================= */
  function buildControls() {
    var dock = document.createElement('div');
    dock.id = 'reality-controls';

    var rwBtn = document.createElement('button');
    rwBtn.type = 'button';
    rwBtn.id = 'rw-toggle-btn';
    rwBtn.className = 'reality-btn';
    rwBtn.textContent = 'ROTATE WORLD \u21BB';
    rwBtn.setAttribute('aria-label', 'Rotate the portfolio into a 3D world view');

    var gbBtn = document.createElement('button');
    gbBtn.type = 'button';
    gbBtn.id = 'gb-toggle-btn';
    gbBtn.className = 'reality-btn';
    gbBtn.textContent = '\u26A1 BREAK PHYSICS';
    gbBtn.setAttribute('aria-label', 'Turn the portfolio into a 20 second physics playground');

    dock.appendChild(rwBtn);
    dock.appendChild(gbBtn);
    document.body.appendChild(dock);

    function updateRwLabel() {
      if (RotateWorld.isActive()) {
        rwBtn.textContent = 'RETURN WORLD \u21BA';
        rwBtn.classList.add('is-active');
      } else {
        rwBtn.textContent = 'ROTATE WORLD \u21BB';
        rwBtn.classList.remove('is-active');
      }
    }
    rwBtn.addEventListener('click', function () {
      if (RotateWorld.isActive()) RotateWorld.deactivate(false);
      else RotateWorld.activate();
      updateRwLabel();
    });

    var gbInterval = null;
    function updateGbLabel(secondsLeft) {
      if (GravityBroke.isActive()) {
        gbBtn.textContent = '\u23FB RESET UNIVERSE' + (typeof secondsLeft === 'number' ? ' \u00B7 ' + secondsLeft + 's' : '');
        gbBtn.classList.add('is-active');
      } else {
        gbBtn.textContent = '\u26A1 BREAK PHYSICS';
        gbBtn.classList.remove('is-active');
      }
    }
    gbBtn.addEventListener('click', function () {
      if (GravityBroke.isActive()) {
        GravityBroke.stop();
        clearInterval(gbInterval); gbInterval = null;
        updateGbLabel();
        return;
      }
      var ok = GravityBroke.start();
      if (!ok) return;
      var left = Math.round(GravityBroke.duration / 1000);
      updateGbLabel(left);
      gbInterval = setInterval(function () {
        left -= 1;
        if (left <= 0 || !GravityBroke.isActive()) {
          clearInterval(gbInterval); gbInterval = null;
          updateGbLabel();
          return;
        }
        updateGbLabel(left);
      }, 1000);
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(buildControls);
})();
