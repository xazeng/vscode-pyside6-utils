import * as path from 'path';
import type { Uri } from 'vscode';

export interface PythonCommand {
  executable: string;
  args: string[];
  source: string;
}

// 仅描述消费的 API，避免新版 SDK 的 VS Code / Node 要求抬高宿主最低版本。
interface PythonApi {
  ready?: Promise<void>;
  environments?: {
    getActiveEnvironmentPath(resource: Uri): { path: string };
    resolveEnvironment(environment: { path: string }): Promise<{
      executable: { uri?: Uri };
    } | undefined>;
  };
  settings?: {
    getExecutionDetails(resource: Uri): { execCommand?: string[] };
  };
}

interface EnvironmentsApi {
  getEnvironment?(resource: Uri): Promise<{
    error?: string;
    execInfo: {
      run: { executable: string; args?: string[] };
      activatedRun?: { executable: string; args?: string[] };
    };
  } | undefined>;
}

export interface PythonHost {
  activate(id: string): Promise<unknown>;
  useEnvironmentsExtension(resource: Uri): boolean | undefined;
}

function command(executable: string | undefined, args: string[], source: string): PythonCommand {
  if (!executable || !path.isAbsolute(executable) || executable.includes('\0') ||
      !Array.isArray(args) || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
    throw new Error('无法取得有效的 Python 绝对路径。请先为当前项目选择 Python 环境。');
  }
  return { executable, args: [...args], source };
}

/** 每次操作重新解析，确保多根工作区及运行期间切换环境均使用当前选择。 */
export async function resolvePython(resource: Uri, host: PythonHost): Promise<PythonCommand> {
  const python = await host.activate('ms-python.python') as PythonApi | undefined;
  if (python?.ready) {
    await python.ready;
  }
  // 配置未明确关闭时探测新扩展；旧版未安装或未导出 API 时继续使用 Python API。
  if (host.useEnvironmentsExtension(resource) !== false) {
    const api = await host.activate('ms-python.vscode-python-envs') as EnvironmentsApi | undefined;
    if (typeof api?.getEnvironment === 'function') {
      const environment = await api.getEnvironment(resource);
      if (!environment) {
        throw new Error('当前项目尚未选择 Python 环境，请在 Python Environments 中选择环境。');
      }
      if (environment.error) {
        throw new Error(`所选 Python 环境不可用：${environment.error}`);
      }
      const run = environment.execInfo.activatedRun ?? environment.execInfo.run;
      return command(run.executable, run.args ?? [], 'Python Environments');
    }
  }
  if (typeof python?.environments?.getActiveEnvironmentPath === 'function' &&
      typeof python.environments.resolveEnvironment === 'function') {
    const selected = python.environments.getActiveEnvironmentPath(resource);
    if (!selected?.path) {
      throw new Error('当前项目尚未选择 Python 环境。');
    }
    const resolved = await python.environments.resolveEnvironment(selected);
    return command(resolved?.executable.uri?.fsPath, [], 'Python environments API');
  }
  if (typeof python?.settings?.getExecutionDetails === 'function') {
    const selected = python.settings.getExecutionDetails(resource).execCommand;
    return command(selected?.[0], selected?.slice(1) ?? [], 'Python legacy API');
  }
  throw new Error('无法读取 Python 环境。请安装并启用 Microsoft Python 扩展，然后选择解释器。');
}
