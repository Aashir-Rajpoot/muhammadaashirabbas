/* =========================================================================
   AASHIR OS — Virtual File System
   Path-keyed node map, persisted to localStorage. No access to the real
   file system — this is a simulated tree entirely inside the browser.
   ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'aashiros_vfs_v1';
  var ROOT_FOLDERS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music'];
  var listeners = [];
  var state = null;

  function nowStamp() { return Date.now(); }

  function defaultState() {
    var nodes = {};
    nodes['/'] = { type: 'folder', name: 'Local Disk (C:)', children: ROOT_FOLDERS.slice(), created: nowStamp() };
    ROOT_FOLDERS.forEach(function (f) {
      nodes['/' + f] = { type: 'folder', name: f, children: [], created: nowStamp() };
    });
    nodes['/Desktop/Welcome.txt'] = {
      type: 'file', name: 'Welcome.txt',
      content: 'Welcome to AASHIR OS.\r\n\r\nRight-click anywhere on the desktop for options.\r\nDouble-click this file to edit it — your changes are saved automatically to this browser.',
      created: nowStamp(), modified: nowStamp()
    };
    nodes['/Desktop'].children.push('Welcome.txt');
    return { nodes: nodes, recycleBin: [], nextRecycleId: 1 };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.nodes || !parsed.nodes['/']) return defaultState();
      if (!parsed.recycleBin) parsed.recycleBin = [];
      if (!parsed.nextRecycleId) parsed.nextRecycleId = 1;
      return parsed;
    } catch (e) {
      console.error('[AashirOS/VFS] load failed, resetting', e);
      return defaultState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      emit();
    } catch (e) {
      console.error('[AashirOS/VFS] save failed', e);
    }
  }

  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); }

  function normalize(path) {
    if (!path || path === '') return '/';
    if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    return path;
  }

  function parentOf(path) {
    path = normalize(path);
    if (path === '/') return null;
    var idx = path.lastIndexOf('/');
    var p = path.slice(0, idx);
    return p === '' ? '/' : p;
  }

  function joinPath(dir, name) {
    dir = normalize(dir);
    return dir === '/' ? '/' + name : dir + '/' + name;
  }

  function baseName(path) {
    path = normalize(path);
    var idx = path.lastIndexOf('/');
    return idx === -1 ? path : path.slice(idx + 1);
  }

  function getNode(path) { return state.nodes[normalize(path)]; }
  function exists(path) { return !!state.nodes[normalize(path)]; }

  function listChildren(path) {
    path = normalize(path);
    var node = getNode(path);
    if (!node || node.type !== 'folder') return [];
    return node.children.slice().sort(function (a, b) {
      var na = getNode(joinPath(path, a)), nb = getNode(joinPath(path, b));
      var ta = na && na.type === 'folder' ? 0 : 1;
      var tb = nb && nb.type === 'folder' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b);
    }).map(function (name) { return joinPath(path, name); });
  }

  function uniqueName(dirPath, baseNm, ext) {
    ext = ext || '';
    var node = getNode(dirPath);
    var taken = {};
    if (node && node.children) node.children.forEach(function (c) { taken[c] = true; });
    var candidate = baseNm + ext;
    if (!taken[candidate]) return candidate;
    var n = 2;
    while (taken[baseNm + ' (' + n + ')' + ext]) n++;
    return baseNm + ' (' + n + ')' + ext;
  }

  function splitExt(name) {
    var idx = name.lastIndexOf('.');
    if (idx <= 0) return { base: name, ext: '' };
    return { base: name.slice(0, idx), ext: name.slice(idx) };
  }

  function createFolder(dirPath, desiredName) {
    dirPath = normalize(dirPath);
    var dir = getNode(dirPath);
    if (!dir || dir.type !== 'folder') throw new Error('Destination is not a folder');
    var name = uniqueName(dirPath, desiredName || 'New Folder');
    var path = joinPath(dirPath, name);
    state.nodes[path] = { type: 'folder', name: name, children: [], created: nowStamp() };
    dir.children.push(name);
    persist();
    return path;
  }

  function createFile(dirPath, desiredName, content) {
    dirPath = normalize(dirPath);
    var dir = getNode(dirPath);
    if (!dir || dir.type !== 'folder') throw new Error('Destination is not a folder');
    var parts = splitExt(desiredName || 'New Text Document.txt');
    var name = uniqueName(dirPath, parts.base, parts.ext);
    var path = joinPath(dirPath, name);
    state.nodes[path] = { type: 'file', name: name, content: content || '', created: nowStamp(), modified: nowStamp() };
    dir.children.push(name);
    persist();
    return path;
  }

  function writeFile(path, content) {
    var node = getNode(path);
    if (!node || node.type !== 'file') throw new Error('Not a file: ' + path);
    node.content = content;
    node.modified = nowStamp();
    persist();
  }

  function rename(path, newName) {
    path = normalize(path);
    var node = getNode(path);
    if (!node) throw new Error('Not found: ' + path);
    var dirPath = parentOf(path);
    var dir = getNode(dirPath);
    var finalName = newName;
    if (dir.children.indexOf(newName) !== -1 && newName !== node.name) {
      var parts = splitExt(newName);
      finalName = uniqueName(dirPath, parts.base, parts.ext);
    }
    var newPath = joinPath(dirPath, finalName);
    // move node (and subtree) to new key
    moveSubtreeKey(path, newPath);
    dir.children[dir.children.indexOf(baseName(path))] = finalName;
    state.nodes[newPath].name = finalName;
    persist();
    return newPath;
  }

  function moveSubtreeKey(oldPath, newPath) {
    var node = state.nodes[oldPath];
    if (!node) return;
    delete state.nodes[oldPath];
    state.nodes[newPath] = node;
    if (node.type === 'folder') {
      node.children.forEach(function (childName) {
        moveSubtreeKey(joinPath(oldPath, childName), joinPath(newPath, childName));
      });
    }
  }

  function removeFromParentChildren(path) {
    var dirPath = parentOf(path);
    var dir = getNode(dirPath);
    if (dir) {
      var idx = dir.children.indexOf(baseName(path));
      if (idx !== -1) dir.children.splice(idx, 1);
    }
  }

  function snapshotSubtree(path) {
    var node = state.nodes[path];
    var copy = JSON.parse(JSON.stringify(node));
    if (node.type === 'folder') {
      copy.childSnapshots = {};
      node.children.forEach(function (c) {
        copy.childSnapshots[c] = snapshotSubtree(joinPath(path, c));
      });
    }
    return copy;
  }

  function purgeSubtreeFromNodes(path) {
    var node = state.nodes[path];
    if (!node) return;
    if (node.type === 'folder') {
      node.children.forEach(function (c) { purgeSubtreeFromNodes(joinPath(path, c)); });
    }
    delete state.nodes[path];
  }

  function restoreSnapshotIntoNodes(path, snap) {
    var clean = { type: snap.type, name: snap.name, created: snap.created, modified: snap.modified };
    if (snap.type === 'file') clean.content = snap.content;
    if (snap.type === 'folder') {
      clean.children = Object.keys(snap.childSnapshots || {});
      state.nodes[path] = clean;
      Object.keys(snap.childSnapshots || {}).forEach(function (c) {
        restoreSnapshotIntoNodes(joinPath(path, c), snap.childSnapshots[c]);
      });
    } else {
      state.nodes[path] = clean;
    }
  }

  // Soft-delete: move a node (file or folder, recursively) into the recycle bin.
  function deleteNode(path) {
    path = normalize(path);
    if (path === '/' || ROOT_FOLDERS.indexOf(baseName(path)) !== -1 && parentOf(path) === '/') {
      throw new Error('This item cannot be deleted.');
    }
    var node = getNode(path);
    if (!node) throw new Error('Not found: ' + path);
    var snap = snapshotSubtree(path);
    var entry = {
      id: state.nextRecycleId++,
      originalPath: path,
      originalParent: parentOf(path),
      name: node.name,
      type: node.type,
      snapshot: snap,
      deletedAt: nowStamp()
    };
    state.recycleBin.push(entry);
    removeFromParentChildren(path);
    purgeSubtreeFromNodes(path);
    persist();
    return entry.id;
  }

  function restoreFromRecycle(id) {
    var idx = state.recycleBin.findIndex(function (e) { return e.id === id; });
    if (idx === -1) throw new Error('Recycle bin item not found');
    var entry = state.recycleBin[idx];
    var destDir = exists(entry.originalParent) ? entry.originalParent : '/Desktop';
    var destDirNode = getNode(destDir);
    var name = entry.name;
    if (destDirNode.children.indexOf(name) !== -1) {
      var parts = splitExt(name);
      name = uniqueName(destDir, parts.base, parts.ext);
    }
    var newPath = joinPath(destDir, name);
    entry.snapshot.name = name;
    restoreSnapshotIntoNodes(newPath, entry.snapshot);
    destDirNode.children.push(name);
    state.recycleBin.splice(idx, 1);
    persist();
    return newPath;
  }

  function purgeFromRecycle(id) {
    var idx = state.recycleBin.findIndex(function (e) { return e.id === id; });
    if (idx === -1) return;
    state.recycleBin.splice(idx, 1);
    persist();
  }

  function emptyRecycleBin() {
    state.recycleBin = [];
    persist();
  }

  function listRecycleBin() { return state.recycleBin.slice().sort(function (a, b) { return b.deletedAt - a.deletedAt; }); }

  function copyNode(srcPath, destDir) {
    var node = getNode(srcPath);
    if (!node) throw new Error('Not found: ' + srcPath);
    return copyRecursive(srcPath, node, destDir);
  }

  function copyRecursive(srcPath, node, destDir) {
    var destDirNode = getNode(destDir);
    if (!destDirNode || destDirNode.type !== 'folder') throw new Error('Destination is not a folder');
    if (node.type === 'file') {
      var parts = splitExt(node.name);
      var name = uniqueName(destDir, parts.base, parts.ext);
      var path = joinPath(destDir, name);
      state.nodes[path] = { type: 'file', name: name, content: node.content, created: nowStamp(), modified: nowStamp() };
      destDirNode.children.push(name);
      return path;
    } else {
      var fname = uniqueName(destDir, node.name);
      var fpath = joinPath(destDir, fname);
      state.nodes[fpath] = { type: 'folder', name: fname, children: [], created: nowStamp() };
      destDirNode.children.push(fname);
      node.children.forEach(function (c) {
        copyRecursive(joinPath(srcPath, c), state.nodes[joinPath(srcPath, c)], fpath);
      });
      return fpath;
    }
  }

  function moveNode(srcPath, destDir) {
    srcPath = normalize(srcPath);
    destDir = normalize(destDir);
    if (destDir === srcPath || destDir.indexOf(srcPath + '/') === 0) {
      throw new Error('Cannot move a folder into itself.');
    }
    var node = getNode(srcPath);
    if (!node) throw new Error('Not found: ' + srcPath);
    var destDirNode = getNode(destDir);
    if (!destDirNode || destDirNode.type !== 'folder') throw new Error('Destination is not a folder');
    var name = node.name;
    if (destDirNode.children.indexOf(name) !== -1) {
      var parts = splitExt(name);
      name = uniqueName(destDir, parts.base, parts.ext);
    }
    var newPath = joinPath(destDir, name);
    removeFromParentChildren(srcPath);
    moveSubtreeKey(srcPath, newPath);
    state.nodes[newPath].name = name;
    destDirNode.children.push(name);
    persist();
    return newPath;
  }

  function isFolder(path) { var n = getNode(path); return !!n && n.type === 'folder'; }
  function isFile(path) { var n = getNode(path); return !!n && n.type === 'file'; }

  function resetAll() {
    state = defaultState();
    persist();
  }

  state = load();

  global.AashirVFS = {
    ROOT_FOLDERS: ROOT_FOLDERS,
    normalize: normalize,
    parentOf: parentOf,
    joinPath: joinPath,
    baseName: baseName,
    getNode: getNode,
    exists: exists,
    isFolder: isFolder,
    isFile: isFile,
    listChildren: listChildren,
    createFolder: createFolder,
    createFile: createFile,
    writeFile: writeFile,
    rename: rename,
    deleteNode: deleteNode,
    copyNode: copyNode,
    moveNode: moveNode,
    listRecycleBin: listRecycleBin,
    restoreFromRecycle: restoreFromRecycle,
    purgeFromRecycle: purgeFromRecycle,
    emptyRecycleBin: emptyRecycleBin,
    onChange: onChange,
    resetAll: resetAll
  };
})(window);
