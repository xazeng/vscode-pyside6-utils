const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { generateUi, runTool } = require('../out/tools');

async function fixture(t) {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const dir = await fs.mkdtemp(path.join(base, '中文 空格 & $-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const helper = path.join(dir, 'fake tool.js');
  const resource = path.join(dir, '窗口.ui');
  await fs.writeFile(resource, 'valid');
  await fs.writeFile(helper, `
    const fs = require('fs');
    const args = process.argv.slice(3);
    const source = args[args.length - 1];
    const outputIndex = args.indexOf('-o');
    const output = outputIndex < 0 ? undefined : args[outputIndex + 1];
    if (output) fs.writeFileSync(output, 'generated ' + source);
    if (fs.readFileSync(source, 'utf8') === 'invalid') {
      console.error('invalid UI'); process.exit(1);
    }
    console.error('warning only');
  `);
  return { dir, helper, resource, python: { executable: process.execPath, args: [], source: 'test' } };
}

test('无 shell 执行支持中文及特殊字符路径，stderr 警告不判失败', async t => {
  const f = await fixture(t);
  const log = [];
  await generateUi(f.python, f.helper, f.resource, ['-o', '输出.py'], message => log.push(message));
  assert.equal(await fs.readFile(path.join(f.dir, '输出.py'), 'utf8'), `generated ${f.resource}`);
  assert.ok(log.some(line => line.includes('warning only')));
});

test('uic 失败保留旧输出并清理临时文件，修复后可再次生成', async t => {
  const f = await fixture(t);
  const output = path.join(f.dir, '输出.py');
  await fs.writeFile(output, 'old');
  await fs.writeFile(f.resource, 'invalid');
  await assert.rejects(generateUi(f.python, f.helper, f.resource, ['-o', output], () => {}), /invalid UI/);
  assert.equal(await fs.readFile(output, 'utf8'), 'old');
  assert.ok(!(await fs.readdir(f.dir)).some(name => name.endsWith('.tmp')));
  await fs.writeFile(f.resource, 'valid');
  await generateUi(f.python, f.helper, f.resource, ['-o', output], () => {});
  assert.match(await fs.readFile(output, 'utf8'), /^generated/);
});

test('拒绝输出覆盖 UI、重复输出路径，进程启动失败可捕获', async t => {
  const f = await fixture(t);
  await assert.rejects(generateUi(f.python, f.helper, f.resource, ['-o', f.resource], () => {}), /源 UI/);
  await assert.rejects(generateUi(f.python, f.helper, f.resource, ['-o', 'other.ui'], () => {}), /循环/);
  await assert.rejects(generateUi(f.python, f.helper, f.resource, ['-o', 'a.py', '-o', 'b.py'], () => {}), /一个输出/);
  await assert.rejects(runTool({ ...f.python, executable: path.join(f.dir, 'missing') }, f.helper, 'uic', [], f.dir, () => {}), /ENOENT/);
});
