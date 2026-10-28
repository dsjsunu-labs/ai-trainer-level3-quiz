from __future__ import annotations

import contextlib
import http.server
import socketserver
import sys
import threading
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args) -> None:
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("缺少 Playwright：pip install playwright")
        return 2

    old_cwd = Path.cwd()
    try:
        import os

        os.chdir(ROOT)
        server = Server(("127.0.0.1", 0), QuietHandler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        time.sleep(0.2)

        errors: list[str] = []
        with sync_playwright() as playwright:
            launch = {"headless": True}
            if EDGE.exists():
                launch["executable_path"] = str(EDGE)
            browser = playwright.chromium.launch(**launch)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route("https://**/*", lambda route: route.abort())
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{port}/?smoke=1", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(500)

            assert "899" in page.locator(".hero-main").inner_text(), "首页未显示 899 题"

            page.locator("#accountBtn").click()
            assert page.locator("#authDialog").evaluate("e => e.open"), "登录弹窗未打开"
            assert page.locator("#authPassword").is_visible(), "同步密码输入框未显示"
            assert page.locator("#passwordLoginBtn").is_visible(), "密码登录按钮未显示"
            page.locator("#authPassword").fill("12345678")
            page.locator("#passwordLoginBtn").click()
            assert "请填写正确的邮箱" in page.locator("#toast").inner_text(), "密码登录输入校验未生效"
            page.locator("#authDialog form button").click()

            page.locator('[data-action="start-random"]').first.click()
            assert page.locator("#practiceDialog").evaluate("e => e.open"), "题型选择弹窗未打开"
            page.locator('input[value="single"]').evaluate("e => e.checked = false")
            page.locator('input[value="multi"]').evaluate("e => e.checked = false")
            page.locator("#practiceCount").select_option("10")
            page.locator("#confirmPractice").click()
            assert page.locator(".pill").inner_text() == "判断题", "题型筛选没有只保留判断题"
            assert page.locator(".practice-progress small span").first.inner_text() == "1 / 10", "随机题量不是 10"

            page.locator("#pomodoroBtn").click()
            page.locator("#focusMinutes").fill("1")
            page.locator("#pomoStart").click()
            assert page.locator("#pomoFloat").is_visible(), "番茄钟悬浮窗未显示"
            assert page.locator("#pomoFloatTime").inner_text() in {"01:00", "00:59"}, "番茄钟时间异常"

            assert not errors, f"页面 JavaScript 错误：{errors}"
            browser.close()
        print("UI 冒烟测试通过：密码登录入口、题型筛选、随机10题、番茄钟均正常。")
        return 0
    except AssertionError as exc:
        print(f"UI 冒烟测试失败：{exc}")
        return 1
    finally:
        with contextlib.suppress(Exception):
            server.shutdown()
            server.server_close()
        import os

        os.chdir(old_cwd)


if __name__ == "__main__":
    raise SystemExit(main())
