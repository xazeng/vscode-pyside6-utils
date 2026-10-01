import * as os from 'os';
import * as path from 'path';

export const defaultOptions = ['-o', '${resourceDirname}${pathSeparator}${resourceBasenameNoExtension}_ui.py'];

/** 所有文件变量均以本次处理的 UI 为准，不依赖当前编辑器。 */
export function resolveOptions(options: unknown, resource: string, workspaceFolder?: string): string[] {
  if (!Array.isArray(options) || options.some(value => typeof value !== 'string' || value.includes('\0'))) {
    throw new Error('pyside6Utils.uic.options 必须是字符串数组，且不能包含空字符。');
  }
  const parsed = path.parse(resource);
  const relative = workspaceFolder ? path.relative(workspaceFolder, resource) : path.basename(resource);
  const values: Record<string, string | undefined> = {
    userHome: os.homedir(), pathSeparator: path.sep,
    workspaceFolder, workspaceFolderBasename: workspaceFolder && path.basename(workspaceFolder),
    resource, resourceDirname: parsed.dir, resourceBasename: parsed.base,
    resourceBasenameNoExtension: parsed.name, resourceExtname: parsed.ext,
    resourceWorkspaceFolder: workspaceFolder, relativeResource: relative,
    relativeResourceDirname: path.dirname(relative),
    file: resource, fileDirname: parsed.dir, fileBasename: parsed.base,
    fileBasenameNoExtension: parsed.name, fileExtname: parsed.ext,
    fileWorkspaceFolder: workspaceFolder, relativeFile: relative, relativeFileDirname: path.dirname(relative),
  };
  return options.map((option: string) => option.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
    const value = name.startsWith('env:') ? process.env[name.slice(4)] : values[name];
    if (value === undefined) {
      throw new Error(`无法解析 uic 参数变量：\${${name}}`);
    }
    return value;
  }));
}
