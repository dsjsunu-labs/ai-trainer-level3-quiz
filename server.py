from __future__ import annotations

import http.server
import os
import socket
import socketserver
import sys
import threading
import time
import webbrowser
from pathlib import Path


PORT = 8000
ROOT = Path(__file__).resolve().parent


def local_ips() -> list[str]:
    found: list[str] = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith(("127.", "169.254.")) and ip not in found:
                found.append(ip)
    except OSError:
        pass

    # getaddrinfo 在部分 Windows 网络中不返回当前 WLAN 地址。
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        probe.close()
        if ip not in found and not ip.startswith(("127.", "169.254.")):
            found.insert(0, ip)
    except OSError:
        pass
    return found


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def open_home() -> None:
    time.sleep(0.6)
    webbrowser.open(f"http://127.0.0.1:{PORT}/index.html")


def main() -> None:
    os.chdir(ROOT)
    print("=" * 58)
    print("  AI训练师三级题库正在启动")
    print("=" * 58)
    try:
        server = ReusableServer(("0.0.0.0", PORT), QuietHandler)
    except OSError as exc:
        print(f"\n端口 {PORT} 已经在使用，尝试直接打开现有网页。")
        print(f"如果网页仍打不开，请关闭旧的黑色窗口后重新双击启动。\n{exc}")
        webbrowser.open(f"http://127.0.0.1:{PORT}/index.html")
        input("\n按回车键关闭此窗口……")
        return

    print(f"\n本机地址： http://127.0.0.1:{PORT}")
    ips = local_ips()
    if ips:
        print("\n手机 / iPad 地址（选择与热点或 Wi-Fi 对应的一个）：")
        for ip in ips:
            print(f"  http://{ip}:{PORT}")
    else:
        print("\n暂未检测到局域网地址，请先让电脑连接 Wi-Fi 或手机热点。")
    print("\n使用期间请保留这个窗口；关闭窗口即停止服务。")
    print("手机首次打不开时，请允许 Windows 防火墙的“专用网络”。")
    print("=" * 58)
    threading.Thread(target=open_home, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\n启动失败：{exc}")
        input("按回车键关闭此窗口……")
        sys.exit(1)
