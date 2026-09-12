/* =========================================================================
   AASHIR OS — Desktop
   Wires the desktop icon grid, empty-area context menu, taskbar clock,
   Start menu and app launch icons together with the window manager,
   VFS and apps modules.
   ========================================================================= */
(function (global) {
  'use strict';

  var VFS = global.AashirVFS;
  var WM = global.AashirWM;
  var Apps = global.AashirApps;
  var Term = global.AashirTerminal;

  var selectedDesktopIcon = null;

  var SYSTEM_ICONS = [
    { id: 'sys:recyclebin', label: 'Recycle Bin', glyph: '🗑️', run: function () { Apps.openRecycleBin(); } },
    { id: 'sys:mycomputer', label: 'My Computer', glyph: '🖥️', run: function () { Apps.openMyComputer(); } },
    { id: 'sys:explorer', label: 'File Explorer', glyph: '🗂️', run: function () { Apps.openFileExplorer(); } },
    { id: 'sys:browser', label: 'Aashir Browser', glyph: '🌐', run: function () { Apps.openBrowser(); } },
    { id: 'sys:terminal', label: 'Terminal', glyph: '⌁', run: function () { Term.openTerminal(); } }
  ];

  function renderClock() {
    var dateEl = document.getElementById('os2-clock-date');
    var timeEl = document.getElementById('os2-clock-time');
    function tick() {
      var now = new Date();
      if (dateEl) dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (timeEl) timeEl.textContent = now.toLocaleTimeString();
    }
    tick();
    setInterval(tick, 1000);
  }

  function iconEl(id, glyph, label, isSystem) {
    var el = document.createElement('div');
    el.className = 'os2-icon';
    el.dataset.id = id;
    el.tabIndex = 0;
    el.innerHTML = '<span class="os2-icon-glyph">' + glyph + '</span><span class="os2-icon-label"></span>';
    el.querySelector('.os2-icon-label').textContent = label;
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      selectIcon(id);
    });
    return el;
  }

  function selectIcon(id) {
    selectedDesktopIcon = id;
    document.querySelectorAll('.os2-icon').forEach(function (el) {
      el.classList.toggle('selected', el.dataset.id === id);
    });
  }

  function clearSelection() {
    selectedDesktopIcon = null;
    document.querySelectorAll('.os2-icon.selected').forEach(function (el) { el.classList.remove('selected'); });
  }

  function renderDesktopIcons() {
    var grid = document.getElementById('os2-icons');
    if (!grid) return;
    grid.innerHTML = '';

    SYSTEM_ICONS.forEach(function (s) {
      var el = iconEl(s.id, s.glyph, s.label, true);
      el.addEventListener('dblclick', function (e) { e.stopPropagation(); s.run(); });
      grid.appendChild(el);
    });

    var children = VFS.listChildren('/Desktop');
    children.forEach(function (path) {
      var n = VFS.getNode(path);
      var glyph = n.type === 'folder' ? '📁' : (/\.txt$/i.test(n.name) ? '📝' : '📄');
      var el = iconEl(path, glyph, n.name, false);
      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        if (n.type === 'folder') Apps.openExplorer(path, { winId: 'explorer', title: 'File Explorer' });
        else Apps.openTextEditor(path);
      });
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault(); e.stopPropagation();
        selectIcon(path);
        Apps.showContextMenu(e.clientX, e.clientY, [
          { label: 'Open', run: function () { n.type === 'folder' ? Apps.openExplorer(path, { winId: 'explorer', title: 'File Explorer' }) : Apps.openTextEditor(path); } },
          '-',
          { label: 'Cut', run: function () { Apps.setClipboard({ path: path, mode: 'cut' }); } },
          { label: 'Copy', run: function () { Apps.setClipboard({ path: path, mode: 'copy' }); } },
          '-',
          { label: 'Rename', run: function () {
              Apps.promptDialog('Rename', n.name, function (val) { if (val) { VFS.rename(path, val); } });
            } },
          { label: 'Delete', run: function () {
              Apps.confirmDialog('Move "' + n.name + '" to Recycle Bin?', function (ok) { if (ok) VFS.deleteNode(path); });
            } }
        ]);
      });
      grid.appendChild(el);
    });
  }

  function refreshDesktopAnim() {
    var area = document.getElementById('os2-desktop-area');
    if (!area) return;
    area.classList.add('os2-refreshing');
    setTimeout(function () { area.classList.remove('os2-refreshing'); renderDesktopIcons(); }, 260);
  }

  function wireDesktopContextMenu() {
    var area = document.getElementById('os2-desktop-area');
    if (!area) return;
    area.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.os2-icon') || e.target.closest('.osw')) return;
      e.preventDefault();
      clearSelection();
      var clip = Apps.getClipboard();
      Apps.showContextMenu(e.clientX, e.clientY, [
        { label: 'Refresh', run: refreshDesktopAnim },
        { label: 'New File', run: function () { VFS.createFile('/Desktop', 'New Text Document.txt'); renderDesktopIcons(); } },
        { label: 'New Folder', run: function () { VFS.createFolder('/Desktop', 'New Folder'); renderDesktopIcons(); } },
        '-',
        { label: 'Paste', disabled: !clip, run: function () {
            if (!clip) return;
            if (clip.mode === 'copy') VFS.copyNode(clip.path, '/Desktop');
            else { VFS.moveNode(clip.path, '/Desktop'); Apps.setClipboard(null); }
            renderDesktopIcons();
          } }
      ]);
    });
    area.addEventListener('click', function (e) {
      if (!e.target.closest('.os2-icon')) { clearSelection(); Apps.dismissMenus(); }
    });
    area.addEventListener('mousedown', function () { Apps.dismissMenus(); });
  }

  function wireStartMenu() {
    var startBtn = document.getElementById('os2-start-btn');
    var startMenu = document.getElementById('os2-start-menu');
    if (!startBtn || !startMenu) return;

    var actions = {
      'start-mycomputer': function () { Apps.openMyComputer(); },
      'start-explorer': function () { Apps.openFileExplorer(); },
      'start-browser': function () { Apps.openBrowser(); },
      'start-terminal': function () { Term.openTerminal(); },
      'start-recyclebin': function () { Apps.openRecycleBin(); },
      'start-logout': function () { global.AashirAuth.logout(); }
    };
    startMenu.querySelectorAll('[data-start]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startMenu.classList.remove('open');
        var fn = actions[btn.dataset.start];
        if (fn) fn();
      });
    });
    startBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      startMenu.classList.toggle('open');
    });
    window.addEventListener('click', function () { startMenu.classList.remove('open'); });
  }

  function wireTaskbarIcons() {
    document.querySelectorAll('[data-taskbar-launch]').forEach(function (btn) {
      var key = btn.dataset.taskbarLaunch;
      var actions = {
        explorer: function () { Apps.openFileExplorer(); },
        browser: function () { Apps.openBrowser(); },
        terminal: function () { Term.openTerminal(); }
      };
      btn.addEventListener('click', function () { if (actions[key]) actions[key](); });
    });
  }

  function initDesktop() {
    WM.init(document.getElementById('os2-desktop-area'), document.getElementById('os2-taskbar-apps'));
    renderDesktopIcons();
    wireDesktopContextMenu();
    wireStartMenu();
    wireTaskbarIcons();
    renderClock();
    VFS.onChange(function () { renderDesktopIcons(); });
  }

  global.AashirDesktop = { init: initDesktop, refreshDesktopAnim: refreshDesktopAnim };
})(window);
