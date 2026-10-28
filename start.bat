@echo off
chcp 65001 >nul
cd /d "%~dp0"
title AI 训练师三级刷题站

where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8000"
  node "%~dp0server.js"
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8000"
  python -X utf8 "%~dp0server.py"
  goto :end
)

echo.
echo 没有检测到 Node.js 或 Python。
echo 直接打开 index.html 也能正常刷题，只是不能“添加到主屏幕”。
echo.
start "" "%~dp0index.html"

:end
if errorlevel 1 pause
