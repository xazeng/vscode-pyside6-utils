"""通过 VS Code 选中的解释器调用该环境自带的 PySide6 工具。"""

import os
import sys


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("designer", "uic"):
        print("Expected tool: designer or uic", file=sys.stderr)
        return 2
    tool = sys.argv.pop(1)
    # 清理从启动 VS Code 的其他虚拟环境继承的标记。
    if sys.prefix != sys.base_prefix:
        os.environ["VIRTUAL_ENV"] = sys.prefix
    else:
        os.environ.pop("VIRTUAL_ENV", None)
    try:
        from PySide6.scripts import pyside_tool
    except ImportError as error:
        print("PySide6 is unavailable in selected Python: {}\n{}".format(sys.executable, error), file=sys.stderr)
        return 1
    print("[PySide6 Utils] Python: {}".format(sys.executable), file=sys.stderr, flush=True)
    return getattr(pyside_tool, tool)()


if __name__ == "__main__":
    sys.exit(main())
