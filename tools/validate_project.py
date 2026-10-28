from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "index.html",
    "styles.css",
    "app.js",
    "supabase.js",
    "questions.js",
    "service-worker.js",
    "manifest.webmanifest",
]


def check(condition: bool, message: str, errors: list[str]) -> None:
    mark = "PASS" if condition else "FAIL"
    print(f"[{mark}] {message}")
    if not condition:
        errors.append(message)


def load_questions(path: Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8")
    prefix = "window.QUESTION_BANK="
    if not raw.startswith(prefix) or not raw.rstrip().endswith(";"):
        raise ValueError("questions.js 不是预期的 window.QUESTION_BANK 包装")
    return json.loads(raw[len(prefix) :].strip()[:-1])


def main() -> int:
    errors: list[str] = []
    print(f"项目目录：{ROOT}\n")

    for name in REQUIRED:
        check((ROOT / name).is_file(), f"发布资源存在：{name}", errors)

    try:
        questions = load_questions(ROOT / "questions.js")
    except Exception as exc:
        check(False, f"题库可解析：{exc}", errors)
        questions = []

    counts = Counter(q.get("type") for q in questions)
    check(len(questions) == 900, f"题库总数为 900（实际 {len(questions)}）", errors)
    check(counts == {"tf": 300, "single": 300, "multi": 300}, f"题型数量为 300/300/300（实际 {dict(counts)}）", errors)
    ids = [q.get("id") for q in questions]
    check(len(ids) == len(set(ids)), "题目 ID 唯一", errors)
    check(all(q.get("stem") for q in questions), "所有题目均有展示题干或缺失说明", errors)
    check(all(len(q.get("options", [])) in (2, 4, 5) for q in questions), "所有题目的选项数量合法", errors)
    check(
        all(set(q.get("answer", [])).issubset({o.get("key") for o in q.get("options", [])}) for q in questions),
        "所有答案均对应现有选项",
        errors,
    )

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    versions = re.findall(r"(?:styles|app|questions|supabase)\.js?\?v=(\d+)", html)
    cache_match = re.search(r'ai-trainer-v(\d+)', sw)
    html_version = versions[0] if versions else None
    check(bool(versions) and len(set(versions)) == 1, f"HTML 核心资源版本一致（{versions or '无'}）", errors)
    check(bool(cache_match) and cache_match.group(1) == html_version, f"Service Worker 缓存号与 HTML 一致（v{html_version}）", errors)
    for name in ("styles.css", "app.js", "questions.js", "supabase.js", "manifest.webmanifest"):
        check(name in html, f"HTML 引用：{name}", errors)

    combined = "\n".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in ROOT.rglob("*")
        if p.is_file() and p.suffix.lower() in {".js", ".html", ".md", ".sql", ".py", ".txt"}
    )
    check(not re.search(r"sb_secret_[A-Za-z0-9_-]{12,}", combined), "项目不包含 sb_secret 密钥值", errors)
    check(not re.search(r"service[_-]?role\s*[:=]\s*['\"]ey", combined, re.I), "项目不包含 service_role 值", errors)

    node = shutil.which("node")
    if node:
        for name in ("app.js", "supabase.js", "service-worker.js"):
            result = subprocess.run([node, "--check", str(ROOT / name)], capture_output=True, text=True)
            check(result.returncode == 0, f"JavaScript 语法：{name}", errors)
            if result.returncode:
                print(result.stderr)
    else:
        print("[SKIP] 未找到 node，跳过 JavaScript 语法检查")

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    check(manifest.get("display") == "standalone", "PWA manifest 使用 standalone", errors)

    print("\n" + ("校验全部通过。" if not errors else f"校验失败：{len(errors)} 项。"))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
