import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { resolvePython, PythonHost } from './python';
import { defaultOptions, resolveOptions } from './options';
import { GenerationQueue } from './queue';
import { generateUi, runTool } from './tools';

function isUi(uri: vscode.Uri): boolean {
  return uri.scheme === 'file' && path.extname(uri.fsPath).toLowerCase() === '.ui';
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('PySide6 Utils');
  context.subscriptions.push(output);
  const log = (message: string) => output.appendLine(`[${new Date().toISOString()}] ${message}`);
  const report = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    log(`错误：${message}`);
    void vscode.window.showErrorMessage(`PySide6 Utils：${message.slice(0, 500)}`, '显示日志')
      .then(action => { if (action === '显示日志') { output.show(true); } });
  };
  const host: PythonHost = {
    activate: async id => {
      const extension = vscode.extensions.getExtension(id);
      return extension ? (extension.isActive ? extension.exports : await extension.activate()) : undefined;
    },
    useEnvironmentsExtension: uri => vscode.workspace.getConfiguration('python', uri).get<boolean>('useEnvironmentsExtension'),
  };
  const helper = context.asAbsolutePath(path.join('python', 'qt_tool.py'));
  const enabled = (uri: vscode.Uri) => vscode.workspace.isTrusted && isUi(uri) &&
    vscode.workspace.getConfiguration('pyside6Utils', uri).get<boolean>('uic.liveExecution.enabled', true);
  const queue = new GenerationQueue<vscode.Uri>(async uri => {
    if (!enabled(uri)) { return; }
    try {
      if (!(await fs.stat(uri.fsPath)).isFile()) { return; }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { return; }
      throw error;
    }
    const config = vscode.workspace.getConfiguration('pyside6Utils', uri);
    const options = resolveOptions(config.get('uic.options', defaultOptions), uri.fsPath,
      vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath);
    const python = await resolvePython(uri, host);
    await generateUi(python, helper, uri.fsPath, options, log);
  }, report);
  const schedule = (uri: vscode.Uri) => {
    if (enabled(uri)) { queue.schedule(uri.toString(), uri); }
  };
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.[uU][iI]');
  context.subscriptions.push(queue, watcher,
    watcher.onDidCreate(schedule), watcher.onDidChange(schedule),
    watcher.onDidDelete(uri => queue.cancel(uri.toString())),
    vscode.workspace.onDidSaveTextDocument(document => schedule(document.uri)),
    vscode.commands.registerCommand('pyside6Utils.editUi', async (resource?: vscode.Uri) => {
      try {
        if (!vscode.workspace.isTrusted) { throw new Error('请先信任工作区，再运行 Qt Designer。'); }
        const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
        if (!uri || !(uri instanceof vscode.Uri) || !isUi(uri) || !(await fs.stat(uri.fsPath)).isFile()) {
          throw new Error('请选择一个已保存的 .ui 文件。');
        }
        const document = vscode.workspace.textDocuments.find(item => item.uri.toString() === uri.toString());
        if (document?.isDirty && !await document.save()) { throw new Error('UI 文件保存失败，未启动 Designer。'); }
        // 工作区外单独打开的 UI 也需要接收 Designer 的外部保存事件。
        if (!vscode.workspace.getWorkspaceFolder(uri) && !externalWatchers.has(uri.toString())) {
          const external = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(uri.fsPath), path.basename(uri.fsPath)));
          externalWatchers.add(uri.toString());
          context.subscriptions.push(external, external.onDidChange(schedule), external.onDidCreate(schedule));
        }
        const python = await resolvePython(uri, host);
        // Designer 长期运行，命令无需等待窗口关闭，但异步失败仍进入日志与通知。
        void runTool(python, helper, 'designer', [uri.fsPath], path.dirname(uri.fsPath), log).catch(report);
      } catch (error) { report(error); }
    }),
  );
  const externalWatchers = new Set<string>();
  log('已启动，监听 UI 文件变化。');
}
