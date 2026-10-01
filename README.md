# PySide6 Utils

English | [简体中文](README.zh-CN.md)

[Install from Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=xazeng.vscode-pyside6-utils)

Edit Qt `.ui` files using the Python environment selected for your project in VS Code, and automatically generate PySide6 Python code when you save.

The extension summary, command title, and settings descriptions follow VS Code's display language: Simplified Chinese is supported, with English as the default fallback. Use the links above to switch README languages.

## Support

**Donations are entirely voluntary. All features are available for free, with no payment required.**

If you find this extension useful, you can support the project by scanning the QR code below. Thank you!

<img src="tip_qr_code.jpg" alt="QR code to support the project" width="280">

## Features

- Right-click a `.ui` file in the Explorer or editor and select **Edit QT UI File** to open Qt Designer from the corresponding environment.
- Automatically run PySide6 uic when a `.ui` file is created or saved, including changes saved by Designer outside VS Code.
- Generate `<filename>_ui.py` in the same directory by default. If generation fails, keep the last successful output. See **Output → PySide6 Utils** for details.
- Resolve settings and Python environments for the target file's workspace. Switching environments takes effect on the next operation.

Only UI editing and automatic code generation are included. QML, resource compilation, translation tools, PyQt, and PySide2 are not supported.

## Usage

1. Install the Microsoft Python extension and install PySide6 in the Python environment you want to use.
2. Select your project's environment using **Python: Select Interpreter** or Python Environments.
3. Right-click a `.ui` file and select **Edit QT UI File**.
4. Save in Designer to generate the corresponding Python file automatically. Opening a workspace does not regenerate all existing UI files.

To install a local VSIX, use **Install from VSIX…** in the Extensions view. Disable UI auto-generation in the old Qt for Python extension to prevent both extensions from writing to the same output files.

The extension invokes PySide6 tools through the selected interpreter's absolute path. It does not fall back to system Python if environment resolution fails or PySide6 is missing. The selected environment must provide working Designer and uic tools.

Files inside the workspace are monitored for changes. For a file opened outside the workspace, running the edit command also starts monitoring external saves. Unsaved edits in VS Code are saved before Designer opens. Automatic generation is enabled by default and replaces the target Python file, so do not edit generated files manually.

## Configuration

The configuration prefix has changed from the old extension's `qtForPython` to **`pyside6Utils`**. Old settings are not read automatically. Copy any uic options you want to keep into the new setting:

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

Each array element is a single argument. Paths containing spaces do not need extra quotes. The extension appends the input UI path automatically. Setting this array replaces the default options; removing `-o` sends uic output to the log instead of generating a file. The output directory must already exist. Relative output paths are resolved from the UI file's directory. Only one output path is allowed, and it must not overwrite a `.ui` file.

The following variables are supported and refer to the UI file being processed:

| Variable | Meaning |
| --- | --- |
| `${resource}` / `${file}` | Absolute UI file path |
| `${resourceDirname}` / `${fileDirname}` | UI file directory |
| `${resourceBasename}` / `${fileBasename}` | File name with extension |
| `${resourceBasenameNoExtension}` / `${fileBasenameNoExtension}` | File name without extension |
| `${resourceExtname}` / `${fileExtname}` | File extension |
| `${workspaceFolder}` / `${resourceWorkspaceFolder}` / `${fileWorkspaceFolder}` | Workspace folder containing the UI file |
| `${workspaceFolderBasename}` | Workspace folder name |
| `${relativeResource}` / `${relativeFile}` | Path relative to the workspace, or the file name if no workspace applies |
| `${relativeResourceDirname}` / `${relativeFileDirname}` | Directory part of the relative path above |
| `${pathSeparator}` | Platform path separator |
| `${userHome}` | User home directory |
| `${env:NAME}` | Environment variable from the extension host process |

Unknown variables, unavailable workspace folders, and missing environment variables produce an error.

## Compatibility

- Requires VS Code **1.69.0** or later. The extension is type-checked against that version's API, targets ES2020, and has no runtime npm dependencies.
- When the new Python Environments API is enabled and available, the extension uses `getEnvironment(uri)` and its execution information. Otherwise, it uses the Python extension's `getActiveEnvironmentPath` / `resolveEnvironment`, or `settings.getExecutionDetails` on older versions.
- Setting `python.useEnvironmentsExtension` explicitly to `false` selects the classic Python extension API. If the new environment API is active but no environment is selected, the environment is broken, or the API call fails, the operation reports an error instead of switching interpreters.
- Python Environments integration is optional and does not raise the minimum VS Code version. Older VS Code installations need a compatible version of the Microsoft Python extension.
- Requires a file system and a trusted workspace. Browser-based VS Code and virtual workspaces are not supported. In a remote workspace, Python and Qt tools run on the remote extension host; that host needs a graphical display environment for Designer.
- Real-tool tests currently cover Windows, Python 3.8, and PySide6 6.3.2. Interactive testing on VS Code 1.69, Linux, and macOS has not been performed.

Environment API references: [Microsoft Python API](https://github.com/microsoft/vscode-python/blob/main/pythonExtensionApi/src/main.ts) and [Python Environments API](https://github.com/microsoft/vscode-python-environments/blob/main/src/types.ts).

## Development and Testing

```powershell
npm ci
npm run compile
npm test
```

Use Node.js 20 or later for development and testing. Press F5 to launch the Extension Development Host. Tests cover environment API adaptation, variable expansion, save-event debouncing, extension event integration, and subprocess execution. When PySide6 is available, tests also create temporary virtual environments and run real uic commands to verify output preservation on failure and isolation from environments without PySide6. Set `PYSIDE6_TEST_PYTHON` to choose the Python interpreter for these tests; the two real-environment tests are skipped if PySide6 is unavailable. The Designer test intercepts the GUI subprocess to inspect the executable and arguments resolved by the real entry point; it does not interact with the GUI.

To create a local installation package without publishing:

```powershell
npm exec --yes --package @vscode/vsce@3.6.2 -- vsce package --no-dependencies
```

This project draws on the UI workflow of [Qt for Python](https://github.com/seanwu1105/vscode-qt-for-python), with an independent implementation and a new configuration namespace.
