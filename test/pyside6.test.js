const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { generateUi, runTool } = require('../out/tools');

// 只在测试中探测机器解释器；插件运行时绝不从 PATH 选择解释器。
const probe = spawnSync(process.env.PYSIDE6_TEST_PYTHON || 'python', ['-c', 'import sys, PySide6; print(sys.executable)'], { encoding: 'utf8' });
const available = probe.status === 0;
const basePython = probe.stdout?.trim();
const helper = path.resolve('python/qt_tool.py');
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ui version="4.0"><class>Form</class><widget class="QWidget" name="Form">
<property name="windowTitle"><string>测试窗口</string></property>
</widget><resources/><connections/></ui>`;

test('真实 PySide6：指定虚拟环境生成、替换与失败保护', { skip: !available }, async t => {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const dir = await fs.mkdtemp(path.join(base, '真实 中文 & 空格-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const environment = path.join(dir, '选中 环境');
  await execFile(basePython, ['-m', 'venv', '--without-pip', '--system-site-packages', environment]);
  const executable = path.join(environment, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = { executable, args: [], source: '测试所选环境' };
  const resource = path.join(dir, '主 窗口.ui');
  const output = path.join(dir, '主 窗口_ui.py');
  const logs = [];
  await fs.writeFile(resource, xml);
  await generateUi(python, helper, resource, ['-o', output, '--from-imports'], line => logs.push(line));
  const generated = await fs.readFile(output, 'utf8');
  assert.match(generated, /from PySide6/);
  assert.match(generated, /class Ui_Form/);
  assert.ok(logs.some(line => line.includes(`[PySide6 Utils] Python: ${executable}`)));
  await execFile(executable, ['-c', 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())', output]);
  await fs.writeFile(resource, '<invalid');
  await assert.rejects(generateUi(python, helper, resource, ['-o', output], () => {}), /执行失败/);
  assert.equal(await fs.readFile(output, 'utf8'), generated);
  await fs.writeFile(resource, xml.replace('Form', 'Updated'));
  await generateUi(python, helper, resource, ['-o', output], () => {});
  assert.match(await fs.readFile(output, 'utf8'), /class Ui_Updated/);
  // 验证真实 PySide6 入口解析的 Designer 程序，拦截 GUI 子进程以免等待窗口关闭。
  const inspected = await execFile(executable, ['-c', [
    'import json, runpy, subprocess, sys',
    'subprocess.call = lambda args, **kwargs: (print(json.dumps(args)), 0)[1]',
    'subprocess.Popen = lambda args, **kwargs: (print(json.dumps(args)), type("Process", (), {"returncode": 0, "communicate": lambda self: (b"", b"")})())[1]',
    'sys.argv = [sys.argv[1], "designer", sys.argv[2]]',
    'runpy.run_path(sys.argv[0], run_name="__main__")',
  ].join('; '), helper, resource], { encoding: 'utf8', timeout: 10000 });
  const command = JSON.parse(inspected.stdout.trim());
  assert.match(command[0].toLowerCase(), /designer/);
  assert.equal(command[command.length - 1], resource);
});

test('真实无 PySide6 环境失败，不借用系统安装', { skip: !available }, async t => {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const dir = await fs.mkdtemp(path.join(base, 'isolated-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await execFile(basePython, ['-m', 'venv', '--without-pip', dir]);
  const executable = path.join(dir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = { executable, args: [], source: '隔离环境' };
  await assert.rejects(runTool(python, helper, 'uic', ['--version'], dir, () => {}), /PySide6 is unavailable in selected Python/);
});
