from __future__ import annotations

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUTPUT = DIST / "ai-trainer-level3-web.zip"
DESKTOP_COPY = ROOT.parent / "AI训练师三级刷题网站-发布包.zip"
FILES = [
    "index.html",
    "styles.css",
    "app.js",
    "supabase.js",
    "questions.js",
    "service-worker.js",
    "manifest.webmanifest",
]


def main() -> int:
    validation = subprocess.run([sys.executable, str(ROOT / "tools" / "validate_project.py")])
    if validation.returncode:
        print("\n项目校验未通过，已停止打包。")
        return validation.returncode

    DIST.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            archive.write(ROOT / name, arcname=name)

    shutil.copy2(OUTPUT, DESKTOP_COPY)
    print(f"\n发布包：{OUTPUT}")
    print(f"便捷副本：{DESKTOP_COPY}")
    print("ZIP 内文件均位于根目录，可直接上传 Cloudflare。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
