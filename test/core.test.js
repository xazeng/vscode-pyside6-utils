const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolvePython } = require('../out/python');
const { resolveOptions, defaultOptions } = require('../out/options');
const { GenerationQueue } = require('../out/queue');

const resource = { fsPath: path.resolve('第一 项目', 'window.ui') };
const executable = path.resolve('虚拟 环境', 'python.exe');
function host(python, environments, enabled) {
  return {
    activate: async id => id === 'ms-python.python' ? python : environments,
    useEnvironmentsExtension: () => enabled,
  };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('新版环境 API 优先并按文件 URI 查询；保留激活命令参数', async () => {
  const api = { getEnvironment: async uri => {
    assert.equal(uri, resource);
    return { execInfo: { run: { executable: 'wrong' }, activatedRun: { executable, args: ['-I'] } } };
  } };
  const selected = await resolvePython(resource, host({}, api));
  assert.deepEqual(selected, { executable, args: ['-I'], source: 'Python Environments' });
});

test('新 API 未选环境或环境损坏时，不回退系统或旧 API', async () => {
  const python = { settings: { getExecutionDetails: () => { throw new Error('不应调用'); } } };
  await assert.rejects(resolvePython(resource, host(python, { getEnvironment: async () => undefined })), /尚未选择/);
  await assert.rejects(resolvePython(resource, host(python, { getEnvironment: async () => ({ error: 'broken' }) })), /broken/);
});

test('经典环境 API 解析环境目录；每次操作读取新的选择', async () => {
  let current = executable;
  const python = { environments: {
    getActiveEnvironmentPath: uri => { assert.equal(uri, resource); return { path: current }; },
    resolveEnvironment: async selected => ({ executable: { uri: { fsPath: selected.path } } }),
  } };
  const adapter = host(python, undefined);
  assert.equal((await resolvePython(resource, adapter)).executable, current);
  current = path.resolve('第二环境', 'python.exe');
  assert.equal((await resolvePython(resource, adapter)).executable, current);
});

test('显式关闭新环境扩展时使用经典 API；旧接口仍保留参数', async () => {
  const python = { settings: { getExecutionDetails: uri => {
    assert.equal(uri, resource); return { execCommand: [executable, '-I'] };
  } } };
  const selected = await resolvePython(resource, host(python, { getEnvironment: () => { throw new Error('不应调用'); } }, false));
  assert.deepEqual(selected, { executable, args: ['-I'], source: 'Python legacy API' });
});

test('拒绝 PATH 中的裸 python 和不可解析环境，避免静默使用系统环境', async () => {
  await assert.rejects(resolvePython(resource, host({ settings: { getExecutionDetails: () => ({ execCommand: ['python'] }) } })), /绝对路径/);
  await assert.rejects(resolvePython(resource, host({ environments: {
    getActiveEnvironmentPath: () => ({ path: executable }), resolveEnvironment: async () => undefined,
  } })), /绝对路径/);
  await assert.rejects(resolvePython(resource, host(undefined)), /Microsoft Python/);
});

test('等待 Python 扩展就绪后获取解释器', async () => {
  let ready = false;
  const python = {
    ready: Promise.resolve().then(() => { ready = true; }),
    settings: { getExecutionDetails: () => { assert.ok(ready); return { execCommand: [executable] }; } },
  };
  await resolvePython(resource, host(python));
});

test('默认输出和变量基于目标 UI，并保留中文、空格及参数边界', () => {
  const root = path.resolve('工作 区');
  const ui = path.join(root, '窗口 & $', '主窗口.ui');
  assert.deepEqual(resolveOptions(defaultOptions, ui, root), ['-o', path.join(root, '窗口 & $', '主窗口_ui.py')]);
  assert.deepEqual(resolveOptions(['${workspaceFolder}', '${file}', '${relativeResource}', '--from-imports'], ui, root),
    [root, ui, path.join('窗口 & $', '主窗口.ui'), '--from-imports']);
  assert.throws(() => resolveOptions(['${unknown}'], ui), /无法解析/);
  assert.throws(() => resolveOptions(['${workspaceFolder}'], ui), /无法解析/);
  assert.throws(() => resolveOptions('invalid', ui), /字符串数组/);
});

test('连续保存防抖，执行期间再次修改会串行生成', async () => {
  const values = [];
  let finish;
  const queue = new GenerationQueue(async value => {
    values.push(value);
    if (values.length === 1) { await new Promise(resolve => { finish = resolve; }); }
  }, error => assert.fail(String(error)), 10);
  queue.schedule('ui', 1);
  queue.schedule('ui', 2);
  await sleep(30);
  assert.deepEqual(values, [2]);
  queue.schedule('ui', 3);
  await sleep(30);
  assert.deepEqual(values, [2]);
  finish();
  await sleep(30);
  assert.deepEqual(values, [2, 3]);
  queue.dispose();
});

test('失败不阻塞下一次生成；取消和释放阻止待执行任务', async () => {
  const values = [], errors = [];
  const queue = new GenerationQueue(async value => {
    values.push(value);
    if (value === 1) { throw new Error('bad UI'); }
  }, error => errors.push(error), 10);
  queue.schedule('ui', 1);
  await sleep(30);
  queue.schedule('ui', 2);
  await sleep(30);
  queue.schedule('ui', 3);
  queue.cancel('ui');
  queue.schedule('other', 4);
  queue.dispose();
  await sleep(30);
  assert.deepEqual(values, [1, 2]);
  assert.equal(errors.length, 1);
});
