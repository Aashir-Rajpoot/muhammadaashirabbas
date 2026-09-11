'use strict';
/* =========================================================================
   AASHIR X — Visitor Portfolio Customizer
   Browser-only (localStorage) visual customization layer.
   Does NOT modify the default design for other visitors — every effect
   here is applied client-side, on top of the existing stylesheet, and is
   fully reversible via "Reset to Default".
   ========================================================================= */
(function () {
  var STORAGE_KEY = 'aashirx-customizer-v1'; // versioned: bump to migrate/reset safely later

  var SECTION_META = [
    { id: 'worlds',  label: 'Digital Worlds (Projects)' },
    { id: 'about',   label: 'About' },
    { id: 'closing', label: 'Closing' }
  ];

  var ACCENTS = [
    { name: 'Gold (Default)', hex: '#c5a46c' },
    { name: 'Verdant',        hex: '#2fa98c' },
    { name: 'Amber',          hex: '#c08a3e' },
    { name: 'Rose',           hex: '#c65a6e' },
    { name: 'Azure',          hex: '#4f8fd6' },
    { name: 'Violet',         hex: '#8a6ed6' }
  ];

  var BACKGROUNDS = [
    { key: 'midnight', name: 'Midnight (Default)', void: '10,8,6',  surface: '20,17,13' },
    { key: 'charcoal', name: 'Charcoal',            void: '14,14,14', surface: '23,23,23' },
    { key: 'navy',     name: 'Deep Navy',           void: '6,9,16',  surface: '14,19,28' },
    { key: 'forest',   name: 'Forest',              void: '7,12,9',  surface: '15,22,17' },
    { key: 'plum',     name: 'Plum',                void: '13,7,14', surface: '23,15,24' }
  ];

  var SPACING = [
    { key: 'compact',     name: 'Compact' },
    { key: 'comfortable', name: 'Comfortable (Default)' },
    { key: 'spacious',    name: 'Spacious' }
  ];

  function defaults() {
    return {
      v: 1,
      accent: null,               // hex string or null = default gold
      bg: null,                   // BACKGROUNDS key or null = default
      spacing: 'comfortable',
      order: SECTION_META.map(function (s) { return s.id; }),
      hidden: {}
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return defaults(); // versioned — mismatched versions reset cleanly
      var d = defaults();
      return {
        v: 1,
        accent: parsed.accent || d.accent,
        bg: parsed.bg || d.bg,
        spacing: parsed.spacing || d.spacing,
        order: Array.isArray(parsed.order) && parsed.order.length === SECTION_META.length ? parsed.order : d.order,
        hidden: parsed.hidden && typeof parsed.hidden === 'object' ? parsed.hidden : d.hidden
      };
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable — customization simply won't persist */ }
  }

  function hexToRgbString(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16);
  }

  function lighten(rgbString, amount) {
    var parts = rgbString.split(',').map(Number);
    var out = parts.map(function (c) { return Math.round(c + (255 - c) * amount); });
    return out.join(',');
  }

  var state = load();
  var root = document.documentElement;

  /* ---------- apply: visual (colors + spacing) ---------- */
  function applyVisual() {
    if (state.accent) {
      var rgb = hexToRgbString(state.accent);
      if (rgb) {
        root.style.setProperty('--gold', rgb);
        root.style.setProperty('--gold-soft', lighten(rgb, 0.22));
      }
    } else {
      root.style.removeProperty('--gold');
      root.style.removeProperty('--gold-soft');
    }

    if (state.bg) {
      var bgPreset = null;
      for (var i = 0; i < BACKGROUNDS.length; i++) if (BACKGROUNDS[i].key === state.bg) bgPreset = BACKGROUNDS[i];
      if (bgPreset && bgPreset.key !== 'midnight') {
        root.style.setProperty('--environment-void', bgPreset.void);
        root.style.setProperty('--surface', bgPreset.surface);
      } else {
        root.style.removeProperty('--environment-void');
        root.style.removeProperty('--surface');
      }
    } else {
      root.style.removeProperty('--environment-void');
      root.style.removeProperty('--surface');
    }

    document.body.setAttribute('data-cz-spacing', state.spacing || 'comfortable');
  }

  /* ---------- apply: section order + visibility ---------- */
  function applyLayout() {
    var main = document.getElementById('main');
    if (!main) return;

    (state.order || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode === main) main.appendChild(el);
    });

    SECTION_META.forEach(function (s) {
      var el = document.getElementById(s.id);
      if (!el) return;
      el.classList.toggle('cz-hidden', !!(state.hidden && state.hidden[s.id]));
    });
  }

  function applyAll() { applyVisual(); applyLayout(); }
  applyAll();

  /* app.js's own ThemeEngine periodically rewrites --environment-void (living
     daily theme + weather refresh + midnight hand-off). Re-assert the
     visitor's chosen background tone afterwards so it stays sticky, without
     touching app.js itself. Cheap no-op when nothing needs correcting. */
  setInterval(function () {
    if (!state.bg) return;
    var preset = null;
    for (var i = 0; i < BACKGROUNDS.length; i++) if (BACKGROUNDS[i].key === state.bg) preset = BACKGROUNDS[i];
    if (!preset || preset.key === 'midnight') return;
    if (root.style.getPropertyValue('--environment-void').trim() !== preset.void) {
      root.style.setProperty('--environment-void', preset.void);
    }
  }, 500);

  /* ---------- UI (built once DOM/content is ready) ---------- */
  function buildUI() {
    if (document.getElementById('cz-root')) return;

    var wrap = document.createElement('div');
    wrap.id = 'cz-root';

    var swatches = ACCENTS.map(function (a) {
      var active = state.accent ? state.accent.toLowerCase() === a.hex.toLowerCase() : a.hex === '#c5a46c';
      return '<button type="button" class="cz-swatch' + (active ? ' active' : '') + '" data-accent="' + a.hex + '" style="--sw:' + a.hex + '" title="' + a.name + '" aria-label="' + a.name + '"></button>';
    }).join('');

    var bgSwatches = BACKGROUNDS.map(function (b) {
      var active = state.bg ? state.bg === b.key : b.key === 'midnight';
      return '<button type="button" class="cz-bg-swatch' + (active ? ' active' : '') + '" data-bg="' + b.key + '" style="--sw:rgb(' + b.surface + ')" title="' + b.name + '" aria-label="' + b.name + '"></button>';
    }).join('');

    var spacingOpts = SPACING.map(function (s) {
      var checked = (state.spacing || 'comfortable') === s.key;
      return '<label class="cz-radio"><input type="radio" name="cz-spacing" value="' + s.key + '"' + (checked ? ' checked' : '') + '><span>' + s.name + '</span></label>';
    }).join('');

    var order = (state.order && state.order.length === SECTION_META.length) ? state.order : SECTION_META.map(function (s) { return s.id; });
    var rows = order.map(function (id, idx) {
      var meta = SECTION_META.filter(function (s) { return s.id === id; })[0];
      if (!meta) return '';
      var hidden = !!(state.hidden && state.hidden[id]);
      return '' +
        '<li class="cz-row" data-id="' + id + '">' +
          '<span class="cz-row-label">' + meta.label + '</span>' +
          '<span class="cz-row-actions">' +
            '<button type="button" class="cz-icon-btn" data-move="up" ' + (idx === 0 ? 'disabled' : '') + ' aria-label="Move up">&#8593;</button>' +
            '<button type="button" class="cz-icon-btn" data-move="down" ' + (idx === order.length - 1 ? 'disabled' : '') + ' aria-label="Move down">&#8595;</button>' +
            '<label class="cz-toggle" aria-label="Show or hide section">' +
              '<input type="checkbox" data-visible' + (hidden ? '' : ' checked') + '>' +
              '<span class="cz-toggle-track"><span class="cz-toggle-thumb"></span></span>' +
            '</label>' +
          '</span>' +
        '</li>';
    }).join('');

    wrap.innerHTML =
      '<button type="button" id="cz-toggle" aria-haspopup="dialog" aria-expanded="false" aria-controls="cz-panel" aria-label="Customize this page">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M21 17h-2"/><circle cx="15" cy="7" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="19" cy="17" r="2"/></svg>' +
      '</button>' +
      '<div id="cz-panel" role="dialog" aria-modal="true" aria-labelledby="cz-title" aria-hidden="true">' +
        '<div class="cz-backdrop" data-cz-close></div>' +
        '<div class="cz-inner">' +
          '<div class="cz-head">' +
            '<span id="cz-title">Customize</span>' +
            '<button type="button" id="cz-close" aria-label="Close customizer">&times;</button>' +
          '</div>' +
          '<div class="cz-body">' +
            '<section class="cz-group">' +
              '<h3>Accent Color</h3>' +
              '<div class="cz-swatches">' + swatches + '<label class="cz-custom-swatch" title="Custom color"><input type="color" id="cz-accent-custom" value="' + (state.accent || '#c5a46c') + '"></label></div>' +
            '</section>' +
            '<section class="cz-group">' +
              '<h3>Background Tone</h3>' +
              '<div class="cz-swatches">' + bgSwatches + '</div>' +
            '</section>' +
            '<section class="cz-group">' +
              '<h3>Section Spacing</h3>' +
              '<div class="cz-radio-row">' + spacingOpts + '</div>' +
            '</section>' +
            '<section class="cz-group">' +
              '<h3>Sections</h3>' +
              '<p class="cz-hint">Reorder or hide sections. Hero and footer are always shown.</p>' +
              '<ul class="cz-rows" id="cz-rows">' + rows + '</ul>' +
            '</section>' +
          '</div>' +
          '<div class="cz-foot">' +
            '<button type="button" id="cz-reset">Reset to Default</button>' +
            '<button type="button" id="cz-save">Save &amp; Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
    bindUI(wrap);
  }

  function bindUI(wrap) {
    var toggleBtn = wrap.querySelector('#cz-toggle');
    var panel = wrap.querySelector('#cz-panel');
    var lastFocused = null;

    function openPanel() {
      lastFocused = document.activeElement;
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      toggleBtn.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKeydown);
      var closeBtn = wrap.querySelector('#cz-close');
      if (closeBtn) closeBtn.focus();
    }
    function closePanel() {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    function onKeydown(e) { if (e.key === 'Escape') closePanel(); }

    toggleBtn.addEventListener('click', openPanel);
    wrap.querySelector('#cz-close').addEventListener('click', closePanel);
    wrap.querySelector('#cz-save').addEventListener('click', closePanel);
    wrap.querySelectorAll('[data-cz-close]').forEach(function (el) { el.addEventListener('click', closePanel); });

    // Accent swatches
    wrap.querySelectorAll('.cz-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.accent = btn.getAttribute('data-accent') === '#c5a46c' ? null : btn.getAttribute('data-accent');
        wrap.querySelectorAll('.cz-swatch').forEach(function (b) { b.classList.toggle('active', b === btn); });
        save(state); applyVisual();
      });
    });
    var customAccent = wrap.querySelector('#cz-accent-custom');
    customAccent.addEventListener('input', function () {
      state.accent = customAccent.value;
      wrap.querySelectorAll('.cz-swatch').forEach(function (b) { b.classList.remove('active'); });
      save(state); applyVisual();
    });

    // Background swatches
    wrap.querySelectorAll('.cz-bg-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-bg');
        state.bg = key === 'midnight' ? null : key;
        wrap.querySelectorAll('.cz-bg-swatch').forEach(function (b) { b.classList.toggle('active', b === btn); });
        save(state); applyVisual();
      });
    });

    // Spacing
    wrap.querySelectorAll('input[name="cz-spacing"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) { state.spacing = radio.value; save(state); applyVisual(); }
      });
    });

    // Section rows: reorder + visibility
    var rowsEl = wrap.querySelector('#cz-rows');
    function refreshRows() {
      var lis = Array.prototype.slice.call(rowsEl.querySelectorAll('.cz-row'));
      lis.forEach(function (li, idx) {
        li.querySelector('[data-move="up"]').disabled = idx === 0;
        li.querySelector('[data-move="down"]').disabled = idx === lis.length - 1;
      });
    }
    rowsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-move]');
      if (!btn) return;
      var li = btn.closest('.cz-row');
      var dir = btn.getAttribute('data-move');
      if (dir === 'up' && li.previousElementSibling) rowsEl.insertBefore(li, li.previousElementSibling);
      else if (dir === 'down' && li.nextElementSibling) rowsEl.insertBefore(li.nextElementSibling, li);
      state.order = Array.prototype.map.call(rowsEl.querySelectorAll('.cz-row'), function (r) { return r.getAttribute('data-id'); });
      save(state); applyLayout(); refreshRows();
    });
    rowsEl.addEventListener('change', function (e) {
      if (!e.target.matches('[data-visible]')) return;
      var li = e.target.closest('.cz-row');
      var id = li.getAttribute('data-id');
      state.hidden = state.hidden || {};
      state.hidden[id] = !e.target.checked;
      save(state); applyLayout();
    });

    // Reset
    wrap.querySelector('#cz-reset').addEventListener('click', function () {
      state = defaults();
      save(state);
      applyAll();
      document.body.removeChild(wrap);
      buildUI();
      var reopened = document.getElementById('cz-toggle');
      if (reopened) reopened.click();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
