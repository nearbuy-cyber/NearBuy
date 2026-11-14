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

  /* ---------- help & support enquiry form ---------- */
  (function initSupport() {
    var form = document.getElementById('enquiryForm');
    if (!form) return;

    var STORE_KEY = 'nearbuy.one.v2';
    var TOPICS = ['Account Creation', 'Fee Structure', 'What Can I Sell?', 'Account Management', 'How to Run Ads?', 'Shipping & Delivery', 'Others'];
    var nameEl = document.getElementById('enqName');
    var contactEl = document.getElementById('enqContact');
    var topicEl = document.getElementById('enqTopic');
    var messageEl = document.getElementById('enqMessage');
    var counter = document.getElementById('enqMessageCount');
    var summary = document.getElementById('enquirySummary');
    var done = document.getElementById('enquiryDone');
    var doneRef = document.getElementById('enquiryRef');
    var again = document.getElementById('enquiryAgain');
    var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    function readStore() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; }
      catch (error) { return {}; }
    }
    function writeStore(value) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(value)); return true; }
      catch (error) { return false; }
    }
    function stamp() {
      try {
        return new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
      } catch (error) { return 'Just now'; }
    }
    function phoneDigits(value) {
      var digits = String(value).replace(/\D/g, '');
      if (digits.length === 12 && digits.slice(0, 2) === '91') digits = digits.slice(2);
      if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
      return digits;
    }
    function validContact(value) {
      var text = String(value || '').trim();
      if (!text) return false;
      if (text.indexOf('@') > -1) return EMAIL.test(text);
      return /^[6-9]\d{9}$/.test(phoneDigits(text));
    }
    function nextId(store) {
      var list = Array.isArray(store.enquiries) ? store.enquiries : [];
      var n = 1042 + list.length;
      var id = 'ENQ-' + n;
      while (list.some(function (item) { return item.id === id; })) { n += 1; id = 'ENQ-' + n; }
      return id;
    }
    function saveEnquiry(entry) {
      var store = readStore();
      if (!Array.isArray(store.enquiries)) store.enquiries = [];
      store.enquiries.unshift(entry);
      if (Array.isArray(store.audit)) {
        store.audit.unshift({
          id: 'AUD-' + Date.now(),
          action: 'Homepage enquiry',
          detail: entry.topic + ' · ' + entry.name,
          actor: 'Website visitor',
          time: 'Just now'
        });
      }
      return writeStore(store);
    }

    var fields = [
      { el: nameEl, test: function (v) { return String(v).trim().length >= 2; }, msg: 'Please enter your full name (at least 2 characters).' },
      { el: contactEl, test: validContact, msg: 'Enter a valid email address or a 10-digit mobile number.' },
      { el: topicEl, test: function (v) { return TOPICS.indexOf(v) > -1; }, msg: 'Choose the topic that fits best.' },
      { el: messageEl, test: function (v) { return String(v).trim().length >= 10; }, msg: 'Add a little more detail — at least 10 characters.' }
    ];

    function wrapOf(field) {
      var wrap = field.el.closest('.sfield');
      return wrap || field.el.parentElement;
    }
    function errorOf(field) {
      var wrap = wrapOf(field);
      return wrap ? wrap.querySelector('.sfield__error') : null;
    }
    function setError(field, message) {
      var wrap = wrapOf(field);
      var target = errorOf(field);
      if (wrap) wrap.classList.toggle('is-invalid', !!message);
      field.el.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (target) {
        target.textContent = message || '';
        target.hidden = !message;
      }
    }
    function clearSummary() {
      if (!summary) return;
      summary.hidden = true;
      summary.textContent = '';
    }

    fields.forEach(function (field) {
      var eventName = field.el.tagName === 'SELECT' ? 'change' : 'input';
      field.el.addEventListener(eventName, function () {
        if (field.test(field.el.value)) setError(field, '');
        if (summary && !summary.hidden) clearSummary();
      });
    });

    if (messageEl && counter) {
      var syncCount = function () { counter.textContent = messageEl.value.length + ' / 600'; };
      messageEl.addEventListener('input', syncCount);
      syncCount();
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var invalid = [];
      fields.forEach(function (field) {
        var ok = field.test(field.el.value);
        setError(field, ok ? '' : field.msg);
        if (!ok) invalid.push(field);
      });

      if (invalid.length) {
        if (summary) {
          summary.textContent = invalid.length === 1
            ? 'One field needs your attention before this can be sent.'
            : invalid.length + ' fields need your attention before this can be sent.';
          summary.hidden = false;
        }
        invalid[0].el.focus();
        return;
      }

      clearSummary();
      var entry = {
        id: nextId(readStore()),
        name: String(nameEl.value).trim().replace(/\s+/g, ' '),
        contact: String(contactEl.value).trim(),
        topic: topicEl.value,
        message: String(messageEl.value).trim(),
        status: 'New',
        source: 'Homepage',
        at: stamp()
      };
      var saved = saveEnquiry(entry);

      if (doneRef) doneRef.textContent = entry.id + (saved ? '' : ' · not saved (storage blocked)');
      form.hidden = true;
      if (done) {
        done.hidden = false;
        if (done.scrollIntoView) done.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
        done.focus({ preventScroll: true });
      }
      window.__nbLastEnquiry = entry;
    });

    if (again) {
      again.addEventListener('click', function () {
        form.hidden = false;
        form.reset();
        fields.forEach(function (field) { setError(field, ''); });
        clearSummary();
        if (counter) counter.textContent = '0 / 600';
        if (done) done.hidden = true;
        if (nameEl) nameEl.focus();
      });
    }

    window.__nbEnquiries = function () {
      var store = readStore();
      return Array.isArray(store.enquiries) ? store.enquiries : [];
    };
    window.__nbSupportReady = true;
  })();

  /* ---------- graceful image fallback ---------- */
  document.querySelectorAll('.scene__art img, .portal-card__art img, .partner-card__art img').forEach(function (img) {
    img.addEventListener('error', function () {
      var holder = img.parentElement;
      if (holder) holder.classList.add('is-missing-art');
    });
  });
})();
