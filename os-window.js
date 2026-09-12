/* =========================================================================
   AASHIR OS — Window Manager
   Draggable / resizable / minimize / maximize / close windows with a
   taskbar list and z-index focus management.
   ========================================================================= */
(function (global) {
  'use strict';

  var windows = {};
  var zTop = 100;
  var activeId = null;
  var desktopArea = null;
  var taskbarApps = null;

  function init(desktopAreaEl, taskbarAppsEl) {
    desktopArea = desktopAreaEl;
    taskbarApps = taskbarAppsEl;
  }

  function cascadePosition(n) {
    var offset = (n % 8) * 28;
    return { x: 60 + offset, y: 48 + offset };
  }

  function createWindow(opts) {
    if (windows[opts.id]) {
      var existing = windows[opts.id];
      if (existing.minimized) restore(opts.id); else focus(opts.id);
      return existing;
    }
    var pos = cascadePosition(Object.keys(windows).length);
    var width = opts.width || 560;
    var height = opts.height || 400;

    var win = document.createElement('div');
    win.className = 'osw';
    win.dataset.id = opts.id;
    win.style.width = width + 'px';
    win.style.height = height + 'px';
    win.style.left = (opts.x != null ? opts.x : pos.x) + 'px';
    win.style.top = (opts.y != null ? opts.y : pos.y) + 'px';
    if (opts.minWidth) win.style.minWidth = opts.minWidth + 'px';
    if (opts.minHeight) win.style.minHeight = opts.minHeight + 'px';

    win.innerHTML =
      '<div class="osw-titlebar">' +
        '<span class="osw-icon">' + (opts.icon || '') + '</span>' +
        '<span class="osw-title"></span>' +
        '<div class="osw-controls">' +
          '<button type="button" class="osw-btn osw-min" title="Minimize" aria-label="Minimize">&#8211;</button>' +
          '<button type="button" class="osw-btn osw-max" title="Maximize" aria-label="Maximize">&#9633;</button>' +
          '<button type="button" class="osw-btn osw-close" title="Close" aria-label="Close">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="osw-body"></div>' +
      (opts.resizable === false ? '' : '<div class="osw-resize" aria-hidden="true"></div>');

    win.querySelector('.osw-title').textContent = opts.title || 'Untitled';
    var body = win.querySelector('.osw-body');
    if (opts.content) body.appendChild(opts.content);

    desktopArea.appendChild(win);

    var record = {
      id: opts.id, el: win, title: opts.title, icon: opts.icon,
      minimized: false, maximized: false, onClose: opts.onClose,
      prevRect: null
    };
    windows[opts.id] = record;

    wireTitlebar(record);
    if (opts.resizable !== false) wireResize(record);
    win.querySelector('.osw-min').addEventListener('click', function (e) { e.stopPropagation(); minimize(opts.id); });
    win.querySelector('.osw-max').addEventListener('click', function (e) { e.stopPropagation(); toggleMaximize(opts.id); });
    win.querySelector('.osw-close').addEventListener('click', function (e) { e.stopPropagation(); close(opts.id); });
    win.addEventListener('mousedown', function () { focus(opts.id); }, true);

    addTaskbarItem(record);
    focus(opts.id);
    return record;
  }

  function wireTitlebar(record) {
    var bar = record.el.querySelector('.osw-titlebar');
    var dragging = false, startX, startY, startLeft, startTop;

    bar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.osw-btn')) return;
      if (record.maximized) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startLeft = record.el.offsetLeft; startTop = record.el.offsetTop;
      document.body.classList.add('osw-dragging');
      e.preventDefault();
    });
    bar.addEventListener('dblclick', function (e) {
      if (e.target.closest('.osw-btn')) return;
      toggleMaximize(record.id);
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      var newLeft = Math.max(0, startLeft + dx);
      var newTop = Math.max(0, startTop + dy);
      record.el.style.left = newLeft + 'px';
      record.el.style.top = newTop + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (dragging) { dragging = false; document.body.classList.remove('osw-dragging'); }
    });
  }

  function wireResize(record) {
    var handle = record.el.querySelector('.osw-resize');
    if (!handle) return;
    var resizing = false, startX, startY, startW, startH;
    handle.addEventListener('mousedown', function (e) {
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = record.el.offsetWidth; startH = record.el.offsetHeight;
      e.preventDefault(); e.stopPropagation();
      document.body.classList.add('osw-dragging');
    });
    window.addEventListener('mousemove', function (e) {
      if (!resizing) return;
      var minW = parseInt(record.el.style.minWidth || '280', 10);
      var minH = parseInt(record.el.style.minHeight || '180', 10);
      var newW = Math.max(minW, startW + (e.clientX - startX));
      var newH = Math.max(minH, startH + (e.clientY - startY));
      record.el.style.width = newW + 'px';
      record.el.style.height = newH + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (resizing) { resizing = false; document.body.classList.remove('osw-dragging'); }
    });
  }

  function addTaskbarItem(record) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'os-task-app active';
    btn.dataset.id = record.id;
    btn.innerHTML = '<span class="os-task-icon">' + (record.icon || '') + '</span><span class="os-task-label">' + escapeHtml(record.title) + '</span>';
    btn.addEventListener('click', function () {
      if (windows[record.id].minimized) { restore(record.id); }
      else if (activeId === record.id) { minimize(record.id); }
      else { focus(record.id); }
    });
    taskbarApps.appendChild(btn);
    record.taskbarBtn = btn;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function focus(id) {
    var record = windows[id];
    if (!record) return;
    activeId = id;
    zTop += 1;
    record.el.style.zIndex = zTop;
    Object.keys(windows).forEach(function (k) {
      windows[k].el.classList.toggle('active', k === id);
      if (windows[k].taskbarBtn) windows[k].taskbarBtn.classList.toggle('active', k === id && !windows[k].minimized);
    });
    if (record.minimized) restore(id);
  }

  function minimize(id) {
    var record = windows[id];
    if (!record) return;
    record.minimized = true;
    record.el.classList.add('minimized');
    if (record.taskbarBtn) record.taskbarBtn.classList.remove('active');
    if (activeId === id) activeId = null;
  }

  function restore(id) {
    var record = windows[id];
    if (!record) return;
    record.minimized = false;
    record.el.classList.remove('minimized');
    focus(id);
  }

  function toggleMaximize(id) {
    var record = windows[id];
    if (!record) return;
    if (!record.maximized) {
      record.prevRect = {
        left: record.el.style.left, top: record.el.style.top,
        width: record.el.style.width, height: record.el.style.height
      };
      record.el.classList.add('maximized');
      record.maximized = true;
    } else {
      record.el.classList.remove('maximized');
      if (record.prevRect) {
        record.el.style.left = record.prevRect.left;
        record.el.style.top = record.prevRect.top;
        record.el.style.width = record.prevRect.width;
        record.el.style.height = record.prevRect.height;
      }
      record.maximized = false;
    }
    focus(id);
  }

  function close(id) {
    var record = windows[id];
    if (!record) return;
    if (record.onClose) {
      var allow = record.onClose();
      if (allow === false) return;
    }
    record.el.remove();
    if (record.taskbarBtn) record.taskbarBtn.remove();
    delete windows[id];
    if (activeId === id) activeId = null;
  }

  function isOpen(id) { return !!windows[id]; }
  function setTitle(id, title) {
    var record = windows[id];
    if (!record) return;
    record.title = title;
    record.el.querySelector('.osw-title').textContent = title;
    if (record.taskbarBtn) record.taskbarBtn.querySelector('.os-task-label').textContent = title;
  }

  function closeAll() {
    Object.keys(windows).forEach(function (id) { close(id); });
  }

  global.AashirWM = {
    init: init,
    createWindow: createWindow,
    focus: focus,
    minimize: minimize,
    restore: restore,
    toggleMaximize: toggleMaximize,
    close: close,
    closeAll: closeAll,
    isOpen: isOpen,
    setTitle: setTitle,
    escapeHtml: escapeHtml
  };
})(window);
