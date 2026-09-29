@echo off
title Build TikTok Uploader Pro - Windows
cd /d "%~dp0"

echo ==========================================================
echo    Dang Dong Goi (Build) TikTok Uploader Pro Cho Windows...
echo ==========================================================

call npm run build:win

echo.
echo ==========================================================
echo    BUILD HOAN TAT!
echo    File cai dat (.exe) nam trong thu muc: dist\
echo ==========================================================
explorer dist
pause
