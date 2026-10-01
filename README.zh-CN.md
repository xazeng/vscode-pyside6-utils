# PySide6 Utils

[English](README.md) | 简体中文

[从 VS Code 扩展市场安装](https://marketplace.visualstudio.com/items?itemName=xazeng.vscode-pyside6-utils)

使用 VS Code 当前项目选择的 Python 环境编辑 Qt `.ui` 文件，并在保存后自动生成 PySide6 Python 代码。

扩展简介、命令标题和设置说明随 VS Code 显示语言切换，支持简体中文，默认回退英文。README 通过顶部链接切换语言。

## 支持项目

**打赏完全自愿，不付费也能完整使用全部功能。**

如果这个插件对你有帮助，欢迎扫描下方二维码支持项目。感谢支持！

<img src="tip_qr_code.jpg" alt="支持项目的打赏二维码" width="280">

## 功能

- 在资源管理器或编辑器中右键 `.ui` 文件，选择 **编辑 Qt UI 文件**（英文界面为 **Edit QT UI File**），打开对应环境中的 Qt Designer。
- 新建或保存 `.ui` 文件后自动调用 PySide6 uic；支持 Designer 在 VS Code 外部保存。
- 默认在同目录生成 `<文件名>_ui.py`。生成失败时保留上一次成功的输出，详情可查看 **输出 → PySide6 Utils**。
- 支持按文件所属工作区读取配置与 Python 环境，运行期间切换环境后下一次操作自动生效。

当前仅迁移 UI 编辑和自动生成，不包含 QML、资源编译、翻译、PyQt 或 PySide2 支持。

## 使用

1. 安装 Microsoft Python 扩展，并在需要使用的 Python 环境内安装 PySide6。
2. 使用 **Python: Select Interpreter** 或 Python Environments 选择当前项目的环境。
3. 右键 `.ui` 文件，选择 **编辑 Qt UI 文件**（英文界面为 **Edit QT UI File**）。
4. 在 Designer 中保存，插件自动生成对应 Python 文件。打开工作区时不会批量生成已有 UI。

本地 VSIX 可通过扩展面板的 **从 VSIX 安装…** 安装。建议禁用旧 Qt for Python 插件的 UI 自动生成，避免两个插件同时写入相同输出文件。

插件按所选解释器的绝对路径调用其 PySide6 工具，不会在环境解析失败或缺少 PySide6 时改用系统 Python。所选环境必须包含可用的 Designer 和 uic。

工作区内的 `.ui` 文件由文件监听器跟踪；单独打开、位于工作区外的文件，执行编辑命令后也会监听外部保存。VS Code 中未保存的编辑会先保存再打开 Designer。自动生成默认启用，会替换已有的目标 Python 文件，因此请勿手工修改生成文件。

## 配置

配置前缀由旧插件的 `qtForPython` 改为 **`pyside6Utils`**。旧配置不会自动读取，请将需要保留的 uic 参数复制到新配置：

```json
{
  "pyside6Utils.uic.options": [
    "-o",
    "${resourceDirname}${pathSeparator}${resourceBasenameNoExtension}_ui.py",
    "--from-imports"
  ],
  "pyside6Utils.uic.liveExecution.enabled": true
}
```

每个数组元素为一个参数，带空格的路径无需额外包裹引号。输入 UI 路径由插件自动追加。设置整个数组会替换默认参数；若移除 `-o`，uic 的输出显示在日志中，不会生成文件。输出目录须已存在；相对输出路径以当前 UI 文件目录为基准。只允许一个输出路径，且不允许覆盖 `.ui` 文件。

支持以下变量（均以本次处理的 UI 文件为准）：

| 变量 | 含义 |
| --- | --- |
| `${resource}` / `${file}` | UI 绝对路径 |
| `${resourceDirname}` / `${fileDirname}` | UI 所在目录 |
| `${resourceBasename}` / `${fileBasename}` | 带扩展名的文件名 |
| `${resourceBasenameNoExtension}` / `${fileBasenameNoExtension}` | 不带扩展名的文件名 |
| `${resourceExtname}` / `${fileExtname}` | 扩展名 |
| `${workspaceFolder}` / `${resourceWorkspaceFolder}` / `${fileWorkspaceFolder}` | UI 所属工作区目录 |
| `${workspaceFolderBasename}` | 工作区目录名 |
| `${relativeResource}` / `${relativeFile}` | 相对工作区路径，无工作区时为文件名 |
| `${relativeResourceDirname}` / `${relativeFileDirname}` | 上述相对路径的目录 |
| `${pathSeparator}` | 系统路径分隔符 |
| `${userHome}` | 用户主目录 |
| `${env:NAME}` | 扩展宿主进程的环境变量 |

未知变量或无法取得的工作区、环境变量会明确报错。

## 兼容性

- 最低 VS Code **1.69.0**，使用该版本的 API 类型检查，运行代码目标为 ES2020，无运行时 npm 依赖。
- 新版启用 Python Environments 时，使用其 `getEnvironment(uri)` 和执行信息；未提供该 API 时使用 Python 扩展的 `getActiveEnvironmentPath` / `resolveEnvironment`；更旧版本使用 `settings.getExecutionDetails`。
- `python.useEnvironmentsExtension` 明确为 `false` 时使用经典 Python 扩展接口。新环境 API 已启用但未选环境、环境损坏或调用失败时会报错，避免切换到其他解释器。
- 新环境扩展是可选适配，不强制安装，因此不会通过它提高旧 VS Code 的最低版本。旧 VS Code 需安装与其兼容的 Microsoft Python 扩展版本。
- 需要本地文件系统和可信工作区，不支持浏览器版 VS Code / 虚拟工作区。在远程工作区运行时，Python 与 Qt 工具位于远程扩展宿主，Designer 需要该主机具有图形显示条件。
- 当前真实工具测试环境为 Windows、Python 3.8、PySide6 6.3.2；VS Code 1.69 实机界面及 Linux/macOS 尚未验证。

环境接口参考：[Microsoft Python API](https://github.com/microsoft/vscode-python/blob/main/pythonExtensionApi/src/main.ts)、[Python Environments API](https://github.com/microsoft/vscode-python-environments/blob/main/src/types.ts)。

## 开发与验证

```powershell
npm ci
npm run compile
npm test
```

开发和测试建议使用 Node.js 20 或更高版本。按 F5 可启动扩展开发宿主。测试包括环境接口适配、参数展开、事件防抖、扩展事件集成和子进程执行；存在 PySide6 时，还会创建临时虚拟环境执行真实 uic，验证失败保护和缺包环境隔离。可通过 `PYSIDE6_TEST_PYTHON` 指定用于真实测试的 Python；没有可用 PySide6 时，这两项测试会标记跳过。Designer 测试拦截 GUI 子进程，检查真实入口解析的程序与参数，不进行界面点击。

打包命令（仅生成本地安装包，不发布）：

```powershell
npm exec --yes --package @vscode/vsce@3.6.2 -- vsce package --no-dependencies
```

本项目借鉴 [Qt for Python](https://github.com/seanwu1105/vscode-qt-for-python) 的 UI 工作流程，使用独立实现及新的配置命名空间。
