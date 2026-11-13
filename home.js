/* ============================================================================
   NearBuy — universal homepage behaviour
   Tilt · scene parallax · reveal · portal preview tabs · portal chooser
   Motion is opt-out (button + system preference) and never required.
   ========================================================================== */
(function () {
  'use strict';

  window.__nbHomeReady = true;
  var root = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var STORE_KEY = 'nearbuy.motion';

  /* ---------- motion preference ---------- */
  function readStored() {
    try { return window.localStorage.getItem(STORE_KEY); } catch (err) { return null; }
  }
  function writeStored(value) {
    try { window.localStorage.setItem(STORE_KEY, value); } catch (err) { /* private mode */ }
  }
  function prefersReduced() {
    return root.getAttribute('data-motion') === 'reduced';
  }
  function applyMotion(reduced, persist) {
    root.setAttribute('data-motion', reduced ? 'reduced' : 'full');
    var btn = document.getElementById('motionToggle');
    var label = document.getElementById('motionLabel');
    if (btn) {
      btn.setAttribute('aria-pressed', reduced ? 'true' : 'false');
      btn.setAttribute('title', reduced ? 'Animations are off — turn them back on' : 'Turn off 3D motion and animations');
    }
    if (label) label.textContent = reduced ? 'Motion reduced' : 'Reduce motion';
    if (persist) writeStored(reduced ? 'reduced' : 'full');
    if (reduced) resetMotionState();
  }
  function resetMotionState() {
    var scene = document.querySelector('.scene');
    if (scene) {
      scene.querySelectorAll('[data-depth]').forEach(function (el) {
        el.style.translate = '';
      });
    }
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
      card.style.removeProperty('--ty');
      card.classList.remove('is-tilting');
    });
  }

  var stored = readStored();
  applyMotion(stored === 'reduced' || (stored !== 'full' && reduceMQ.matches), false);

  var motionBtn = document.getElementById('motionToggle');
  if (motionBtn) {
    motionBtn.addEventListener('click', function () {
      var next = !prefersReduced();
      applyMotion(next, true);
      if (!next) startReveal();
    });
  }
  var onSystemChange = function (event) {
    if (readStored()) return;
    applyMotion(event.matches, false);
  };
  if (typeof reduceMQ.addEventListener === 'function') reduceMQ.addEventListener('change', onSystemChange);
  else if (typeof reduceMQ.addListener === 'function') reduceMQ.addListener(onSystemChange);

  /* ---------- sticky nav ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-solid', window.scrollY > 18);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile menu ---------- */
  var navToggle = document.getElementById('navToggle');
  if (nav && navToggle) {
    var menuUse = navToggle.querySelector('use');
    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (menuUse) menuUse.setAttribute('href', open ? '#i-x' : '#i-menu');
    };
    navToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setMenu(!nav.classList.contains('is-open'));
    });
    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target)) return;
      setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        navToggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 980 && nav.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---------- card tilt ---------- */
  var MAX_TILT = 5.5;
  document.querySelectorAll('[data-tilt]').forEach(function (card) {
    var queued = false;
    card.addEventListener('pointermove', function (event) {
      if (prefersReduced() || !finePointer.matches) return;
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        var rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var px = (event.clientX - rect.left) / rect.width - 0.5;
        var py = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--rx', (-py * MAX_TILT).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (px * MAX_TILT).toFixed(2) + 'deg');
        card.style.setProperty('--ty', '-6px');
        card.classList.add('is-tilting');
      });
    });
    card.addEventListener('pointerleave', function () {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
      card.style.removeProperty('--ty');
      card.classList.remove('is-tilting');
    });
  });

  /* ---------- hero scene parallax ---------- */
  var scene = document.querySelector('.scene');
  if (scene) {
    var layers = Array.prototype.slice.call(scene.querySelectorAll('[data-depth]'));
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0, frame = null;

    var render = function () {
      currentX += (targetX - currentX) * 0.11;
      currentY += (targetY - currentY) * 0.11;
      layers.forEach(function (el) {
        var depth = parseFloat(el.getAttribute('data-depth')) || 0;
        el.style.translate = (-currentX * depth).toFixed(2) + 'px ' + (-currentY * depth).toFixed(2) + 'px';
      });
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = null;
      }
    };
    var start = function () {
      if (frame === null) frame = window.requestAnimationFrame(render);
    };
    scene.addEventListener('pointermove', function (event) {
      if (prefersReduced() || !finePointer.matches) return;
      var rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
      start();
    });
    scene.addEventListener('pointerleave', function () {
      targetX = 0;
      targetY = 0;
      start();
    });
  }

  /* ---------- scroll reveal ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  var observer = null;
  function startReveal() {
    if (!('IntersectionObserver' in window) || prefersReduced()) {
      revealEls.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    revealEls.forEach(function (el) {
      if (el.classList.contains('is-in')) return;
      observer.observe(el);
    });
  }
  startReveal();

  /* ---------- portal preview tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'));

  function activateTab(name, shouldScroll) {
    if (!name) return;
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-tab') === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-panel') === name;
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    if (shouldScroll) {
      var section = document.getElementById('previews');
      if (section) {
        section.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { activateTab(tab.getAttribute('data-tab'), false); });
    tab.addEventListener('keydown', function (event) {
      var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (keys.indexOf(event.key) === -1) return;
      event.preventDefault();
      var next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      activateTab(tabs[next].getAttribute('data-tab'), false);
      tabs[next].focus();
    });
  });

  document.querySelectorAll('[data-tab-jump]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      activateTab(link.getAttribute('data-tab-jump'), true);
    });
  });

  /* ---------- portal chooser dialog ---------- */
  var chooser = document.getElementById('chooser');
  var lastFocus = null;

  function focusables() {
    if (!chooser) return [];
    return Array.prototype.slice.call(
      chooser.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
  }
  function openChooser() {
    if (!chooser) return;
    lastFocus = document.activeElement;
    chooser.hidden = false;
    document.body.style.overflow = 'hidden';
    var close = chooser.querySelector('.chooser__close');
    var list = focusables();
    (close || list[0] || chooser).focus();
    document.addEventListener('keydown', onChooserKey);
  }
  function closeChooser() {
    if (!chooser || chooser.hidden) return;
    chooser.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onChooserKey);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  function onChooserKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeChooser();
      return;
    }
    if (event.key !== 'Tab') return;
    var list = focusables();
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest ? event.target.closest('[data-open-chooser]') : null;
    if (opener) {
      event.preventDefault();
      openChooser();
      return;
    }
    var closer = event.target.closest ? event.target.closest('[data-close-chooser]') : null;
    if (closer) {
      event.preventDefault();
      closeChooser();
    }
  });
  if (chooser) {
    chooser.addEventListener('click', function (event) {
      if (event.target === chooser) closeChooser();
    });
    chooser.querySelectorAll('a[href]').forEach(function (link) {
      link.addEventListener('click', function () { closeChooser(); });
    });
  }

  /* ---------- footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- anchor offset for in-page links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.hasAttribute('data-tab-jump')) return;
    var id = link.getAttribute('href');
    if (!id || id === '#') return;
    var target = document.querySelector(id);
    if (!target || target.id === 'chooser') return;
    link.addEventListener('click', function (event) {
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', id);
      }
    });
  });

  /* ---------- graceful image fallback ---------- */
  document.querySelectorAll('.scene__art img, .portal-card__art img, .partner-card__art img').forEach(function (img) {
    img.addEventListener('error', function () {
      var holder = img.parentElement;
      if (holder) holder.classList.add('is-missing-art');
    });
  });
})();
