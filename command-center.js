'use strict';
/* =========================================================================
   AASHIR X — Portfolio Command Center
   A single hub that reuses the site's existing systems — Customizer,
   AASHIR OS, System Panel, radial navigation, FAQ accordion — instead of
   duplicating them. Nothing here talks to a backend; the only local state
   it stores is a couple of lightweight, purely visual UI preferences.
   ========================================================================= */
(function () {
  var panel, grid, resultsWrap, resultsList, searchInput, navView, settingsView, toggleTrigger;
  var lastFocused = null;
  var searchIndex = null;

  /* ---------- small reuse helpers (no duplicated logic) ---------- */
  function clickIfExists(id) {
    var el = document.getElementById(id);
    if (el) el.click();
    return el;
  }
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function openOS(moduleName) {
    if (typeof OSEngine === 'undefined' || !OSEngine || !OSEngine.root) { clickIfExists('os-enter'); return; }
    OSEngine.open();
    if (moduleName) OSEngine.showModule(moduleName);
  }
  function openSystemPanel() { clickIfExists('system-open'); }
  function openCustomizer(tab) {
    var toggle = document.getElementById('cz-toggle');
    if (!toggle) return;
    toggle.click();
    if (tab) {
      requestAnimationFrame(function () {
        var tabBtn = document.querySelector('.cz-tab[data-tab="' + tab + '"]');
        if (tabBtn) tabBtn.click();
      });
    }
  }
  function resetCustomizer() { clickIfExists('cz-reset'); }
  function openFaqItem(headingId) {
    var btn = document.getElementById(headingId);
    if (!btn) return;
    scrollToId('faq');
    if (btn.getAttribute('aria-expanded') !== 'true') btn.click();
  }
  function closeRadialMenu() {
    var menu = document.getElementById('radial-menu'), orb = document.getElementById('nav-orb');
    if (menu) menu.classList.remove('open');
    if (orb) orb.setAttribute('aria-expanded', 'false');
  }

  /* ---------- search index: built from the page's own content, never duplicated by hand ---------- */
  function buildSearchIndex() {
    var items = [];

    items.push(
      { title: 'Home', meta: 'Section', run: function () { scrollToId('top'); } },
      { title: 'Digital Worlds', meta: 'Section · Projects', run: function () { scrollToId('worlds'); } },
      { title: 'Who Is Aashir', meta: 'Section · About', run: function () { scrollToId('about'); } },
      { title: 'Connect', meta: 'Section · Social', run: function () { scrollToId('connect'); } },
      { title: 'FAQ', meta: 'Section', run: function () { scrollToId('faq'); } },
      { title: 'Full About Page', meta: 'Page', run: function () { window.location.href = '/aboutus'; } },
      { title: 'Download App', meta: 'Page', run: function () { window.location.href = '/download-app.html'; } },
      { title: 'AASHIR OS', meta: 'System', run: function () { openOS(); } },
      { title: 'System Diagnostic', meta: 'System', run: function () { openSystemPanel(); } }
    );

    // Projects — read straight from the existing Digital Worlds list, never hard-coded
    document.querySelectorAll('#index-list .index-row').forEach(function (row) {
      var titleEl = row.querySelector('.row-title'), tagEl = row.querySelector('.row-tag');
      var url = row.getAttribute('data-url');
      if (!titleEl || !url) return;
      var title = titleEl.textContent.trim();
      items.push({
        title: title,
        meta: 'Project' + (tagEl ? ' · ' + tagEl.textContent.trim() : ''),
        run: function () {
          if (typeof launchProject === 'function') launchProject(url, title);
          else window.open(url, '_blank', 'noopener');
        }
      });
    });

    // Skills — reuse AASHIR OS's own skill data instead of retyping it
    if (typeof OSEngine !== 'undefined' && OSEngine && Array.isArray(OSEngine.skillGroups)) {
      OSEngine.skillGroups.forEach(function (group) {
        (group.items || []).forEach(function (skill) {
          items.push({ title: skill, meta: 'Skill · ' + group.cat, run: function () { openOS('skills'); } });
        });
      });
    }

    // FAQ — read straight from the existing FAQ accordion
    document.querySelectorAll('#faq-list .faq-item').forEach(function (item) {
      var q = item.querySelector('.faq-question span');
      var btn = item.querySelector('.faq-question');
      if (!q || !btn) return;
      items.push({ title: q.textContent.trim(), meta: 'FAQ', run: function () { openFaqItem(btn.id); } });
    });

    return items;
  }

  function runSearch(query) {
    var q = query.trim().toLowerCase();
    if (!q) { resultsList.innerHTML = '<p class="cc-empty">Start typing to search sections, projects, skills &amp; FAQ.</p>'; return; }
    if (!searchIndex) searchIndex = buildSearchIndex();
    var matches = searchIndex.filter(function (it) { return it.title.toLowerCase().indexOf(q) !== -1; }).slice(0, 18);
    if (!matches.length) { resultsList.innerHTML = '<p class="cc-empty">No matches for "' + escapeHtml(query) + '".</p>'; return; }
    resultsList.innerHTML = '';
    matches.forEach(function (m) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc-result';
      btn.innerHTML = '<span class="cc-result-title">' + escapeHtml(m.title) + '</span><span class="cc-result-meta">' + escapeHtml(m.meta) + '</span>';
      btn.addEventListener('click', function () { m.run(); close(); });
      resultsList.appendChild(btn);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ---------- quick navigation list ---------- */
  var NAV_ITEMS = [
    { label: 'Home', hint: 'Top of page', run: function () { scrollToId('top'); } },
    { label: 'Digital Worlds', hint: 'Projects', run: function () { scrollToId('worlds'); } },
    { label: 'About', hint: 'Full page', run: function () { window.location.href = '/aboutus'; } },
    { label: 'Skills', hint: 'AASHIR OS', run: function () { openOS('skills'); } },
    { label: 'FAQ', hint: 'On this page', run: function () { scrollToId('faq'); } },
    { label: 'Connect', hint: 'Social links', run: function () { scrollToId('connect'); } },
    { label: 'AASHIR OS', hint: 'Enter OS', run: function () { openOS(); } },
    { label: 'System', hint: 'Diagnostic panel', run: function () { openSystemPanel(); } },
    { label: 'Download App', hint: 'PWA install', run: function () { window.location.href = '/download-app.html'; } }
  ];

  function renderNavView() {
    var list = navView.querySelector('#cc-nav-list');
    list.innerHTML = '';
    NAV_ITEMS.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc-link';
      btn.innerHTML = '<span>' + escapeHtml(item.label) + '</span><span>' + escapeHtml(item.hint) + '</span>';
      btn.addEventListener('click', function () { item.run(); close(); });
      list.appendChild(btn);
    });
  }

  /* ---------- settings view: shortcuts into the existing Customizer, no new storage systems ---------- */
  function renderSettingsView() {
    var list = settingsView.querySelector('#cc-settings-list');
    list.innerHTML = '';
    var opts = [
      { label: 'Appearance', hint: 'Colors & background', run: function () { openCustomizer('design'); } },
      { label: 'Cursor Style', hint: 'Pointer preference', run: function () { openCustomizer('cursor'); } },
      { label: 'Layout', hint: 'Section order & visibility', run: function () { openCustomizer('layout'); } },
      { label: 'Make It Mine', hint: 'Name & photo', run: function () { openCustomizer('mine'); } },
      { label: 'Reset Customization', hint: 'Restore defaults', danger: true, run: function () { resetCustomizer(); } }
    ];
    opts.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc-link' + (item.danger ? ' cc-link-danger' : '');
      btn.innerHTML = '<span>' + escapeHtml(item.label) + '</span><span>' + escapeHtml(item.hint) + '</span>';
      btn.addEventListener('click', function () { item.run(); close(); });
      list.appendChild(btn);
    });
  }

  /* ---------- view switching ---------- */
  function showGrid() {
    grid.hidden = false; resultsWrap.hidden = true; navView.hidden = true; settingsView.hidden = true;
    searchInput.value = ''; resultsList.innerHTML = '';
  }
  function showSearch() {
    grid.hidden = true; navView.hidden = true; settingsView.hidden = true; resultsWrap.hidden = false;
    if (!resultsList.innerHTML) resultsList.innerHTML = '<p class="cc-empty">Start typing to search sections, projects, skills &amp; FAQ.</p>';
    requestAnimationFrame(function () { searchInput.focus(); });
  }
  function showNav() {
    grid.hidden = true; resultsWrap.hidden = true; settingsView.hidden = true; navView.hidden = false;
    renderNavView();
  }
  function showSettings() {
    grid.hidden = true; resultsWrap.hidden = true; navView.hidden = true; settingsView.hidden = false;
    renderSettingsView();
  }

  /* ---------- open / close ---------- */
  function open() {
    lastFocused = document.activeElement;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    showGrid();
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(function () {
      var closeBtn = document.getElementById('cc-close');
      if (closeBtn) closeBtn.focus();
    });
  }
  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function toggle() { panel.classList.contains('open') ? close() : open(); }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  /* ---------- build DOM ---------- */
  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'cc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'cc-title');
    panel.setAttribute('aria-hidden', 'true');

    panel.innerHTML =
      '<div class="cc-backdrop" data-cc-close></div>' +
      '<div class="cc-inner">' +
        '<div class="cc-head">' +
          '<span class="cc-head-title"><i></i><span id="cc-title">Command Center</span></span>' +
          '<button type="button" id="cc-close" aria-label="Close command center">&times;</button>' +
        '</div>' +
        '<p class="cc-sub">Quick access to everything on this portfolio.</p>' +

        '<div class="cc-grid" id="cc-grid">' +
          tile('customize', 'Customize', 'Colors, layout & cursor', '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M21 17h-2"/><circle cx="15" cy="7" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="19" cy="17" r="2"/>') +
          tile('os', 'AASHIR OS', 'Enter the interactive OS', '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>') +
          tile('system', 'System', 'Live diagnostic panel', '<path d="M3 12h4l2-7 4 14 2-7h6"/>') +
          tile('search', 'Search', 'Sections, projects, skills', '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>') +
          tile('nav', 'Quick Navigation', 'Jump to any section', '<path d="M12 2l3 7h7l-5.6 4.3L18.5 21 12 16.8 5.5 21l2.1-7.7L2 9h7z"/>') +
          tile('settings', 'Settings', 'Interface preferences', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>') +
        '</div>' +

        '<div class="cc-subview" id="cc-search-view" hidden>' +
          '<button type="button" class="cc-back" data-cc-back>&larr; Back</button>' +
          '<div class="cc-search-bar">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
            '<input type="text" id="cc-search-input" placeholder="Search sections, projects, skills, FAQ…" autocomplete="off" spellcheck="false">' +
          '</div>' +
          '<div class="cc-results" id="cc-search-results"></div>' +
        '</div>' +

        '<div class="cc-subview" id="cc-nav-view" hidden>' +
          '<button type="button" class="cc-back" data-cc-back>&larr; Back</button>' +
          '<div class="cc-link-list" id="cc-nav-list"></div>' +
        '</div>' +

        '<div class="cc-subview" id="cc-settings-view" hidden>' +
          '<button type="button" class="cc-back" data-cc-back>&larr; Back</button>' +
          '<div class="cc-link-list" id="cc-settings-list"></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(panel);

    grid = panel.querySelector('#cc-grid');
    var searchViewWrap = panel.querySelector('#cc-search-view');
    resultsWrap = searchViewWrap; // the whole subview toggles together
    resultsList = panel.querySelector('#cc-search-results');
    searchInput = panel.querySelector('#cc-search-input');
    navView = panel.querySelector('#cc-nav-view');
    settingsView = panel.querySelector('#cc-settings-view');

    panel.querySelector('#cc-close').addEventListener('click', close);
    panel.querySelectorAll('[data-cc-close]').forEach(function (el) { el.addEventListener('click', close); });
    panel.querySelectorAll('[data-cc-back]').forEach(function (el) { el.addEventListener('click', showGrid); });

    grid.querySelectorAll('.cc-tile').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'customize') { close(); openCustomizer(); }
        else if (action === 'os') { close(); openOS(); }
        else if (action === 'system') { close(); openSystemPanel(); }
        else if (action === 'search') { showSearch(); }
        else if (action === 'nav') { showNav(); }
        else if (action === 'settings') { showSettings(); }
      });
    });

    searchInput.addEventListener('input', function () { runSearch(searchInput.value); });
  }

  function tile(action, label, desc, iconPaths) {
    return '<button type="button" class="cc-tile" data-action="' + action + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7">' + iconPaths + '</svg>' +
      '<span class="cc-tile-label">' + label + '</span>' +
      '<span class="cc-tile-desc">' + desc + '</span>' +
    '</button>';
  }

  /* ---------- entry point wiring: reuses the existing radial nav ---------- */
  function wireTrigger() {
    toggleTrigger = document.getElementById('command-center-open');
    if (!toggleTrigger) return;
    toggleTrigger.addEventListener('click', function () { closeRadialMenu(); toggle(); });
  }

  function wireShortcut() {
    document.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); toggle(); }
    });
  }

  function init() {
    buildPanel();
    wireTrigger();
    wireShortcut();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
