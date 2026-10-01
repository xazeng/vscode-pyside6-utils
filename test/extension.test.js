const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs/promises');
const path = require('node:path');

function event() {
  const listeners = new Set();
  return {
    subscribe: fn => { listeners.add(fn); return { dispose: () => listeners.delete(fn) }; },
    fire: value => { for (const fn of listeners) fn(value); },
  };
}

test('扩展接收外部保存与编辑器保存，按文件读取设置并响应关闭开关', async t => {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const dir = await fs.mkdtemp(path.join(base, 'extension-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  class Uri {
    constructor(file) { this.scheme = 'file'; this.fsPath = file; }
    toString() { return this.fsPath; }
  }
  const uri = new Uri(path.join(dir, 'window.ui'));
  await fs.writeFile(uri.fsPath, 'UI');
  const changed = event(), created = event(), deleted = event(), saved = event();
  let enabled = true;
  const generations = [], edits = [], errors = [], commands = new Map();
  const mock = {
    Uri,
    RelativePattern: class {},
    window: {
      createOutputChannel: () => ({ appendLine() {}, dispose() {}, show() {} }),
      showErrorMessage: async text => { errors.push(text); },
    },
    extensions: { getExtension: () => undefined },
    commands: { registerCommand: (name, fn) => { commands.set(name, fn); return { dispose() {} }; } },
    workspace: {
      isTrusted: true, textDocuments: [],
      getConfiguration: (section, file) => {
        assert.equal(file, uri);
        return { get: (name, fallback) => name === 'uic.liveExecution.enabled' ? enabled : fallback };
      },
      getWorkspaceFolder: () => ({ uri: { fsPath: dir } }),
      createFileSystemWatcher: () => ({ onDidChange: changed.subscribe, onDidCreate: created.subscribe, onDidDelete: deleted.subscribe, dispose() {} }),
      onDidSaveTextDocument: saved.subscribe,
    },
  };
  const load = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === 'vscode') return mock;
    if (parent?.filename.endsWith(`${path.sep}extension.js`) && name === './python') {
      return { resolvePython: async file => { assert.equal(file, uri); return {}; } };
    }
    if (parent?.filename.endsWith(`${path.sep}extension.js`) && name === './tools') {
      return { generateUi: async (...args) => generations.push(args), runTool: async (...args) => edits.push(args) };
    }
    return load.call(this, name, parent, isMain);
  };
  let extension;
  try { extension = require('../out/extension'); } finally { Module._load = load; }
  const context = { subscriptions: [], asAbsolutePath: file => path.resolve(file) };
  extension.activate(context);
  t.after(() => context.subscriptions.forEach(item => item.dispose()));
  changed.fire(uri);
  saved.fire({ uri });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(generations.length, 1);
  assert.equal(generations[0][2], uri.fsPath);
  assert.deepEqual(generations[0][3], ['-o', path.join(dir, 'window_ui.py')]);
  enabled = false;
  changed.fire(uri);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(generations.length, 1);
  await commands.get('pyside6Utils.editUi')(uri);
  assert.equal(edits.length, 1);
  assert.equal(edits[0][2], 'designer');
  mock.workspace.isTrusted = false;
  await commands.get('pyside6Utils.editUi')(uri);
  assert.equal(edits.length, 1);
  assert.match(errors[0], /信任工作区/);
});
