#!/usr/bin/env node
/* 零依赖静态服务器：node server.js
   默认 http://127.0.0.1:8000，可用环境变量 PORT / HOST 修改。
   只是为了在 localhost 下运行（Service Worker 离线缓存需要 http 环境）。 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  const target = path.resolve(ROOT, "." + pathname);
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  const file = pathname.endsWith("/") || pathname === "/" ? path.join(target, "index.html") : target;
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + pathname);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`AI 训练师三级刷题站`);
  console.log(`打开浏览器访问: http://${HOST}:${PORT}`);
  console.log(`按 Ctrl+C 停止`);
});
