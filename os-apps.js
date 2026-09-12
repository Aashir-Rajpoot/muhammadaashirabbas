/* =========================================================================
   AASHIR OS — Applications
   File Explorer, My Computer, Recycle Bin, Text Editor, Aashir Browser.
   Each app is a factory that builds DOM content and hands it to AashirWM.
   ========================================================================= */
(function (global) {
  'use strict';

  var VFS = global.AashirVFS;
  var WM = global.AashirWM;
  var clipboard = null; // { path, mode: 'copy' | 'cut' }

  function icon(name) {
    var icons = {
      folder: '📁', file: '📄', txt: '📝', drive: '💽', recycle: '🗑️',
      computer: '🖥️', explorer: '🗂️', browser: '🌐', terminal: '⌁', home: '🏠'
    };
    return icons[name] || '📄';
  }

  function fileIcon(path) {
    var n = VFS.getNode(path);
    if (!n) return icon('file');
    if (n.type === 'folder') return icon('folder');
    if (/\.txt$/i.test(n.name)) return icon('txt');
    return icon('file');
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function dismissMenus() {
    document.querySelectorAll('.os-ctxmenu').forEach(function (m) { m.remove(); });
  }

  function showContextMenu(x, y, items) {
    dismissMenus();
    var menu = document.createElement('div');
    menu.className = 'os-ctxmenu';
    items.forEach(function (item) {
      if (item === '-') {
        var sep = document.createElement('div');
        sep.className = 'os-ctxmenu-sep';
        menu.appendChild(sep);
        return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'os-ctxmenu-item';
      if (item.disabled) btn.disabled = true;
      btn.textContent = item.label;
      btn.addEventListener('click', function () {
        dismissMenus();
        if (!item.disabled) item.run();
      });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    var vw = window.innerWidth, vh = window.innerHeight;
    var rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, vw - rect.width - 8) + 'px';
    menu.style.top = Math.min(y, vh - rect.height - 8) + 'px';
    setTimeout(function () {
      window.addEventListener('mousedown', function handler(e) {
        if (!menu.contains(e.target)) { dismissMenus(); window.removeEventListener('mousedown', handler); }
      });
    }, 0);
    return menu;
  }

  function promptDialog(title, defaultValue, cb) {
    var overlay = document.createElement('div');
    overlay.className = 'os-dialog-overlay';
    overlay.innerHTML =
      '<div class="os-dialog">' +
        '<h4>' + WM.escapeHtml(title) + '</h4>' +
        '<input type="text" class="os-dialog-input" value="' + WM.escapeHtml(defaultValue || '') + '">' +
        '<div class="os-dialog-actions">' +
          '<button type="button" class="os-btn-ghost" data-act="cancel">Cancel</button>' +
          '<button type="button" class="os-btn-solid" data-act="ok">OK</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = overlay.querySelector('.os-dialog-input');
    input.focus(); input.select();
    function close(val) { overlay.remove(); if (val !== undefined) cb(val); }
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', function () { close(); });
    overlay.querySelector('[data-act="ok"]').addEventListener('click', function () { close(input.value.trim()); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') close(input.value.trim());
      if (e.key === 'Escape') close();
    });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
  }

  function confirmDialog(message, cb) {
    var overlay = document.createElement('div');
    overlay.className = 'os-dialog-overlay';
    overlay.innerHTML =
      '<div class="os-dialog">' +
        '<h4>Confirm</h4>' +
        '<p class="os-dialog-msg">' + WM.escapeHtml(message) + '</p>' +
        '<div class="os-dialog-actions">' +
          '<button type="button" class="os-btn-ghost" data-act="no">Cancel</button>' +
          '<button type="button" class="os-btn-solid os-btn-danger" data-act="yes">Delete</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close(val) { overlay.remove(); cb(val); }
    overlay.querySelector('[data-act="no"]').addEventListener('click', function () { close(false); });
    overlay.querySelector('[data-act="yes"]').addEventListener('click', function () { close(true); });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(false); });
  }

  /* ---------------------------------------------------------------------
     TEXT EDITOR
     --------------------------------------------------------------------- */
  function openTextEditor(path) {
    var winId = 'editor:' + path;
    if (WM.isOpen(winId)) { WM.focus(winId); return; }
    var node = VFS.getNode(path);
    if (!node) return;

    var wrap = document.createElement('div');
    wrap.className = 'os-app os-editor';
    wrap.innerHTML =
      '<div class="os-editor-toolbar">' +
        '<button type="button" class="os-btn-solid os-editor-save">Save</button>' +
        '<span class="os-editor-dirty" hidden>● Unsaved changes</span>' +
      '</div>' +
      '<textarea class="os-editor-area" spellcheck="false"></textarea>';
    var textarea = wrap.querySelector('.os-editor-area');
    textarea.value = node.content || '';
    var dirty = false;
    var dirtyFlag = wrap.querySelector('.os-editor-dirty');

    function markDirty(v) {
      dirty = v;
      dirtyFlag.hidden = !v;
      WM.setTitle(winId, (v ? '● ' : '') + node.name + ' — Text Editor');
    }

    textarea.addEventListener('input', function () { markDirty(true); });

    function save() {
      VFS.writeFile(path, textarea.value);
      markDirty(false);
    }
    wrap.querySelector('.os-editor-save').addEventListener('click', save);
    textarea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    });

    WM.createWindow({
      id: winId, title: node.name + ' — Text Editor', icon: icon('txt'),
      width: 520, height: 420, content: wrap,
      onClose: function () {
        if (dirty) {
          var ok = window.confirm('You have unsaved changes in ' + node.name + '. Discard them?');
          return ok;
        }
        return true;
      }
    });
  }

  /* ---------------------------------------------------------------------
     FILE EXPLORER (also used for My Computer)
     --------------------------------------------------------------------- */
  function openExplorer(startPath, opts) {
    opts = opts || {};
    var winId = opts.winId || 'explorer';
    if (WM.isOpen(winId)) { WM.focus(winId); return; }

    var history = [startPath];
    var histIndex = 0;
    var current = startPath;
    var selected = null;

    var wrap = document.createElement('div');
    wrap.className = 'os-app os-explorer';
    wrap.innerHTML =
      '<div class="os-explorer-toolbar">' +
        '<button type="button" class="os-exp-back" title="Back">&#8592;</button>' +
        '<button type="button" class="os-exp-fwd" title="Forward">&#8594;</button>' +
        '<button type="button" class="os-exp-up" title="Up">&#8593;</button>' +
        '<div class="os-exp-path"></div>' +
        '<button type="button" class="os-exp-refresh" title="Refresh">&#8635;</button>' +
      '</div>' +
      '<div class="os-explorer-body">' +
        '<nav class="os-exp-sidebar"></nav>' +
        '<div class="os-exp-main" tabindex="0"></div>' +
      '</div>' +
      '<div class="os-exp-statusbar"></div>';

    var sidebar = wrap.querySelector('.os-exp-sidebar');
    var main = wrap.querySelector('.os-exp-main');
    var pathBar = wrap.querySelector('.os-exp-path');
    var statusBar = wrap.querySelector('.os-exp-statusbar');

    var quickLinks = [
      { path: '/', label: 'This PC', ic: icon('computer') }
    ].concat(VFS.ROOT_FOLDERS.map(function (f) { return { path: '/' + f, label: f, ic: icon('folder') }; }));

    function renderSidebar() {
      sidebar.innerHTML = '';
      quickLinks.forEach(function (q) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'os-exp-quicklink' + (q.path === current ? ' active' : '');
        btn.innerHTML = '<span>' + q.ic + '</span>' + WM.escapeHtml(q.label);
        btn.addEventListener('click', function () { navigate(q.path); });
        sidebar.appendChild(btn);
      });
    }

    function navigate(path, pushHistory) {
      if (!VFS.exists(path) || !VFS.isFolder(path)) return;
      current = path;
      selected = null;
      if (pushHistory !== false) {
        history = history.slice(0, histIndex + 1);
        history.push(path);
        histIndex = history.length - 1;
      }
      render();
    }

    function goBack() { if (histIndex > 0) { histIndex--; current = history[histIndex]; selected = null; render(); } }
    function goForward() { if (histIndex < history.length - 1) { histIndex++; current = history[histIndex]; selected = null; render(); } }
    function goUp() { var p = VFS.parentOf(current); if (p) navigate(p); }

    function label(path) {
      if (path === '/') return 'This PC';
      var n = VFS.getNode(path);
      return n ? n.name : path;
    }

    function renderPathBar() {
      pathBar.innerHTML = '';
      var parts = current === '/' ? [] : current.split('/').filter(Boolean);
      var acc = '/';
      var rootCrumb = document.createElement('button');
      rootCrumb.type = 'button';
      rootCrumb.className = 'os-exp-crumb';
      rootCrumb.textContent = 'This PC';
      rootCrumb.addEventListener('click', function () { navigate('/'); });
      pathBar.appendChild(rootCrumb);
      parts.forEach(function (p) {
        acc = VFS.joinPath(acc, p);
        var sep = document.createElement('span');
        sep.className = 'os-exp-crumb-sep';
        sep.textContent = '›';
        pathBar.appendChild(sep);
        var crumb = document.createElement('button');
        crumb.type = 'button';
        crumb.className = 'os-exp-crumb';
        crumb.textContent = p;
        var target = acc;
        crumb.addEventListener('click', function () { navigate(target); });
        pathBar.appendChild(crumb);
      });
    }

    function itemContextMenu(e, path) {
      e.preventDefault(); e.stopPropagation();
      selected = path; renderMain();
      var isFolder = VFS.isFolder(path);
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Open', run: function () { openItem(path); } },
        '-',
        { label: 'Cut', run: function () { clipboard = { path: path, mode: 'cut' }; } },
        { label: 'Copy', run: function () { clipboard = { path: path, mode: 'copy' }; } },
        '-',
        { label: 'Rename', run: function () {
            promptDialog('Rename', VFS.getNode(path).name, function (val) {
              if (val) { VFS.rename(path, val); render(); }
            });
          } },
        { label: 'Delete', run: function () {
            confirmDialog('Move "' + VFS.getNode(path).name + '" to Recycle Bin?', function (ok) {
              if (ok) { VFS.deleteNode(path); render(); }
            });
          } },
        '-',
        { label: isFolder ? 'Properties (Folder)' : 'Properties (File)', run: function () { showProperties(path); } }
      ]);
    }

    function showProperties(path) {
      var n = VFS.getNode(path);
      var overlay = document.createElement('div');
      overlay.className = 'os-dialog-overlay';
      overlay.innerHTML =
        '<div class="os-dialog">' +
          '<h4>' + WM.escapeHtml(n.name) + ' — Properties</h4>' +
          '<ul class="os-props-list">' +
            '<li><span>Type</span><span>' + (n.type === 'folder' ? 'Folder' : 'Text Document') + '</span></li>' +
            '<li><span>Location</span><span>' + WM.escapeHtml(VFS.parentOf(path) || '/') + '</span></li>' +
            (n.type === 'file' ? '<li><span>Size</span><span>' + (n.content ? n.content.length : 0) + ' bytes</span></li>' : '<li><span>Items</span><span>' + n.children.length + '</span></li>') +
            '<li><span>Created</span><span>' + fmtDate(n.created) + '</span></li>' +
            (n.type === 'file' ? '<li><span>Modified</span><span>' + fmtDate(n.modified) + '</span></li>' : '') +
          '</ul>' +
          '<div class="os-dialog-actions"><button type="button" class="os-btn-solid" data-act="ok">Close</button></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-act="ok"]').addEventListener('click', function () { overlay.remove(); });
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) overlay.remove(); });
    }

    function openItem(path) {
      if (VFS.isFolder(path)) { navigate(path); }
      else { openTextEditor(path); }
    }

    function renderMain() {
      main.innerHTML = '';
      var children = VFS.listChildren(current);
      if (children.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'os-exp-empty';
        empty.textContent = 'This folder is empty.';
        main.appendChild(empty);
      }
      children.forEach(function (path) {
        var n = VFS.getNode(path);
        var item = document.createElement('div');
        item.className = 'os-exp-item' + (selected === path ? ' selected' : '');
        item.innerHTML = '<span class="os-exp-item-icon">' + fileIcon(path) + '</span><span class="os-exp-item-name"></span>';
        item.querySelector('.os-exp-item-name').textContent = n.name;
        item.addEventListener('click', function (e) { e.stopPropagation(); selected = path; renderMain(); });
        item.addEventListener('dblclick', function (e) { e.stopPropagation(); openItem(path); });
        item.addEventListener('contextmenu', function (e) { itemContextMenu(e, path); });
        main.appendChild(item);
      });
      statusBar.textContent = children.length + ' item' + (children.length === 1 ? '' : 's');
    }

    function emptyAreaContextMenu(e) {
      e.preventDefault();
      selected = null; renderMain();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Refresh', run: function () { render(); } },
        { label: 'New Folder', run: function () { var p = VFS.createFolder(current, 'New Folder'); render(); } },
        { label: 'New Text File', run: function () { var p = VFS.createFile(current, 'New Text Document.txt'); render(); } },
        '-',
        { label: 'Paste', disabled: !clipboard, run: function () {
            if (!clipboard) return;
            if (clipboard.mode === 'copy') VFS.copyNode(clipboard.path, current);
            else { VFS.moveNode(clipboard.path, current); clipboard = null; }
            render();
          } }
      ]);
    }

    main.addEventListener('contextmenu', emptyAreaContextMenu);
    main.addEventListener('click', function () { selected = null; renderMain(); });

    wrap.querySelector('.os-exp-back').addEventListener('click', goBack);
    wrap.querySelector('.os-exp-fwd').addEventListener('click', goForward);
    wrap.querySelector('.os-exp-up').addEventListener('click', goUp);
    wrap.querySelector('.os-exp-refresh').addEventListener('click', function () { render(); });

    function render() {
      renderSidebar();
      renderPathBar();
      renderMain();
    }
    render();

    VFS.onChange(function () { if (WM.isOpen(winId)) render(); });

    WM.createWindow({
      id: winId, title: opts.title || label(startPath), icon: opts.icon || icon('explorer'),
      width: 680, height: 460, minWidth: 420, minHeight: 300, content: wrap
    });
  }

  function openMyComputer() {
    openExplorer('/', { winId: 'mycomputer', title: 'My Computer', icon: icon('computer') });
  }
  function openFileExplorer() {
    openExplorer('/Desktop', { winId: 'explorer', title: 'File Explorer', icon: icon('explorer') });
  }
  function openDownloads() {
    openExplorer('/Downloads', { winId: 'explorer', title: 'File Explorer', icon: icon('explorer') });
  }

  /* ---------------------------------------------------------------------
     RECYCLE BIN
     --------------------------------------------------------------------- */
  function openRecycleBin() {
    var winId = 'recyclebin';
    if (WM.isOpen(winId)) { WM.focus(winId); return; }
    var wrap = document.createElement('div');
    wrap.className = 'os-app os-recycle';
    wrap.innerHTML =
      '<div class="os-recycle-toolbar">' +
        '<button type="button" class="os-btn-ghost os-recycle-empty">Empty Recycle Bin</button>' +
      '</div>' +
      '<div class="os-recycle-list"></div>';
    var list = wrap.querySelector('.os-recycle-list');

    function render() {
      var items = VFS.listRecycleBin();
      list.innerHTML = '';
      if (items.length === 0) {
        list.innerHTML = '<div class="os-exp-empty">Recycle Bin is empty.</div>';
        return;
      }
      items.forEach(function (entry) {
        var row = document.createElement('div');
        row.className = 'os-recycle-row';
        row.innerHTML =
          '<span class="os-exp-item-icon">' + (entry.type === 'folder' ? icon('folder') : icon('txt')) + '</span>' +
          '<span class="os-recycle-name"></span>' +
          '<span class="os-recycle-meta">Deleted ' + fmtDate(entry.deletedAt) + '</span>' +
          '<button type="button" class="os-btn-ghost os-recycle-restore">Restore</button>' +
          '<button type="button" class="os-btn-ghost os-btn-danger os-recycle-purge">Delete</button>';
        row.querySelector('.os-recycle-name').textContent = entry.name;
        row.querySelector('.os-recycle-restore').addEventListener('click', function () {
          VFS.restoreFromRecycle(entry.id); render();
        });
        row.querySelector('.os-recycle-purge').addEventListener('click', function () {
          confirmDialog('Permanently delete "' + entry.name + '"? This cannot be undone.', function (ok) {
            if (ok) { VFS.purgeFromRecycle(entry.id); render(); }
          });
        });
        list.appendChild(row);
      });
    }
    wrap.querySelector('.os-recycle-empty').addEventListener('click', function () {
      confirmDialog('Permanently delete all items in the Recycle Bin?', function (ok) {
        if (ok) { VFS.emptyRecycleBin(); render(); }
      });
    });
    render();
    VFS.onChange(function () { if (WM.isOpen(winId)) render(); });

    WM.createWindow({ id: winId, title: 'Recycle Bin', icon: icon('recycle'), width: 520, height: 400, content: wrap });
  }

  /* ---------------------------------------------------------------------
     AASHIR BROWSER
     --------------------------------------------------------------------- */
  var browserPages = {
    'aashir://home': {
      title: 'Aashir Browser — Home',
      body: '<div class="os-browser-home">' +
        '<h2>AASHIR OS</h2>' +
        '<p>Local browser sandbox — no real internet access. Try an internal address below.</p>' +
        '<div class="os-browser-links">' +
          '<a href="#" data-go="aashir://about">aashir://about</a>' +
          '<a href="#" data-go="aashir://projects">aashir://projects</a>' +
          '<a href="#" data-go="aashir://terminal-help">aashir://terminal-help</a>' +
        '</div>' +
      '</div>'
    },
    'aashir://about': {
      title: 'Aashir Browser — About',
      body: '<div class="os-browser-page"><h3>About AASHIR OS</h3><p>A simulated desktop environment built entirely with HTML, CSS and JavaScript. Every file, folder and window you see lives only in this browser tab, persisted to localStorage.</p></div>'
    },
    'aashir://projects': {
      title: 'Aashir Browser — Projects',
      body: '<div class="os-browser-page"><h3>Projects</h3><p>See the Projects module on the main AASHIR OS panel for live project links.</p></div>'
    },
    'aashir://terminal-help': {
      title: 'Aashir Browser — Terminal Help',
      body: '<div class="os-browser-page"><h3>Terminal Commands</h3><p>Open the Terminal app and type <code>help</code> for the full simulated command list.</p></div>'
    }
  };

  function openBrowser() {
    var winId = 'browser';
    if (WM.isOpen(winId)) { WM.focus(winId); return; }

    var wrap = document.createElement('div');
    wrap.className = 'os-app os-browser';
    wrap.innerHTML =
      '<div class="os-browser-tabs"></div>' +
      '<div class="os-browser-toolbar">' +
        '<button type="button" class="os-br-back" title="Back">&#8592;</button>' +
        '<button type="button" class="os-br-fwd" title="Forward">&#8594;</button>' +
        '<button type="button" class="os-br-refresh" title="Refresh">&#8635;</button>' +
        '<button type="button" class="os-br-home" title="Home">' + icon('home') + '</button>' +
        '<input type="text" class="os-browser-address" spellcheck="false">' +
        '<button type="button" class="os-br-go">Go</button>' +
      '</div>' +
      '<div class="os-browser-view"></div>';

    var tabsEl = wrap.querySelector('.os-browser-tabs');
    var addressInput = wrap.querySelector('.os-browser-address');
    var view = wrap.querySelector('.os-browser-view');

    var tabs = [];
    var activeTab = 0;

    function newTab(url) {
      tabs.push({ url: url || 'aashir://home', history: [url || 'aashir://home'], histIndex: 0 });
      activeTab = tabs.length - 1;
      renderTabs(); renderView();
    }

    function closeTab(idx) {
      tabs.splice(idx, 1);
      if (tabs.length === 0) { newTab(); return; }
      activeTab = Math.max(0, idx - 1);
      renderTabs(); renderView();
    }

    function renderTabs() {
      tabsEl.innerHTML = '';
      tabs.forEach(function (t, idx) {
        var tab = document.createElement('div');
        tab.className = 'os-browser-tab' + (idx === activeTab ? ' active' : '');
        var page = browserPages[t.url];
        tab.innerHTML = '<span class="os-browser-tab-title"></span><button type="button" class="os-browser-tab-close">&times;</button>';
        tab.querySelector('.os-browser-tab-title').textContent = page ? page.title.split(' — ')[1] || page.title : t.url;
        tab.addEventListener('click', function (e) {
          if (e.target.closest('.os-browser-tab-close')) return;
          activeTab = idx; renderTabs(); renderView();
        });
        tab.querySelector('.os-browser-tab-close').addEventListener('click', function (e) { e.stopPropagation(); closeTab(idx); });
        tabsEl.appendChild(tab);
      });
      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'os-browser-tab-add';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', function () { newTab(); });
      tabsEl.appendChild(addBtn);
    }

    function renderView() {
      var t = tabs[activeTab];
      if (!t) return;
      addressInput.value = t.url;
      var page = browserPages[t.url];
      if (page) {
        view.innerHTML = page.body;
        view.querySelectorAll('[data-go]').forEach(function (a) {
          a.addEventListener('click', function (e) { e.preventDefault(); go(a.dataset.go); });
        });
      } else {
        view.innerHTML = '<div class="os-browser-page os-browser-404"><h3>Can&rsquo;t reach this page</h3><p>' + WM.escapeHtml(t.url) + ' is not a known AASHIR OS internal address. This browser only simulates local pages — try <code>aashir://home</code>.</p></div>';
      }
    }

    function go(url) {
      url = url.trim();
      if (!url) return;
      if (!/^aashir:\/\//i.test(url)) url = 'aashir://' + url.replace(/^https?:\/\//, '');
      var t = tabs[activeTab];
      t.history = t.history.slice(0, t.histIndex + 1);
      t.history.push(url);
      t.histIndex = t.history.length - 1;
      t.url = url;
      renderTabs(); renderView();
    }

    wrap.querySelector('.os-br-go').addEventListener('click', function () { go(addressInput.value); });
    addressInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(addressInput.value); });
    wrap.querySelector('.os-br-home').addEventListener('click', function () { go('aashir://home'); });
    wrap.querySelector('.os-br-refresh').addEventListener('click', function () { renderView(); });
    wrap.querySelector('.os-br-back').addEventListener('click', function () {
      var t = tabs[activeTab];
      if (t.histIndex > 0) { t.histIndex--; t.url = t.history[t.histIndex]; renderTabs(); renderView(); }
    });
    wrap.querySelector('.os-br-fwd').addEventListener('click', function () {
      var t = tabs[activeTab];
      if (t.histIndex < t.history.length - 1) { t.histIndex++; t.url = t.history[t.histIndex]; renderTabs(); renderView(); }
    });

    newTab('aashir://home');

    WM.createWindow({ id: winId, title: 'Aashir Browser', icon: icon('browser'), width: 640, height: 460, content: wrap });
  }

  global.AashirApps = {
    icon: icon,
    fileIcon: fileIcon,
    fmtDate: fmtDate,
    showContextMenu: showContextMenu,
    dismissMenus: dismissMenus,
    promptDialog: promptDialog,
    confirmDialog: confirmDialog,
    openTextEditor: openTextEditor,
    openExplorer: openExplorer,
    openMyComputer: openMyComputer,
    openFileExplorer: openFileExplorer,
    openDownloads: openDownloads,
    openRecycleBin: openRecycleBin,
    openBrowser: openBrowser,
    getClipboard: function () { return clipboard; },
    setClipboard: function (v) { clipboard = v; }
  };
})(window);
