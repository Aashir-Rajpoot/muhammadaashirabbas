/* =========================================================================
   AASHIR OS — Terminal
   A simulated command-line shell operating entirely on the virtual
   filesystem. All network-looking output (ipconfig, hostname, etc.) is
   fabricated for realism only — nothing here touches the real machine.
   ========================================================================= */
(function (global) {
  'use strict';

  var VFS = global.AashirVFS;
  var WM = global.AashirWM;

  var HELP_TEXT = [
    'AASHIR OS TERMINAL — simulated command list',
    '',
    'help              Show this help',
    'clear / cls       Clear the screen',
    'dir / ls          List contents of the current folder',
    'cd <path>         Change directory (.. for up, / for root)',
    'pwd               Print working directory',
    'mkdir <name>      Create a folder',
    'touch <name>      Create an empty text file',
    'rename <a> <b>    Rename a file or folder',
    'del <name>        Delete a file/folder (moves to Recycle Bin)',
    'copy <a> <b>      Copy a file/folder into folder b',
    'move <a> <b>      Move a file/folder into folder b',
    'type <name>       Print a text file\'s contents',
    'echo <text>       Print text',
    'date              Show the current date',
    'time              Show the current time',
    'whoami            Show the current user',
    'hostname          Show the machine name',
    'ipconfig          Show simulated network configuration',
    'systeminfo        Show simulated system information',
    'ver               Show the AASHIR OS version',
    'tree              Show the folder tree from here down'
  ].join('\n');

  function openTerminal() {
    var winId = 'terminal';
    if (WM.isOpen(winId)) { WM.focus(winId); return; }

    var cwd = '/Desktop';

    var wrap = document.createElement('div');
    wrap.className = 'os-app os-terminal';
    wrap.innerHTML =
      '<div class="os-term-output"></div>' +
      '<div class="os-term-inputline">' +
        '<span class="os-term-prompt"></span>' +
        '<input type="text" class="os-term-input" spellcheck="false" autocomplete="off">' +
      '</div>';
    var output = wrap.querySelector('.os-term-output');
    var input = wrap.querySelector('.os-term-input');
    var promptEl = wrap.querySelector('.os-term-prompt');

    var history = [];
    var histPos = -1;

    function print(text, cls) {
      var line = document.createElement('div');
      line.className = 'os-term-line' + (cls ? ' ' + cls : '');
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }
    function printRaw(html) {
      var line = document.createElement('div');
      line.className = 'os-term-line';
      line.innerHTML = html;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }

    function updatePrompt() {
      promptEl.textContent = 'AASHIR-OS ' + cwd + ' >';
    }

    function resolvePath(arg) {
      if (!arg) return cwd;
      if (arg === '.') return cwd;
      if (arg === '/' ) return '/';
      if (arg.charAt(0) === '/') return VFS.normalize(arg);
      var parts = arg.split('/');
      var acc = cwd;
      parts.forEach(function (p) {
        if (p === '' || p === '.') return;
        if (p === '..') { acc = VFS.parentOf(acc) || '/'; }
        else { acc = VFS.joinPath(acc, p); }
      });
      return acc;
    }

    function fakeMac() { return '4A-EF-9C-1B-77-0' + (Math.floor(Math.random() * 9)); }

    var COMMANDS = {
      help: function () { print(HELP_TEXT); },
      clear: function () { output.innerHTML = ''; },
      cls: function () { output.innerHTML = ''; },
      pwd: function () { print(cwd); },
      dir: function () { listDir(); },
      ls: function () { listDir(); },
      whoami: function () { print('aashir-os\\admin'); },
      hostname: function () { print('AASHIR-OS-PC'); },
      ver: function () { print('AASHIR OS [Version 2.6.0]'); },
      date: function () { print(new Date().toDateString()); },
      time: function () { print(new Date().toLocaleTimeString()); },
      echo: function (args) { print(args.join(' ')); },
      ipconfig: function () {
        printRaw(
          'Windows IP Configuration (simulated)<br><br>' +
          'Ethernet adapter Aashir Network:<br><br>' +
          '&nbsp;&nbsp;&nbsp;Connection-specific DNS Suffix&nbsp;: aashir.local<br>' +
          '&nbsp;&nbsp;&nbsp;IPv4 Address. . . . . . . . . . : 192.168.1.100<br>' +
          '&nbsp;&nbsp;&nbsp;Subnet Mask . . . . . . . . . . : 255.255.255.0<br>' +
          '&nbsp;&nbsp;&nbsp;Default Gateway . . . . . . . . : 192.168.1.1'
        );
      },
      systeminfo: function () {
        printRaw(
          'Host Name:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;AASHIR-OS-PC (simulated)<br>' +
          'OS Name:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;AASHIR OS<br>' +
          'OS Version:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2.6.0 // STABLE<br>' +
          'System Type:&nbsp;&nbsp;&nbsp;&nbsp;Browser-based virtual environment<br>' +
          'MAC Address:&nbsp;&nbsp;&nbsp;' + fakeMac()
        );
      },
      tree: function () {
        var lines = [];
        (function walk(path, depth) {
          var children = VFS.listChildren(path);
          children.forEach(function (c) {
            var n = VFS.getNode(c);
            lines.push('  '.repeat(depth) + (n.type === 'folder' ? '📁 ' : '📄 ') + n.name);
            if (n.type === 'folder') walk(c, depth + 1);
          });
        })(cwd, 0);
        print(lines.length ? lines.join('\n') : '(empty)');
      },
      cd: function (args) {
        if (!args[0]) { print(cwd); return; }
        var target = resolvePath(args[0]);
        if (!VFS.exists(target)) { print('The system cannot find the path specified: ' + args[0], 'os-term-err'); return; }
        if (!VFS.isFolder(target)) { print('Not a directory: ' + args[0], 'os-term-err'); return; }
        cwd = target;
        updatePrompt();
      },
      mkdir: function (args) {
        if (!args[0]) { print('Usage: mkdir <name>', 'os-term-err'); return; }
        VFS.createFolder(cwd, args[0]);
      },
      touch: function (args) {
        if (!args[0]) { print('Usage: touch <name>', 'os-term-err'); return; }
        VFS.createFile(cwd, args[0], '');
      },
      rename: function (args) {
        if (args.length < 2) { print('Usage: rename <old> <new>', 'os-term-err'); return; }
        var target = resolvePath(args[0]);
        if (!VFS.exists(target)) { print('File not found: ' + args[0], 'os-term-err'); return; }
        VFS.rename(target, args[1]);
      },
      del: function (args) {
        if (!args[0]) { print('Usage: del <name>', 'os-term-err'); return; }
        var target = resolvePath(args[0]);
        if (!VFS.exists(target)) { print('File not found: ' + args[0], 'os-term-err'); return; }
        VFS.deleteNode(target);
        print(args[0] + ' moved to Recycle Bin.');
      },
      rmdir: function (args) { COMMANDS.del(args); },
      copy: function (args) {
        if (args.length < 2) { print('Usage: copy <source> <destFolder>', 'os-term-err'); return; }
        var src = resolvePath(args[0]);
        var dest = resolvePath(args[1]);
        if (!VFS.exists(src)) { print('File not found: ' + args[0], 'os-term-err'); return; }
        if (!VFS.isFolder(dest)) { print('Destination is not a folder: ' + args[1], 'os-term-err'); return; }
        VFS.copyNode(src, dest);
        print('1 item copied.');
      },
      move: function (args) {
        if (args.length < 2) { print('Usage: move <source> <destFolder>', 'os-term-err'); return; }
        var src = resolvePath(args[0]);
        var dest = resolvePath(args[1]);
        if (!VFS.exists(src)) { print('File not found: ' + args[0], 'os-term-err'); return; }
        if (!VFS.isFolder(dest)) { print('Destination is not a folder: ' + args[1], 'os-term-err'); return; }
        try { VFS.moveNode(src, dest); print('1 item moved.'); }
        catch (e) { print(e.message, 'os-term-err'); }
      },
      type: function (args) {
        if (!args[0]) { print('Usage: type <name>', 'os-term-err'); return; }
        var target = resolvePath(args[0]);
        var n = VFS.getNode(target);
        if (!n) { print('File not found: ' + args[0], 'os-term-err'); return; }
        if (n.type !== 'file') { print('Access is denied. (' + args[0] + ' is a folder)', 'os-term-err'); return; }
        print(n.content || '(empty file)');
      }
    };

    function listDir() {
      var children = VFS.listChildren(cwd);
      if (children.length === 0) { print('(empty)'); return; }
      var lines = children.map(function (c) {
        var n = VFS.getNode(c);
        return (n.type === 'folder' ? '<DIR>  ' : '       ') + n.name;
      });
      print(lines.join('\n'));
    }

    function run(raw) {
      var line = raw.trim();
      if (!line) return;
      print(promptEl.textContent + ' ' + raw);
      history.push(raw);
      histPos = history.length;
      var parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      parts = parts.map(function (p) { return p.replace(/^"|"$/g, ''); });
      var cmd = parts[0].toLowerCase();
      var args = parts.slice(1);
      if (COMMANDS[cmd]) {
        try { COMMANDS[cmd](args); }
        catch (e) { print('Error: ' + e.message, 'os-term-err'); }
      } else {
        print('\'' + cmd + '\' is not recognized as an internal or external command. Type help for a list.', 'os-term-err');
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var val = input.value;
        input.value = '';
        run(val);
      } else if (e.key === 'ArrowUp') {
        if (histPos > 0) { histPos--; input.value = history[histPos]; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (histPos < history.length - 1) { histPos++; input.value = history[histPos]; }
        else { histPos = history.length; input.value = ''; }
        e.preventDefault();
      }
    });

    wrap.addEventListener('click', function () { input.focus(); });

    updatePrompt();
    print('AASHIR OS TERMINAL [Version 2.6.0]');
    print('Type "help" to see the list of simulated commands.');
    print('');

    WM.createWindow({
      id: winId, title: 'AASHIR OS TERMINAL', icon: '⌁',
      width: 620, height: 420, content: wrap,
      onClose: function () { return true; }
    });
    setTimeout(function () { input.focus(); }, 50);
  }

  global.AashirTerminal = { openTerminal: openTerminal };
})(window);
