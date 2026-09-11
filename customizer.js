'use strict';
/* =========================================================================
   AASHIR X — Visitor Portfolio Customizer
   Browser-only (localStorage) visual customization layer.
   Nothing here is sent to a server; every effect is applied client-side on
   top of the existing stylesheet/markup and is fully reversible via
   "Reset to Default". Other visitors always see the untouched original.
   ========================================================================= */
(function () {
  var STORAGE_KEY = 'aashirx-customizer-v1'; // versioned: bump to migrate/reset safely later
  var DEFAULT_NAME = 'Muhammad Aashir Abbas';
  var DEFAULT_AVATAR_SRC = './aashir-profile.jpeg';
  var AVATAR_MAX_DIM = 900;
  var AVATAR_QUALITY = 0.85;

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

  var CURSORS = [
    { key: 'default',   name: 'Default' },
    { key: 'dot',        name: 'Minimal Dot' },
    { key: 'circle',     name: 'Circle' },
    { key: 'ring',        name: 'Ring' },
    { key: 'crosshair',  name: 'Crosshair' },
    { key: 'glow',        name: 'Glow' },
    { key: 'pointer',     name: 'Pointer (System)' },
    { key: 'comet',       name: 'Comet (Creative)' }
  ];

  function defaults() {
    return {
      v: 1,
      accent: null,               // hex string or null = default gold
      bg: null,                   // BACKGROUNDS key or null = default
      spacing: 'comfortable',
      order: SECTION_META.map(function (s) { return s.id; }),
      hidden: {},
      cursor: 'default',
      name: '',                   // '' = default owner name
      avatar: ''                  // '' = default portrait, else a compressed data URL
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
        hidden: parsed.hidden && typeof parsed.hidden === 'object' ? parsed.hidden : d.hidden,
        cursor: parsed.cursor || d.cursor,
        name: typeof parsed.name === 'string' ? parsed.name : d.name,
        avatar: typeof parsed.avatar === 'string' ? parsed.avatar : d.avatar
      };
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false; // e.g. quota exceeded — customization just won't persist
    }
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

  /* ---------- apply: visual (colors + spacing + cursor) ---------- */
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
    document.body.setAttribute('data-cz-cursor', state.cursor || 'default');
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

  /* ---------- apply: personalization (name + avatar) ---------- */
  var IDENTITY_NAME_IDS = ['cz-name-hero', 'cz-name-closing', 'cz-name-footer'];
  function applyIdentity() {
    var displayName = state.name && state.name.trim() ? state.name.trim() : DEFAULT_NAME;
    IDENTITY_NAME_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = displayName;
    });
    var img = document.getElementById('portrait-img');
    if (img) img.src = state.avatar ? state.avatar : DEFAULT_AVATAR_SRC;
  }

  function applyAll() { applyVisual(); applyLayout(); applyIdentity(); }
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

  /* ---------- image compression helper (canvas, client-side only) ---------- */
  function readAndCompressImage(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('not an image')); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          try { resolve(canvas.toDataURL('image/jpeg', quality)); }
          catch (err) { reject(err); }
        };
        img.onerror = function () { reject(new Error('could not read image')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('could not read file')); };
      reader.readAsDataURL(file);
    });
  }

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

    var cursorOpts = CURSORS.map(function (c) {
      var active = (state.cursor || 'default') === c.key;
      return '<button type="button" class="cz-cursor-opt' + (active ? ' active' : '') + '" data-cursor="' + c.key + '"><span class="cz-cursor-dotpreview" data-preview="' + c.key + '"></span>' + c.name + '</button>';
    }).join('');

    var order = (state.order && state.order.length === SECTION_META.length) ? state.order : SECTION_META.map(function (s) { return s.id; });
    var rows = order.map(function (id, idx) {
      var meta = SECTION_META.filter(function (s) { return s.id === id; })[0];
      if (!meta) return '';
      var hidden = !!(state.hidden && state.hidden[id]);
      return '' +
        '<li class="cz-row" draggable="true" data-id="' + id + '">' +
          '<span class="cz-drag-handle" aria-hidden="true">&#8942;&#8942;</span>' +
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
          '<div class="cz-tabs" role="tablist">' +
            '<button type="button" class="cz-tab active" data-tab="design" role="tab" aria-selected="true">Design</button>' +
            '<button type="button" class="cz-tab" data-tab="layout" role="tab" aria-selected="false">Layout</button>' +
            '<button type="button" class="cz-tab" data-tab="cursor" role="tab" aria-selected="false">Cursor</button>' +
            '<button type="button" class="cz-tab" data-tab="mine" role="tab" aria-selected="false">Make It Mine</button>' +
          '</div>' +
          '<div class="cz-body">' +

            '<div class="cz-panel-tab active" data-tab-panel="design">' +
              '<section class="cz-group">' +
                '<h3>Accent Color</h3>' +
                '<div class="cz-swatches">' + swatches + '<label class="cz-custom-swatch" title="Custom color"><input type="color" id="cz-accent-custom" value="' + (state.accent || '#c5a46c') + '"></label></div>' +
              '</section>' +
              '<section class="cz-group">' +
                '<h3>Background Tone</h3>' +
                '<div class="cz-swatches">' + bgSwatches + '</div>' +
              '</section>' +
            '</div>' +

            '<div class="cz-panel-tab" data-tab-panel="layout">' +
              '<section class="cz-group">' +
                '<h3>Section Spacing</h3>' +
                '<div class="cz-radio-row">' + spacingOpts + '</div>' +
              '</section>' +
              '<section class="cz-group">' +
                '<h3>Sections</h3>' +
                '<p class="cz-hint">Drag to reorder (or use the arrows), toggle to show/hide. Hero and footer are always shown.</p>' +
                '<ul class="cz-rows" id="cz-rows">' + rows + '</ul>' +
              '</section>' +
            '</div>' +

            '<div class="cz-panel-tab" data-tab-panel="cursor">' +
              '<section class="cz-group">' +
                '<h3>Cursor Style</h3>' +
                '<p class="cz-hint">Custom cursors only apply on devices with a mouse/trackpad; touchscreens keep the native cursor automatically.</p>' +
                '<div class="cz-cursor-grid">' + cursorOpts + '</div>' +
              '</section>' +
            '</div>' +

            '<div class="cz-panel-tab" data-tab-panel="mine">' +
              '<section class="cz-group">' +
                '<h3>Make It Mine</h3>' +
                '<p class="cz-hint">Personalize the name and profile photo shown across the page — only visible in your browser.</p>' +
                '<label class="cz-field-label" for="cz-name-input">Your Name</label>' +
                '<input type="text" id="cz-name-input" class="cz-text-input" placeholder="Enter your name" value="' + (state.name || '').replace(/"/g, '&quot;') + '" maxlength="60">' +
                '<div class="cz-avatar-row">' +
                  '<img id="cz-avatar-preview" class="cz-avatar-preview" src="' + (state.avatar || DEFAULT_AVATAR_SRC) + '" alt="">' +
                  '<div class="cz-avatar-controls">' +
                    '<label class="cz-upload-btn" for="cz-avatar-input">Upload Profile Picture</label>' +
                    '<input type="file" id="cz-avatar-input" accept="image/*" hidden>' +
                    '<button type="button" id="cz-avatar-remove" class="cz-link-btn"' + (state.avatar ? '' : ' disabled') + '>Remove photo</button>' +
                  '</div>' +
                '</div>' +
                '<p class="cz-avatar-status" id="cz-avatar-status" role="status"></p>' +
              '</section>' +
            '</div>' +

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

    // Tabs
    wrap.querySelectorAll('.cz-tab').forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        var target = tabBtn.getAttribute('data-tab');
        wrap.querySelectorAll('.cz-tab').forEach(function (b) {
          var on = b === tabBtn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        wrap.querySelectorAll('.cz-panel-tab').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-tab-panel') === target);
        });
      });
    });

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

    // Cursor style
    wrap.querySelectorAll('.cz-cursor-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.cursor = btn.getAttribute('data-cursor');
        wrap.querySelectorAll('.cz-cursor-opt').forEach(function (b) { b.classList.toggle('active', b === btn); });
        save(state); applyVisual();
      });
    });

    // Section rows: drag-and-drop + up/down + visibility
    var rowsEl = wrap.querySelector('#cz-rows');
    function persistOrderFromDOM() {
      state.order = Array.prototype.map.call(rowsEl.querySelectorAll('.cz-row'), function (r) { return r.getAttribute('data-id'); });
      save(state); applyLayout();
    }
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
      persistOrderFromDOM(); refreshRows();
    });
    rowsEl.addEventListener('change', function (e) {
      if (!e.target.matches('[data-visible]')) return;
      var li = e.target.closest('.cz-row');
      var id = li.getAttribute('data-id');
      state.hidden = state.hidden || {};
      state.hidden[id] = !e.target.checked;
      save(state); applyLayout();
    });

    // Native HTML5 drag-and-drop (desktop). Up/down buttons remain the
    // touch/keyboard-friendly fallback for mobile.
    var dragEl = null;
    rowsEl.addEventListener('dragstart', function (e) {
      var li = e.target.closest('.cz-row');
      if (!li) return;
      dragEl = li;
      li.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', li.getAttribute('data-id')); } catch (err) { /* Firefox needs this set, ignore failures elsewhere */ }
      }
    });
    rowsEl.addEventListener('dragover', function (e) {
      if (!dragEl) return;
      e.preventDefault();
      var li = e.target.closest('.cz-row');
      if (!li || li === dragEl) return;
      var rect = li.getBoundingClientRect();
      var before = (e.clientY - rect.top) < rect.height / 2;
      rowsEl.insertBefore(dragEl, before ? li : li.nextSibling);
    });
    rowsEl.addEventListener('drop', function (e) { if (dragEl) e.preventDefault(); });
    rowsEl.addEventListener('dragend', function () {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      dragEl = null;
      persistOrderFromDOM(); refreshRows();
    });

    // Make It Mine — name
    var nameInput = wrap.querySelector('#cz-name-input');
    nameInput.addEventListener('input', function () {
      state.name = nameInput.value;
      save(state); applyIdentity();
    });

    // Make It Mine — avatar upload
    var avatarInput = wrap.querySelector('#cz-avatar-input');
    var avatarPreview = wrap.querySelector('#cz-avatar-preview');
    var avatarRemove = wrap.querySelector('#cz-avatar-remove');
    var avatarStatus = wrap.querySelector('#cz-avatar-status');
    avatarInput.addEventListener('change', function () {
      var file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      avatarStatus.textContent = 'Processing photo…';
      readAndCompressImage(file, AVATAR_MAX_DIM, AVATAR_QUALITY).then(function (dataUrl) {
        state.avatar = dataUrl;
        var ok = save(state);
        applyIdentity();
        avatarPreview.src = dataUrl;
        avatarRemove.disabled = false;
        avatarStatus.textContent = ok ? 'Photo updated.' : 'Photo applied, but could not be saved (storage full) — it will reset on reload.';
      }).catch(function () {
        avatarStatus.textContent = 'Could not read that image — please try a different file.';
      });
      avatarInput.value = '';
    });
    avatarRemove.addEventListener('click', function () {
      state.avatar = '';
      save(state); applyIdentity();
      avatarPreview.src = DEFAULT_AVATAR_SRC;
      avatarRemove.disabled = true;
      avatarStatus.textContent = 'Photo removed.';
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
