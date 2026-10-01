import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type { PythonCommand } from './python';

export type Log = (message: string) => void;

/** 不经 shell 拼接，保证带空格、中文及 shell 元字符的路径作为普通参数传递。 */
export function runTool(python: PythonCommand, helper: string, tool: 'uic' | 'designer',
  args: string[], cwd: string, log: Log): Promise<void> {
  log(`${tool} | ${python.source} | ${JSON.stringify([python.executable, ...python.args, helper, tool, ...args])}`);
  return new Promise((resolve, reject) => {
    const child = spawn(python.executable, [...python.args, helper, tool, ...args], {
      cwd, shell: false, windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostic = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data: string) => log(data.trimEnd()));
    child.stderr.on('data', (data: string) => {
      diagnostic = (diagnostic + data).slice(-6000);
      log(data.trimEnd());
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) { resolve(); }
      else { reject(new Error(`${tool} 执行失败（${code ?? signal}）：${diagnostic.trim()}`)); }
    });
  });
}

/** 先生成临时文件，成功后替换目标，避免无效 UI 破坏上一次生成结果。 */
export async function generateUi(python: PythonCommand, helper: string, resource: string,
  options: string[], log: Log): Promise<void> {
  const args = [...options];
  const outputs: { index: number; inline: boolean; value: string }[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '-o' || arg === '--output') {
      const value = args[++index];
      if (!value || value.startsWith('-')) { throw new Error('uic 输出参数缺少文件路径。'); }
      outputs.push({ index, inline: false, value });
    } else if (arg.startsWith('--output=')) {
      outputs.push({ index, inline: true, value: arg.slice('--output='.length) });
    }
  }
  if (outputs.length > 1) { throw new Error('uic.options 只能指定一个输出路径。'); }
  const output = outputs[0];
  if (!output) {
    await runTool(python, helper, 'uic', [...args, resource], path.dirname(resource), log);
    return;
  }
  if (!output.value) { throw new Error('uic 输出路径不能为空。'); }
  const destination = path.resolve(path.dirname(resource), output.value);
  if (destination.toLowerCase() === resource.toLowerCase()) {
    throw new Error('uic 输出路径不能覆盖源 UI 文件。');
  }
  if (path.extname(destination).toLowerCase() === '.ui') {
    throw new Error('uic 输出不能是 .ui 文件，以免触发循环生成。');
  }
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomBytes(8).toString('hex')}.tmp`);
  args[output.index] = output.inline ? `--output=${temporary}` : temporary;
  try {
    await runTool(python, helper, 'uic', [...args, resource], path.dirname(resource), log);
    await fs.rename(temporary, destination);
    log(`已生成：${destination}`);
  } finally {
    await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') { log(`清理临时文件失败：${error.message}`); }
    });
  }
}
